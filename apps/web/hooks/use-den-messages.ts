"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useChatStore } from "@/stores/use-chat-store";
import type { Message } from "@/types/den";

const PAGE_SIZE = 40;

async function fetchMessages(denId: string): Promise<Message[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("messages")
        .select(
            `
      id,
      den_id,
      user_id,
      type,
      content,
      voice_url,
      voice_duration,
      created_at,
      sender:user_id (
        full_name,
        email
      )
    `,
        )
        .eq("den_id", denId)
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

    // If the messages table doesn't exist yet (404) just return empty array
    // instead of throwing so the rest of the den page still works.
    if (error) {
        if ((error as { code?: string }).code === "PGRST116" || error.message?.includes("does not exist") || error.message?.includes("404")) {
            return [];
        }
        throw error;
    }
    return (data ?? []) as unknown as Message[];
}

export function useDenMessages(denId: string) {
    const queryClient = useQueryClient();
    const { setMessages, addMessage } = useChatStore();

    const query = useQuery({
        queryKey: ["messages", denId],
        queryFn: () => fetchMessages(denId),
        enabled: !!denId,
        // Don't retry on 404 — the table may not exist yet
        retry: false,
        throwOnError: false,
    });

    // Sync TanStack Query data into Zustand chat store
    useEffect(() => {
        if (query.data) {
            setMessages(query.data);
        }
    }, [query.data, setMessages]);

    // Only subscribe to realtime if the table actually exists (query succeeded)
    const tableExists = query.isSuccess && !query.isError;

    // Subscribe to new messages via Supabase Realtime
    useEffect(() => {
        if (!denId || !tableExists) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`messages:den:${denId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `den_id=eq.${denId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    addMessage(newMsg);
                    // Also invalidate the query so a refetch gets the full sender profile
                    queryClient.invalidateQueries({ queryKey: ["messages", denId] });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [denId, addMessage, queryClient, tableExists]);

    const sendText = useMutation({
        mutationFn: async ({
            userId,
            content,
        }: {
            userId: string;
            content: string;
        }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("messages")
                .insert({
                    den_id: denId,
                    user_id: userId,
                    type: "text",
                    content,
                    voice_url: null,
                    voice_duration: null,
                })
                .select()
                .single();
            if (error) throw error;
            return data as Message;
        },
    });

    const sendVoice = useMutation({
        mutationFn: async ({
            userId,
            blob,
            durationSeconds,
        }: {
            userId: string;
            blob: Blob;
            durationSeconds: number;
        }) => {
            const supabase = createClient();
            const fileName = `${denId}/${userId}/${Date.now()}.webm`;
            const { error: uploadErr } = await supabase.storage
                .from("voice-notes")
                .upload(fileName, blob, { contentType: "audio/webm" });
            if (uploadErr) throw uploadErr;

            const { data: urlData } = supabase.storage
                .from("voice-notes")
                .getPublicUrl(fileName);

            const { data, error } = await supabase
                .from("messages")
                .insert({
                    den_id: denId,
                    user_id: userId,
                    type: "voice",
                    content: null,
                    voice_url: urlData.publicUrl,
                    voice_duration: Math.round(durationSeconds),
                })
                .select()
                .single();
            if (error) throw error;
            return data as Message;
        },
    });

    return { query, sendText, sendVoice };
}

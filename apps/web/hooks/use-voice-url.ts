"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to generate signed URLs for private voice notes in Supabase Storage.
 *
 * Since the voice-notes bucket is private, we need to generate signed URLs
 * for playback. These URLs expire after 1 hour.
 *
 * @param voicePath - The storage path (e.g., "denId/userId/timestamp.webm")
 * @returns The signed URL or null if not yet loaded
 */
export function useVoiceUrl(voicePath: string | null): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!voicePath) {
      setSignedUrl(null);
      return;
    }

    const supabase = createClient();

    // Generate a signed URL that expires in 1 hour (3600 seconds)
    supabase.storage
      .from("voice-notes")
      .createSignedUrl(voicePath, 3600)
      .then(({ data, error }) => {
        if (error) {
          console.error("[@meerkat/web] Failed to generate signed URL:", error);
          setSignedUrl(null);
        } else if (data) {
          setSignedUrl(data.signedUrl);
        }
      });
  }, [voicePath]);

  return signedUrl;
}

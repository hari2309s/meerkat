import { create } from "zustand";
import type { Message } from "@/types/den";

interface ChatState {
  messages: Message[];
  isRecording: boolean;
  recordingSeconds: number;
  hasMore: boolean;

  // Actions
  setMessages: (messages: Message[]) => void;
  prependMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingSeconds: (seconds: number) => void;
  setHasMore: (hasMore: boolean) => void;
  reset: () => void;
}

const initialState = {
  messages: [] as Message[],
  isRecording: false,
  recordingSeconds: 0,
  hasMore: false,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setMessages: (messages) => set({ messages }),

  prependMessages: (older) =>
    set((s) => ({ messages: [...older, ...s.messages] })),

  addMessage: (message) =>
    set((s) => {
      // Prevent duplicates
      if (s.messages.find((m) => m.id === message.id)) return s;
      return { messages: [...s.messages, message] };
    }),

  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingSeconds: (recordingSeconds) => set({ recordingSeconds }),
  setHasMore: (hasMore) => set({ hasMore }),
  reset: () => set(initialState),
}));

import { create } from "zustand";
import type { Den, DenMember, ModalType } from "@/types/den";

// Mute-persistence helpers have moved to @meerkat/utils/storage.
// Re-exported here so existing imports from this file keep working without changes.
export { loadMuteState, saveMuteState } from "@meerkat/utils/storage";

interface DenState {
  den: Den | null;
  members: DenMember[];
  muted: boolean;
  modal: ModalType;
  fabOpen: boolean;
  menuOpen: boolean;
  navigatingBack: boolean;

  // Actions
  setDen: (den: Den) => void;
  setMembers: (members: DenMember[]) => void;
  addMember: (member: DenMember) => void;
  removeMember: (userId: string) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setFabOpen: (open: boolean) => void;
  toggleFab: () => void;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setNavigatingBack: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  den: null,
  members: [],
  muted: false,
  modal: null as ModalType,
  fabOpen: false,
  menuOpen: false,
  navigatingBack: false,
};

export const useDenStore = create<DenState>((set) => ({
  ...initialState,

  setDen: (den) => set({ den }),
  setMembers: (members) => set({ members }),
  addMember: (member) =>
    set((s) => {
      if (s.members.find((m) => m.user_id === member.user_id)) return s;
      return { members: [...s.members, member] };
    }),
  removeMember: (userId) =>
    set((s) => ({ members: s.members.filter((m) => m.user_id !== userId) })),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  openModal: (modal) => set({ modal, menuOpen: false }),
  closeModal: () => set({ modal: null }),
  setFabOpen: (fabOpen) => set({ fabOpen }),
  toggleFab: () =>
    set((s) => ({
      fabOpen: !s.fabOpen,
      menuOpen: s.fabOpen ? s.menuOpen : false,
    })),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  toggleMenu: () =>
    set((s) => ({
      menuOpen: !s.menuOpen,
      fabOpen: s.menuOpen ? s.fabOpen : false,
    })),
  setNavigatingBack: (navigatingBack) => set({ navigatingBack }),
  reset: () => set(initialState),
}));

import { create } from "zustand";

interface PresenceState {
    // Maps denId → count of online users
    onlineByDen: Record<string, number>;
    // Maps denId → set of online userIds
    onlineUsersByDen: Record<string, Set<string>>;

    setOnlineCount: (denId: string, count: number) => void;
    setOnlineUsers: (denId: string, userIds: string[]) => void;
    addOnlineUser: (denId: string, userId: string) => void;
    removeOnlineUser: (denId: string, userId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
    onlineByDen: {},
    onlineUsersByDen: {},

    setOnlineCount: (denId, count) =>
        set((s) => ({ onlineByDen: { ...s.onlineByDen, [denId]: count } })),

    setOnlineUsers: (denId, userIds) =>
        set((s) => ({
            onlineByDen: { ...s.onlineByDen, [denId]: userIds.length },
            onlineUsersByDen: {
                ...s.onlineUsersByDen,
                [denId]: new Set(userIds),
            },
        })),

    addOnlineUser: (denId, userId) =>
        set((s) => {
            const users = new Set(s.onlineUsersByDen[denId] ?? []);
            users.add(userId);
            return {
                onlineByDen: { ...s.onlineByDen, [denId]: users.size },
                onlineUsersByDen: { ...s.onlineUsersByDen, [denId]: users },
            };
        }),

    removeOnlineUser: (denId, userId) =>
        set((s) => {
            const users = new Set(s.onlineUsersByDen[denId] ?? []);
            users.delete(userId);
            return {
                onlineByDen: { ...s.onlineByDen, [denId]: users.size },
                onlineUsersByDen: { ...s.onlineUsersByDen, [denId]: users },
            };
        }),
}));

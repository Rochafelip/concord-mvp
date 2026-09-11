import { create } from 'zustand';

interface NotificationState {
  message: string | null;
  unreadServerIds: string[];
  preferences: NotificationPreferences;
  setMessage: (message: string) => void;
  clear: () => void;
  markServerUnread: (serverId: string) => void;
  clearServerUnread: (serverId: string) => void;
  setPreferences: (preferences: Partial<NotificationPreferences>) => void;
}

export interface NotificationPreferences {
  messageNotifications: boolean;
  onboardingNotifications: boolean;
}

const STORAGE_KEY = 'concord-notification-preferences';
const defaultPreferences: NotificationPreferences = {
  messageNotifications: true,
  onboardingNotifications: true,
};

function loadPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(stored) };
  } catch {
    return defaultPreferences;
  }
}

/**
 * A single dismissible banner's worth of state — deliberately not a toast stack. Preferences
 * are local to this browser because they control presentation, not server-side delivery.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  unreadServerIds: [],
  preferences: loadPreferences(),
  setMessage: (message) => set({ message }),
  clear: () => set({ message: null }),
  markServerUnread: (serverId) =>
    set((state) => ({
      unreadServerIds: state.unreadServerIds.includes(serverId)
        ? state.unreadServerIds
        : [...state.unreadServerIds, serverId],
    })),
  clearServerUnread: (serverId) =>
    set((state) => ({
      unreadServerIds: state.unreadServerIds.filter((id) => id !== serverId),
    })),
  setPreferences: (preferences) =>
    set((state) => {
      const next = { ...state.preferences, ...preferences };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { preferences: next };
    }),
}));

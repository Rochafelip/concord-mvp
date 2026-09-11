import { create } from 'zustand';

interface NotificationState {
  message: string | null;
  preferences: NotificationPreferences;
  setMessage: (message: string) => void;
  clear: () => void;
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
  preferences: loadPreferences(),
  setMessage: (message) => set({ message }),
  clear: () => set({ message: null }),
  setPreferences: (preferences) =>
    set((state) => {
      const next = { ...state.preferences, ...preferences };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { preferences: next };
    }),
}));

import { create } from 'zustand';

interface NotificationState {
  message: string | null;
  setMessage: (message: string) => void;
  clear: () => void;
}

/**
 * A single dismissible banner's worth of state — deliberately not a toast stack. Used by
 * useRealtimeSync for both the WebSocket ERROR event and the SERVER_DELETE redirect notice,
 * and rendered once in AppShell via ErrorBanner.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  setMessage: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

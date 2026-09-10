import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, User } from '../../types/user';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  /**
   * Why the session ended, when it wasn't the user's choice. Set by apiClient on a 401 so the
   * login screen can explain what happened instead of just appearing.
   *
   * Deliberately outside `partialize`: this describes one arrival at the login screen, not a
   * persisted session. Surviving a reload would make the notice reappear for no reason.
   */
  sessionEndedReason: 'expired' | null;
  login: (result: AuthResult) => void;
  setUser: (user: User) => void;
  logout: () => void;
  expireSession: () => void;
  clearSessionEndedReason: () => void;
}

/**
 * JS can't clear an httpOnly cookie itself, so ending a session has to be a real request.
 * Raw `fetch` rather than apiClient: apiClient depends on this store, and calling into it from
 * here would close that dependency line into a cycle.
 */
function clearSessionCookie() {
  fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

/**
 * Session state for the app.
 *
 * The JWT itself lives only in an httpOnly cookie the backend sets on login/register — never
 * in JS-reachable state (see docs/superpowers/specs/2026-09-09-jwt-cookie-storage-design.md) —
 * this store just tracks whether we believe we're logged in and the profile to display.
 *
 * This store intentionally has no dependency on the API layer (services/apiClient.ts,
 * features/auth/api.ts) — it only holds state and simple setters. `apiClient` depends on
 * this store (to clear it on a 401), not the other way around, which keeps the dependency graph
 * a one-way line instead of a cycle:
 *
 *   features/auth/api.ts -> services/apiClient.ts -> features/auth/authStore.ts
 *
 * Ending a session (`logout()` and `expireSession()`) goes through `clearSessionCookie()` above,
 * which uses raw `fetch` for the same reason.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      sessionEndedReason: null,
      login: (result) =>
        set({
          isAuthenticated: true,
          user: {
            id: result.userId,
            username: result.username,
            displayName: result.displayName,
            email: result.email,
            avatarUrl: null,
          },
        }),
      setUser: (user) => set({ user }),
      logout: () => {
        clearSessionCookie();
        set({ isAuthenticated: false, user: null, sessionEndedReason: null });
      },
      // Same clearing as logout(), but records that the user didn't ask for this — LoginPage
      // reads the reason to explain why they're suddenly back at the login screen.
      expireSession: () => {
        clearSessionCookie();
        set({ isAuthenticated: false, user: null, sessionEndedReason: 'expired' });
      },
      clearSessionEndedReason: () => set({ sessionEndedReason: null }),
    }),
    {
      name: 'concord-auth',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, user: state.user }),
    },
  ),
);

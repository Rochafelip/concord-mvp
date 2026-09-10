import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, User } from '../../types/user';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (result: AuthResult) => void;
  setUser: (user: User) => void;
  logout: () => void;
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
 * `logout()` below calls the raw `fetch` API (not `apiClient`) to clear the httpOnly cookie
 * server-side — JS can't clear an httpOnly cookie directly, and calling into apiClient or
 * features/auth/api.ts here would create a cycle with the dependency line above.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
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
        fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
        set({ isAuthenticated: false, user: null });
      },
    }),
    {
      name: 'concord-auth',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, user: state.user }),
    },
  ),
);

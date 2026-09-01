import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, User } from '../../types/user';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (result: AuthResult) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

/**
 * Session state for the app.
 *
 * This store intentionally has no dependency on the API layer (services/apiClient.ts,
 * features/auth/api.ts) — it only holds state and simple setters. `apiClient` depends on
 * this store (to read the current token and to clear it on a 401), not the other way
 * around, which keeps the dependency graph a one-way line instead of a cycle:
 *
 *   features/auth/api.ts -> services/apiClient.ts -> features/auth/authStore.ts
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (result) =>
        set({
          token: result.token,
          user: {
            id: result.userId,
            username: result.username,
            displayName: result.displayName,
            email: result.email,
            avatarUrl: null,
          },
        }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'concord-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

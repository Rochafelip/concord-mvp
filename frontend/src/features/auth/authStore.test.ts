import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '../../types/user';
import { useAuthStore } from './authStore';

const authResult: AuthResult = {
  userId: 'user-1',
  username: 'jdoe',
  displayName: 'John Doe',
  email: 'jdoe@example.com',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login() sets isAuthenticated and derives the user from the auth result', () => {
    useAuthStore.getState().login(authResult);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({
      id: 'user-1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'jdoe@example.com',
      avatarUrl: null,
    });
  });

  it('logout() clears isAuthenticated and the user, and clears the session cookie server-side', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  });

  it('logout() clears local state even if the network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().logout();
    // Let the rejected promise's .catch() run before asserting.
    await Promise.resolve();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('setUser() updates the user without touching isAuthenticated', () => {
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().setUser({
      id: 'user-1',
      username: 'jdoe',
      displayName: 'Johnny',
      email: 'jdoe@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.displayName).toBe('Johnny');
    expect(state.user?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('persists isAuthenticated and user to localStorage via the persist middleware', () => {
    useAuthStore.getState().login(authResult);

    const raw = localStorage.getItem('concord-auth');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!);
    expect(persisted.state.isAuthenticated).toBe(true);
    expect(persisted.state.user.username).toBe('jdoe');
  });
});

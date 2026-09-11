import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '../../types/user';
import { useAuthStore } from './authStore';

const authResult: AuthResult = {
  userId: 'user-1',
  username: 'jdoe',
  displayName: 'John Doe',
  email: 'jdoe@example.com',
  emailVerified: true,
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
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
      emailVerified: true,
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

  it('expireSession() clears the session and records that it was not the user\'s choice', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().expireSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.sessionEndedReason).toBe('expired');
  });

  it('logout() leaves no reason behind, so a deliberate exit shows no notice', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    useAuthStore.setState({ isAuthenticated: true, sessionEndedReason: 'expired' });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().sessionEndedReason).toBeNull();
  });

  it('clearSessionEndedReason() drops the reason once it has been shown', () => {
    useAuthStore.setState({ sessionEndedReason: 'expired' });

    useAuthStore.getState().clearSessionEndedReason();

    expect(useAuthStore.getState().sessionEndedReason).toBeNull();
  });

  it('does not persist the session-ended reason across reloads', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().expireSession();

    const persisted = JSON.parse(localStorage.getItem('concord-auth')!);
    expect(persisted.state.sessionEndedReason).toBeUndefined();
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

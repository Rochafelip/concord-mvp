import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResult } from '../../types/user';
import { useAuthStore } from './authStore';

const authResult: AuthResult = {
  token: 'jwt-token',
  userId: 'user-1',
  username: 'jdoe',
  displayName: 'John Doe',
  email: 'jdoe@example.com',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
  });

  it('login() sets the token and derives the user from the auth result', () => {
    useAuthStore.getState().login(authResult);

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual({
      id: 'user-1',
      username: 'jdoe',
      displayName: 'John Doe',
      email: 'jdoe@example.com',
      avatarUrl: null,
    });
  });

  it('logout() clears both the token and the user', () => {
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setUser() updates the user without touching the token', () => {
    useAuthStore.getState().login(authResult);

    useAuthStore.getState().setUser({
      id: 'user-1',
      username: 'jdoe',
      displayName: 'Johnny',
      email: 'jdoe@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user?.displayName).toBe('Johnny');
    expect(state.user?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('persists token and user to localStorage via the persist middleware', () => {
    useAuthStore.getState().login(authResult);

    const raw = localStorage.getItem('concord-auth');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!);
    expect(persisted.state.token).toBe('jwt-token');
    expect(persisted.state.user.username).toBe('jdoe');
  });
});

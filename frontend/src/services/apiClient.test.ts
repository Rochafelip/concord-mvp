import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/authStore';
import { ApiError, apiClient } from './apiClient';

function mockFetchResponse(body: unknown, init: { status: number; ok: boolean }) {
  return {
    ok: init.ok,
    status: init.status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionEndedReason: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the request with same-origin credentials so the session cookie is included', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ ok: true }, { status: 200, ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('users/me');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe('same-origin');
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('clears the auth store when the response is 401', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: '1', username: 'a', displayName: 'A', email: 'a@b.com', avatarUrl: null },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse(
        { timestamp: '', status: 401, error: 'Unauthorized', message: 'Invalid or expired token', path: '/api/v1/users/me' },
        { status: 401, ok: false },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('users/me')).rejects.toThrow();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('marks the cleared session as expired on a 401', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: null, sessionEndedReason: null });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse(
          { timestamp: '', status: 401, error: 'Unauthorized', message: 'x', path: '/api/v1/users/me' },
          { status: 401, ok: false },
        ),
      ),
    );

    await expect(apiClient.get('users/me')).rejects.toThrow();

    expect(useAuthStore.getState().sessionEndedReason).toBe('expired');
  });

  it('throws an ApiError carrying the backend message for a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse(
        {
          timestamp: '',
          status: 400,
          error: 'Bad Request',
          message: 'email: must be a well-formed email address; password: size must be between 8 and 100',
          path: '/api/v1/auth/register',
        },
        { status: 400, ok: false },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.post('auth/register', {})).rejects.toMatchObject({
      message: 'email: must be a well-formed email address; password: size must be between 8 and 100',
      status: 400,
    });
  });

  it('throws an instance of ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse(
        { timestamp: '', status: 409, error: 'Conflict', message: 'Email already in use', path: '/api/v1/auth/register' },
        { status: 409, ok: false },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await apiClient.post('auth/register', {});
      expect.unreachable('expected apiClient.post to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }
  });
});

import { useAuthStore } from '../features/auth/authStore';

const API_PREFIX = '/api/v1';

/**
 * Error shape returned by the backend for every non-2xx response (see
 * com.concordmvp.common.ApiError):
 *   { timestamp, status, error, message, path }
 */
interface BackendApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

/**
 * Thin wrapper around fetch. Callers pass a path relative to /api/v1, e.g. 'auth/login'.
 *
 * Reads the current token directly from `authStore` (via `getState()`, not the `useAuthStore`
 * hook, since this is plain module code, not a React component) so callers don't have to pass
 * it in manually. See authStore.ts for why this doesn't create a circular import.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token } = useAuthStore.getState();
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_PREFIX}/${path.replace(/^\/+/, '')}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    // Single long-lived JWT, no server-side revocation (docs/DECISIONS.md D2) — a 401
    // means the token is missing/invalid/expired, so logging out client-side is enough.
    // Route-level logic (ProtectedRoute) reacts to the store change and redirects.
    useAuthStore.getState().logout();
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = (await response.json()) as BackendApiError;
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // Response had no JSON body; fall back to statusText.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiError';

/**
 * A module-level singleton rather than created inside a component: authStore.logout()/
 * expireSession() need to clear it outside of React (see authStore.ts), which only works if
 * everyone shares this one instance instead of each importer constructing its own.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 means the token is missing/invalid/expired (apiClient already logs the user
      // out in that case) — retrying is pointless and just delays the redirect to /login.
      // Any other error keeps the default retry-3x behavior.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status === 401 ? false : failureCount < 3,
    },
  },
});

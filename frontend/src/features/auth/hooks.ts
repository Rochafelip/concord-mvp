import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMe, login, register } from './api';
import { useAuthStore } from './authStore';

/**
 * Only routes inside the authenticated area are accepted as a post-login target.
 *
 * A `from` can arrive from a forged URL, so an absolute one ('https://evil.com') or a
 * protocol-relative one ('//evil.com', which browsers treat as absolute) must never be followed.
 * The '/app/' prefix is checked with its trailing slash, since a bare startsWith('/app') would
 * also accept '/appearances-are-deceiving'.
 */
function safeRedirectTarget(from: unknown): string {
  if (typeof from !== 'string') return '/app';
  return from === '/app' || from.startsWith('/app/') || from.startsWith('/app?') ? from : '/app';
}

export function useLogin() {
  const storeLogin = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      storeLogin(result);
      navigate(safeRedirectTarget((location.state as { from?: unknown } | null)?.from), {
        replace: true,
      });
    },
  });
}

export function useRegister() {
  const storeLogin = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: register,
    onSuccess: (result) => {
      storeLogin(result);
      navigate('/app');
    },
  });
}

/**
 * Boot-time (and refresh-time) session validation: confirms the session cookie is still good
 * and refreshes the user's profile. Only runs when we believe a session exists.
 */
export function useMe() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: getMe,
    enabled: isAuthenticated,
  });
}

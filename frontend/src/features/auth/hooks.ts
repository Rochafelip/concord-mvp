import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMe, login, register } from './api';
import { useAuthStore } from './authStore';

export function useLogin() {
  const storeLogin = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      storeLogin(result);
      navigate('/app');
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
 * Boot-time (and refresh-time) session validation: confirms the persisted token is still
 * good and refreshes the user's profile. Only runs when a token exists.
 */
export function useMe() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: getMe,
    enabled: token != null,
  });
}

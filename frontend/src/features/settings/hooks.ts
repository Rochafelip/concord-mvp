import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { changePassword, updateProfile } from './api';

export function useUpdateProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}

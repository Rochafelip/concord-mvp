import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { changePassword, removeAvatar, updateProfile, uploadAvatar } from './api';

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

export function useUploadAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (user) => setUser(user),
  });
}

export function useRemoveAvatar() {
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);
  return useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      if (currentUser) setUser({ ...currentUser, avatarUrl: null });
    },
  });
}

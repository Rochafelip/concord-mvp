import { apiClient } from '../../services/apiClient';
import type { User } from '../../types/user';

export interface UpdateProfilePayload {
  username: string;
  displayName: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export function updateProfile(data: UpdateProfilePayload): Promise<User> {
  return apiClient.patch<User>('users/me', data);
}

export function changePassword(data: ChangePasswordPayload): Promise<void> {
  return apiClient.put<void>('users/me/password', data);
}

export function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.put<User>('users/me/avatar', formData);
}

export function removeAvatar(): Promise<void> {
  return apiClient.delete<void>('users/me/avatar');
}

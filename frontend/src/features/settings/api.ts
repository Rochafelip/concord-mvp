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

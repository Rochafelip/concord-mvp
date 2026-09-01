import { apiClient } from '../../services/apiClient';
import type { AuthResult, User } from '../../types/user';

export interface RegisterPayload {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function register(data: RegisterPayload): Promise<AuthResult> {
  return apiClient.post<AuthResult>('auth/register', data);
}

export function login(data: LoginPayload): Promise<AuthResult> {
  return apiClient.post<AuthResult>('auth/login', data);
}

export function getMe(): Promise<User> {
  return apiClient.get<User>('users/me');
}

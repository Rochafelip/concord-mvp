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

export function resendVerification(): Promise<void> {
  return apiClient.post<void>('auth/verify-email/resend');
}

export function verifyEmail(token: string): Promise<void> {
  return apiClient.post<void>('auth/verify-email', { token });
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiClient.post<void>('auth/forgot-password', { email });
}

export function verifyPasswordResetToken(token: string): Promise<void> {
  return apiClient.post<void>('auth/reset-password/verify', { token });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return apiClient.post<void>('auth/reset-password', { token, password });
}

export interface WsTicketResponse {
  ticket: string;
}

export function getWsTicket(): Promise<WsTicketResponse> {
  return apiClient.post<WsTicketResponse>('realtime/ws-ticket');
}

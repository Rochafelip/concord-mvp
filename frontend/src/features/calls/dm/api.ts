import { apiClient } from '../../../services/apiClient';
import type { VoiceTokenResponse } from '../../../types/voice';

export function inviteCall(friendId: string): Promise<{ callId: string }> {
  return apiClient.post(`dm/${friendId}/calls/invite`);
}

export function acceptCall(callId: string): Promise<VoiceTokenResponse> {
  return apiClient.post(`dm/calls/${callId}/accept`);
}

export function declineCall(callId: string): Promise<void> {
  return apiClient.post(`dm/calls/${callId}/decline`);
}

export function cancelCall(callId: string): Promise<void> {
  return apiClient.post(`dm/calls/${callId}/cancel`);
}

export function getCallToken(callId: string): Promise<VoiceTokenResponse> {
  return apiClient.post(`dm/calls/${callId}/token`);
}

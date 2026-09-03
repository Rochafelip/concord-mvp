import { apiClient } from '../../services/apiClient';
import type { VoiceTokenResponse } from '../../types/voice';

export function getVoiceToken(channelId: string): Promise<VoiceTokenResponse> {
  return apiClient.post<VoiceTokenResponse>(`channels/${channelId}/voice/token`);
}

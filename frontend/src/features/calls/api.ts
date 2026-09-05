import { apiClient } from '../../services/apiClient';
import type { VoicePresenceEntry, VoiceTokenResponse } from '../../types/voice';
import type { VoicePresencePayload } from '../../types/websocket';

export function getVoiceToken(channelId: string): Promise<VoiceTokenResponse> {
  return apiClient.post<VoiceTokenResponse>(`channels/${channelId}/voice/token`);
}

/**
 * Flattens the wire shape's nested `user` object — shared by the REST snapshot below and
 * useRealtimeSync's VOICE_PRESENCE_UPDATE handler, so there's exactly one place that does this
 * mapping (docs/superpowers/specs/2026-09-04-voice-channel-participant-preview-design.md §4.3).
 */
export function toVoicePresenceEntry(raw: VoicePresencePayload): VoicePresenceEntry {
  return {
    channelId: raw.channelId,
    userId: raw.user.id,
    displayName: raw.user.displayName,
    avatarUrl: raw.user.avatarUrl,
    muted: raw.muted,
    cameraOn: raw.cameraOn,
    screenSharing: raw.screenSharing,
    speaking: raw.speaking,
  };
}

export function getVoicePresence(serverId: string): Promise<VoicePresenceEntry[]> {
  return apiClient
    .get<VoicePresencePayload[]>(`servers/${serverId}/voice-presence`)
    .then((entries) => entries.map(toVoicePresenceEntry));
}

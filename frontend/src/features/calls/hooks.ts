import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAuthStore } from '../auth/authStore';
import * as api from './api';

/**
 * Fetches a LiveKit access token for the given voice channel and connects to it. Not gated by
 * "already connected" here — voiceClient.connect() itself handles switching from a previously
 * connected channel (docs/superpowers spec decision #4: no manual leave step required).
 *
 * Calls voiceClient.beginConnect() synchronously, before awaiting the token, so a disconnect()
 * that happens while the token fetch is in flight (e.g. the user leaves right after joining)
 * correctly invalidates this join instead of silently reconnecting once the token arrives — see
 * docs/superpowers/specs/2026-09-08-last-visited-text-channel-design.md.
 */
export function useJoinVoiceChannel() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const generation = voiceClient.beginConnect(channelId);
      const { token, url } = await api.getVoiceToken(channelId);
      await voiceClient.connect(channelId, token, url, generation);
    },
  });
}

export function useVoiceStatus() {
  return useVoiceStore(
    useShallow((state) => ({
      status: state.status,
      channelId: state.channelId,
      error: state.error,
      isDeafened: state.isDeafened,
    })),
  );
}

export function useVoiceParticipants() {
  return useVoiceStore((state) => state.participants);
}

export function useVoicePresence(serverId: string | undefined) {
  return useQuery({
    queryKey: ['servers', serverId, 'voice-presence'],
    queryFn: () => api.getVoicePresence(serverId!),
    enabled: serverId != null,
  });
}

/**
 * Ends any active call when the user's session ends — logout (token -> null) or the
 * component unmounting entirely. Mounted once in AppShell, mirroring how useRealtimeSync
 * owns the WebSocket connection's lifecycle there for the same "only while authenticated"
 * reason.
 */
export function useDisconnectVoiceOnLogout(): void {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;
    return () => voiceClient.disconnect();
  }, [token]);
}

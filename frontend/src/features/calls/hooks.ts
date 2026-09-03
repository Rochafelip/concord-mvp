import { useMutation } from '@tanstack/react-query';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceStore } from '../../stores/voiceStore';
import * as api from './api';

/**
 * Fetches a LiveKit access token for the given voice channel and connects to it. Not gated by
 * "already connected" here — voiceClient.connect() itself handles switching from a previously
 * connected channel (docs/superpowers spec decision #4: no manual leave step required).
 */
export function useJoinVoiceChannel() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { token, url } = await api.getVoiceToken(channelId);
      await voiceClient.connect(channelId, token, url);
    },
  });
}

export function useVoiceStatus() {
  return useVoiceStore((state) => ({ status: state.status, channelId: state.channelId, error: state.error }));
}

export function useVoiceParticipants() {
  return useVoiceStore((state) => state.participants);
}

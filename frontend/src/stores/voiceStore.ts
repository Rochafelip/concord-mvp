import { create } from 'zustand';
import type { VoiceParticipant } from '../types/voice';

export type VoiceConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface VoiceState {
  status: VoiceConnectionStatus;
  channelId: string | null;
  participants: VoiceParticipant[];
  error: string | null;
  isDeafened: boolean;
  setStatus: (status: VoiceConnectionStatus, channelId: string | null) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  setError: (error: string | null) => void;
  setDeafened: (value: boolean) => void;
  reset: () => void;
}

/**
 * Lives outside services/voiceClient.ts itself so components can read call status/participants
 * reactively without importing the LiveKit Room instance directly — same split as
 * websocketClient.ts/wsConnectionStore.ts.
 */
export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'disconnected',
  channelId: null,
  participants: [],
  error: null,
  isDeafened: false,
  setStatus: (status, channelId) => set({ status, channelId }),
  setParticipants: (participants) => set({ participants }),
  setError: (error) => set({ error }),
  setDeafened: (value) => set({ isDeafened: value }),
  reset: () => set({ status: 'disconnected', channelId: null, participants: [], error: null, isDeafened: false }),
}));

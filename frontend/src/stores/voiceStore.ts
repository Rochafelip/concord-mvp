import { create } from 'zustand';
import type { VoiceParticipant } from '../types/voice';

export type VoiceConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface VoiceState {
  status: VoiceConnectionStatus;
  channelId: string | null;
  participants: VoiceParticipant[];
  error: string | null;
  isDeafened: boolean;
  /** Identity hovered as the pending whistle target, before the hotkey is actually held down. */
  armedWhistleTarget: string | null;
  /** Identity I am currently whistling to (sender-side state), or null if I'm not whistling. */
  whisperingTo: string | null;
  /** Identity currently whistling to me (target-side state), or null if nobody is. */
  receivingWhistleFrom: string | null;
  setStatus: (status: VoiceConnectionStatus, channelId: string | null) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  setError: (error: string | null) => void;
  setDeafened: (value: boolean) => void;
  setArmedWhistleTarget: (identity: string | null) => void;
  setWhisperingTo: (identity: string | null) => void;
  setReceivingWhistleFrom: (identity: string | null) => void;
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
  armedWhistleTarget: null,
  whisperingTo: null,
  receivingWhistleFrom: null,
  setStatus: (status, channelId) => set({ status, channelId }),
  setParticipants: (participants) => set({ participants }),
  setError: (error) => set({ error }),
  setDeafened: (value) => set({ isDeafened: value }),
  setArmedWhistleTarget: (identity) => set({ armedWhistleTarget: identity }),
  setWhisperingTo: (identity) => set({ whisperingTo: identity }),
  setReceivingWhistleFrom: (identity) => set({ receivingWhistleFrom: identity }),
  reset: () =>
    set({
      status: 'disconnected',
      channelId: null,
      participants: [],
      error: null,
      isDeafened: false,
      armedWhistleTarget: null,
      whisperingTo: null,
      receivingWhistleFrom: null,
    }),
}));

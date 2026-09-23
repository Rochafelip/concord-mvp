import { create } from 'zustand';

interface CallPipState {
  pipWindow: Window | null;
  setPipWindow: (pipWindow: Window | null) => void;
}

/**
 * Holds the Document Picture-in-Picture window, if one is open. Lives outside useCallPip.ts
 * itself so VoiceConnectionBar (owns the portal, opens/closes it) and CallControlBar (only
 * needs to know whether one is already open, to hide its own "Destacar chamada" button) both
 * see the same value without a parent/child relationship between them — same split as
 * voiceStore.ts living outside services/voiceClient.ts.
 */
export const useCallPipStore = create<CallPipState>((set) => ({
  pipWindow: null,
  setPipWindow: (pipWindow) => set({ pipWindow }),
}));

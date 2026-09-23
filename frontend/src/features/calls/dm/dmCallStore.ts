import { create } from 'zustand';

export type DmCallStatus = 'idle' | 'ringing-out' | 'ringing-in' | 'connected';

export interface DmCallPeer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface DmCallState {
  status: DmCallStatus;
  callId: string | null;
  /** 'caller' still has to fetch its own token once CALL_RESOLVED(ACCEPTED) arrives — 'callee'
   *  already has one from its own accept() response by then. */
  role: 'caller' | 'callee' | null;
  peer: DmCallPeer | null;
  startOutgoing: (callId: string, peer: DmCallPeer) => void;
  receiveInvite: (callId: string, peer: DmCallPeer) => void;
  setConnected: () => void;
  reset: () => void;
}

/**
 * Ring/accept/decline/cancel state for a 1:1 call between friends
 * (docs/superpowers/specs/2026-09-23-dm-call-design.md). Deliberately separate from
 * stores/voiceStore.ts, which only ever reflects "am I connected to a LiveKit room right now" —
 * this store exists to drive the pre-connection ringing UI (IncomingCallModal/
 * OutgoingCallOverlay), which voiceStore has no concept of.
 */
export const useDmCallStore = create<DmCallState>((set) => ({
  status: 'idle',
  callId: null,
  role: null,
  peer: null,
  startOutgoing: (callId, peer) => set({ status: 'ringing-out', callId, role: 'caller', peer }),
  receiveInvite: (callId, peer) => set({ status: 'ringing-in', callId, role: 'callee', peer }),
  setConnected: () => set((state) => ({ ...state, status: 'connected' })),
  reset: () => set({ status: 'idle', callId: null, role: null, peer: null }),
}));

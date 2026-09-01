import { create } from 'zustand';

export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface WsConnectionState {
  status: WsConnectionStatus;
  setStatus: (status: WsConnectionStatus) => void;
}

/**
 * Lives outside services/websocketClient.ts itself so components can read connection status
 * reactively (e.g. to gate the message send button) without importing the client class
 * directly.
 */
export const useWsConnectionStore = create<WsConnectionState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));

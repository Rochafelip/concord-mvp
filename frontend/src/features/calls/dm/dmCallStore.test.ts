import { beforeEach, describe, expect, it } from 'vitest';
import { useDmCallStore } from './dmCallStore';

const peer = { id: 'u2', displayName: 'Bob', avatarUrl: null };

describe('dmCallStore', () => {
  beforeEach(() => {
    useDmCallStore.setState({ status: 'idle', callId: null, role: null, peer: null });
  });

  it('starts idle', () => {
    const state = useDmCallStore.getState();
    expect(state.status).toBe('idle');
    expect(state.callId).toBeNull();
    expect(state.role).toBeNull();
    expect(state.peer).toBeNull();
  });

  it('startOutgoing sets ringing-out with the caller role', () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);

    const state = useDmCallStore.getState();
    expect(state.status).toBe('ringing-out');
    expect(state.callId).toBe('call-1');
    expect(state.role).toBe('caller');
    expect(state.peer).toEqual(peer);
  });

  it('receiveInvite sets ringing-in with the callee role', () => {
    useDmCallStore.getState().receiveInvite('call-1', peer);

    const state = useDmCallStore.getState();
    expect(state.status).toBe('ringing-in');
    expect(state.callId).toBe('call-1');
    expect(state.role).toBe('callee');
    expect(state.peer).toEqual(peer);
  });

  it('setConnected moves to connected without touching callId/role/peer', () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);

    useDmCallStore.getState().setConnected();

    const state = useDmCallStore.getState();
    expect(state.status).toBe('connected');
    expect(state.callId).toBe('call-1');
    expect(state.role).toBe('caller');
    expect(state.peer).toEqual(peer);
  });

  it('reset clears everything back to idle', () => {
    useDmCallStore.getState().startOutgoing('call-1', peer);

    useDmCallStore.getState().reset();

    expect(useDmCallStore.getState()).toMatchObject({ status: 'idle', callId: null, role: null, peer: null });
  });
});

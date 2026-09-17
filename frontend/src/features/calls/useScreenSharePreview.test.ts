import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { MockRoom, roomInstances } = vi.hoisted(() => {
  class MockRoom {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    on = vi.fn().mockReturnThis();
    remoteParticipants = new Map();

    constructor() {
      roomInstances.push(this);
    }
  }
  const roomInstances: MockRoom[] = [];
  return { MockRoom, roomInstances };
});

vi.mock('livekit-client', () => ({
  Room: MockRoom,
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnpublished: 'trackUnpublished',
  },
  Track: {
    Source: { ScreenShare: 'screen_share' },
  },
}));

vi.mock('./api', () => ({
  getVoicePreviewToken: vi.fn(),
}));

const { useScreenSharePreview } = await import('./useScreenSharePreview');
const { getVoicePreviewToken } = await import('./api');

function handlerFor(room: InstanceType<typeof MockRoom>, event: string) {
  const call = room.on.mock.calls.find(([registeredEvent]: [string]) => registeredEvent === event);
  if (!call) throw new Error(`No handler registered for ${event}`);
  return call[1] as (...args: unknown[]) => void;
}

function remoteParticipant(identity: string, publication: unknown = undefined) {
  return {
    identity,
    getTrackPublication: vi.fn().mockReturnValue(publication),
  };
}

beforeEach(() => {
  roomInstances.length = 0;
  vi.mocked(getVoicePreviewToken).mockReset();
  vi.mocked(getVoicePreviewToken).mockResolvedValue({ token: 't', url: 'wss://x.test', roomName: 'r' });
});

describe('useScreenSharePreview', () => {
  it('starts in the connecting status and requests a preview token for the channel', async () => {
    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    expect(result.current.status).toBe('connecting');
    await waitFor(() => expect(getVoicePreviewToken).toHaveBeenCalledWith('c1'));
  });

  it('connects a separate LiveKit room with autoSubscribe disabled', async () => {
    renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    await waitFor(() => expect(roomInstances[0].connect).toHaveBeenCalledWith('wss://x.test', 't', { autoSubscribe: false }));
  });

  it('subscribes the target participant\'s ScreenShare publication when they join after connecting', async () => {
    renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    const setSubscribed = vi.fn();

    act(() => {
      handlerFor(roomInstances[0], 'participantConnected')(remoteParticipant('bob', { setSubscribed }));
    });

    expect(setSubscribed).toHaveBeenCalledWith(true);
  });

  it('does not subscribe when a different participant joins', async () => {
    renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    const setSubscribed = vi.fn();

    act(() => {
      handlerFor(roomInstances[0], 'participantConnected')(remoteParticipant('someone-else', { setSubscribed }));
    });

    expect(setSubscribed).not.toHaveBeenCalled();
  });

  it('becomes ready with the track once TrackSubscribed fires for that participant\'s screen share', async () => {
    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    const room = roomInstances[0];
    const track = { source: 'screen_share' };
    const participant = remoteParticipant('bob');

    act(() => {
      handlerFor(room, 'trackSubscribed')(track, {}, participant);
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.track).toBe(track);
  });

  it('ignores a TrackSubscribed event for a different participant', async () => {
    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    // The target isn't in this mock room's remoteParticipants, so the post-connect check already
    // settles on 'unavailable' before the event below fires — asserting it stays there (not
    // 'ready') is exactly what proves the event was ignored.
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    const room = roomInstances[0];

    act(() => {
      handlerFor(room, 'trackSubscribed')({ source: 'screen_share' }, {}, remoteParticipant('someone-else'));
    });

    expect(result.current.status).toBe('unavailable');
    expect(result.current.track).toBeNull();
  });

  it('becomes unavailable when the target participant disconnects', async () => {
    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    const room = roomInstances[0];

    act(() => {
      handlerFor(room, 'trackSubscribed')({ source: 'screen_share' }, {}, remoteParticipant('bob'));
    });
    expect(result.current.status).toBe('ready');

    act(() => {
      handlerFor(room, 'participantDisconnected')(remoteParticipant('bob'));
    });

    expect(result.current.status).toBe('unavailable');
    expect(result.current.track).toBeNull();
  });

  it('disconnects the preview room on unmount', async () => {
    const { unmount } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    const room = roomInstances[0];

    unmount();

    expect(room.disconnect).toHaveBeenCalled();
  });

  it('goes back to connecting and re-fetches a token when the identity changes', async () => {
    const { result, rerender } = renderHook(({ identity }) => useScreenSharePreview('c1', identity), {
      initialProps: { identity: 'bob' },
    });

    await waitFor(() => expect(roomInstances).toHaveLength(1));
    act(() => {
      handlerFor(roomInstances[0], 'trackSubscribed')({ source: 'screen_share' }, {}, remoteParticipant('bob'));
    });
    expect(result.current.status).toBe('ready');

    rerender({ identity: 'carol' });

    expect(result.current.status).toBe('connecting');
    expect(roomInstances[0].disconnect).toHaveBeenCalled();
    await waitFor(() => expect(getVoicePreviewToken).toHaveBeenCalledTimes(2));
  });

  it('marks unavailable if the target has already left by the time the preview room connects', async () => {
    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.track).toBeNull();
  });

  it('becomes unavailable when fetching the token fails', async () => {
    vi.mocked(getVoicePreviewToken).mockReset();
    vi.mocked(getVoicePreviewToken).mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useScreenSharePreview('c1', 'bob'));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.track).toBeNull();
  });
});

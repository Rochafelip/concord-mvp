import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '../stores/voiceStore';

const { roomInstances, MockRoom, micState, cameraState, screenShareState, connectResolvers } = vi.hoisted(() => {
  const micState = { shouldFail: false };
  const cameraState = { shouldFail: false };
  const screenShareState = { shouldFail: false };
  const connectResolvers: Array<() => void> = [];

  class MockRoom {
    connect = vi.fn(() => new Promise<void>((resolve) => connectResolvers.push(resolve)));
    disconnect = vi.fn().mockResolvedValue(undefined);
    on = vi.fn().mockReturnThis();
    remoteParticipants = new Map();
    localParticipant = {
      identity: 'local-user',
      name: 'Local User',
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      setMicrophoneEnabled: vi.fn((enabled: boolean) => {
        if (micState.shouldFail) {
          return Promise.reject(new Error('Permission denied'));
        }
        this.localParticipant.isMicrophoneEnabled = enabled;
        return Promise.resolve(undefined);
      }),
      setCameraEnabled: vi.fn((enabled: boolean) => {
        if (cameraState.shouldFail) {
          return Promise.reject(new Error('Permission denied'));
        }
        this.localParticipant.isCameraEnabled = enabled;
        return Promise.resolve(undefined);
      }),
      setScreenShareEnabled: vi.fn((enabled: boolean) => {
        if (screenShareState.shouldFail) {
          return Promise.reject(new Error('Permission denied'));
        }
        this.localParticipant.isScreenShareEnabled = enabled;
        return Promise.resolve(undefined);
      }),
      getTrackPublication: vi.fn(() => undefined),
    };

    constructor() {
      roomInstances.push(this);
    }
  }
  const roomInstances: MockRoom[] = [];
  return { roomInstances, MockRoom, micState, cameraState, screenShareState, connectResolvers };
});

vi.mock('livekit-client', () => ({
  Room: MockRoom,
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    LocalTrackUnpublished: 'localTrackUnpublished',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio', Video: 'video' }, Source: { Camera: 'camera', ScreenShare: 'screen_share' } },
}));

// Imported after the mock so voiceClient's module-level `new Room()` calls use MockRoom.
const { voiceClient } = await import('./voiceClient');

function handlerFor(room: InstanceType<typeof MockRoom>, event: string): (...args: unknown[]) => void {
  const call = room.on.mock.calls.find(([registeredEvent]) => registeredEvent === event);
  if (!call) throw new Error(`No handler registered for ${event}`);
  return call[1] as (...args: unknown[]) => void;
}

/** Calls voiceClient.connect() and immediately resolves that call's underlying room.connect(). */
async function connectVoice(channelId: string, token: string, url: string): Promise<void> {
  const promise = voiceClient.connect(channelId, token, url);
  connectResolvers[connectResolvers.length - 1]();
  await promise;
}

describe('voiceClient', () => {
  beforeEach(() => {
    roomInstances.length = 0;
    connectResolvers.length = 0;
    micState.shouldFail = false;
    cameraState.shouldFail = false;
    screenShareState.shouldFail = false;
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null });
  });

  it('connects to the room, publishes the microphone by default, and marks the store connected', async () => {
    await connectVoice('channel-1', 'token-abc', 'wss://example.test/livekit');

    expect(roomInstances).toHaveLength(1);
    const room = roomInstances[0];
    expect(room.connect).toHaveBeenCalledWith('wss://example.test/livekit', 'token-abc');
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);

    const state = useVoiceStore.getState();
    expect(state.status).toBe('connected');
    expect(state.channelId).toBe('channel-1');
    expect(state.error).toBeNull();
  });

  it('does not enable the camera by default when connecting', async () => {
    await connectVoice('channel-1', 'token-abc', 'wss://example.test/livekit');
    const room = roomInstances[0];

    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.cameraEnabled).toBe(false);
    expect(local?.videoTrack).toBeNull();
  });

  it('does not enable screen sharing by default when connecting', async () => {
    await connectVoice('channel-1', 'token-abc', 'wss://example.test/livekit');
    const room = roomInstances[0];

    expect(room.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled();
    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.screenShareEnabled).toBe(false);
    expect(local?.screenShareTrack).toBeNull();
  });

  it('disconnects the previous room before connecting to a different voice channel', async () => {
    await connectVoice('channel-1', 'token-a', 'wss://example.test/livekit');
    const firstRoom = roomInstances[0];

    await connectVoice('channel-2', 'token-b', 'wss://example.test/livekit');

    expect(firstRoom.disconnect).toHaveBeenCalledTimes(1);
    expect(roomInstances).toHaveLength(2);
    expect(useVoiceStore.getState().channelId).toBe('channel-2');
  });

  it('records an error but keeps the room connected when the microphone permission is denied', async () => {
    micState.shouldFail = true;

    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

    const state = useVoiceStore.getState();
    expect(state.status).toBe('connected');
    expect(state.error).toBe('Microphone permission denied');
    expect(roomInstances[0].disconnect).not.toHaveBeenCalled();
  });

  it('toggles the local microphone off then on', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    expect(room.localParticipant.isMicrophoneEnabled).toBe(true);

    voiceClient.toggleMute();
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);

    voiceClient.toggleMute();
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(true);
  });

  it('toggles the local camera on then off', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    expect(room.localParticipant.isCameraEnabled).toBe(false);

    voiceClient.toggleCamera();
    expect(room.localParticipant.setCameraEnabled).toHaveBeenLastCalledWith(true);

    voiceClient.toggleCamera();
    expect(room.localParticipant.setCameraEnabled).toHaveBeenLastCalledWith(false);
  });

  it('records an error but keeps the room connected when the camera permission is denied while toggling', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    cameraState.shouldFail = true;

    voiceClient.toggleCamera();
    // toggleCamera()'s internal promise chain (setCameraEnabled().then().catch()) needs a
    // couple of microtask ticks to run its .catch handler before the store update is observable.
    await Promise.resolve();
    await Promise.resolve();

    expect(useVoiceStore.getState().error).toBe('Failed to change camera state');
    expect(room.localParticipant.isCameraEnabled).toBe(false);
    expect(room.disconnect).not.toHaveBeenCalled();
  });

  it('toggles the local screen share on then off', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    expect(room.localParticipant.isScreenShareEnabled).toBe(false);

    voiceClient.toggleScreenShare();
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(true);

    voiceClient.toggleScreenShare();
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(false);
  });

  it('records an error but keeps the room connected when screen sharing fails to start (permission denied or picker dismissed)', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    screenShareState.shouldFail = true;

    voiceClient.toggleScreenShare();
    await Promise.resolve();
    await Promise.resolve();

    expect(useVoiceStore.getState().error).toBe('Failed to change screen sharing state');
    expect(room.localParticipant.isScreenShareEnabled).toBe(false);
    expect(room.disconnect).not.toHaveBeenCalled();
  });

  it('resyncs participants when a local track is unpublished outside an explicit toggle call', async () => {
    // Covers the browser's native "Stop sharing" control (or a camera/mic device disconnecting):
    // livekit-client detects the underlying MediaStreamTrack ending and unpublishes it itself,
    // firing LocalTrackUnpublished — not one of our own toggle*() calls. Without a listener for
    // it, the store would keep showing stale enabled state until some unrelated event resynced.
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    room.localParticipant.isScreenShareEnabled = true;

    const onLocalTrackUnpublished = handlerFor(room, 'localTrackUnpublished');
    // Simulate the browser having already stopped the capture out-of-band before we resync.
    room.localParticipant.isScreenShareEnabled = false;
    onLocalTrackUnpublished();

    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.screenShareEnabled).toBe(false);
  });

  it('disconnects and resets the store', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    voiceClient.disconnect();

    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState()).toMatchObject({
      status: 'disconnected',
      channelId: null,
      participants: [],
      error: null,
    });
  });

  it('attaches a subscribed remote audio track to the DOM so it is actually audible', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');

    const mockElement = document.createElement('audio');
    const attach = vi.fn().mockReturnValue(mockElement);
    const track = { kind: 'audio', sid: 'track-1', attach };
    const participant = { identity: 'remote-user', name: 'Remote User' };

    onTrackSubscribed(track, {}, participant);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(document.body.contains(mockElement)).toBe(true);
  });

  it('does not create a hidden DOM element for a subscribed video track, but still resyncs participants', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    const videoTrackStub = { kind: 'video', sid: 'track-video-1', attach: vi.fn() };
    const bob = {
      identity: 'bob',
      name: 'Bob',
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
      isScreenShareEnabled: false,
      getTrackPublication: vi.fn(() => ({ videoTrack: videoTrackStub })),
    };
    room.remoteParticipants.set('bob', bob);

    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    onTrackSubscribed(videoTrackStub, {}, bob);

    expect(videoTrackStub.attach).not.toHaveBeenCalled();
    expect(document.querySelectorAll('video')).toHaveLength(0);

    const bobEntry = useVoiceStore.getState().participants.find((p) => p.identity === 'bob');
    expect(bobEntry?.cameraEnabled).toBe(true);
    expect(bobEntry?.videoTrack).toBe(videoTrackStub);
  });

  it('resyncs a remote participant\'s screenShareTrack when their screen-share track is subscribed', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    const screenTrackStub = { kind: 'video', sid: 'track-screen-1', attach: vi.fn() };
    const bob = {
      identity: 'bob',
      name: 'Bob',
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      isScreenShareEnabled: true,
      getTrackPublication: vi.fn((source: string) =>
        source === 'screen_share' ? { videoTrack: screenTrackStub } : undefined,
      ),
    };
    room.remoteParticipants.set('bob', bob);

    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    onTrackSubscribed(screenTrackStub, {}, bob);

    const bobEntry = useVoiceStore.getState().participants.find((p) => p.identity === 'bob');
    expect(bobEntry?.screenShareEnabled).toBe(true);
    expect(bobEntry?.screenShareTrack).toBe(screenTrackStub);
  });

  it('refreshes participant mic state when a remote track is subscribed, not just on explicit mute/unmute events', async () => {
    // Reproduces a real bug found in manual two-browser testing: a remote participant's
    // ParticipantConnected can fire before their microphone track is actually published, so the
    // snapshot taken at that moment reads micEnabled: false. Without a resync on subscribe, the
    // UI would show them as muted forever, even though they're not — until they happen to
    // explicitly toggle mute once.
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    const bob = {
      identity: 'bob',
      name: 'Bob',
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      getTrackPublication: vi.fn(() => undefined),
    };
    room.remoteParticipants.set('bob', bob);

    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const track = { kind: 'audio', sid: 'track-bob', attach: vi.fn().mockReturnValue(document.createElement('audio')) };
    onTrackSubscribed(track, {}, bob);

    const bobEntry = useVoiceStore.getState().participants.find((p) => p.identity === 'bob');
    expect(bobEntry?.micEnabled).toBe(true);
  });

  it('removes attached remote audio elements immediately on disconnect, without depending on TrackUnsubscribed firing', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');

    const mockElement = document.createElement('audio');
    const track = { kind: 'audio', sid: 'track-1', attach: vi.fn().mockReturnValue(mockElement) };
    onTrackSubscribed(track, {}, { identity: 'remote-user', name: 'Remote User' });
    expect(document.body.contains(mockElement)).toBe(true);

    // MockRoom.disconnect is a plain vi.fn() — it never itself emits TrackUnsubscribed, unlike
    // the real livekit-client Room. If cleanup depended on that event, this element would be
    // left behind forever; disconnect() must remove it proactively instead.
    voiceClient.disconnect();

    expect(document.body.contains(mockElement)).toBe(false);
  });

  it('attaches error handling to room.disconnect() so a rejection cannot escape as an unhandled promise rejection', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    // A real Promise (not vi.fn()'s own rejection helpers, which turned out to add their own
    // internal handling that masked this exact bug when first written) with a spy on its own
    // `.catch`, so we can directly assert production code attached a handler to THIS promise —
    // rather than relying on timing-sensitive process-level unhandledRejection detection.
    const rejected = Promise.reject(new Error('signaling socket already closed'));
    const catchSpy = vi.spyOn(rejected, 'catch');
    room.disconnect.mockReturnValueOnce(rejected);

    voiceClient.disconnect();

    expect(catchSpy).toHaveBeenCalled();
    await rejected.catch(() => {}); // avoid this test's own promise being reported as unhandled
  });

  it('ignores a connect() call that resolves after being superseded by a newer channel switch', async () => {
    const first = voiceClient.connect('channel-1', 'token-a', 'wss://example.test/livekit');
    const second = voiceClient.connect('channel-2', 'token-b', 'wss://example.test/livekit');

    connectResolvers[1]();
    await second;
    connectResolvers[0]();
    await first;

    const [room1, room2] = roomInstances;

    expect(useVoiceStore.getState().channelId).toBe('channel-2');
    expect(room2.disconnect).not.toHaveBeenCalled();
    expect(room1.disconnect).toHaveBeenCalledTimes(1);
  });
});

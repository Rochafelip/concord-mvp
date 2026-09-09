import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPresets } from 'livekit-client';
import { useVoiceStore } from '../stores/voiceStore';

const {
  roomInstances,
  MockRoom,
  micState,
  cameraState,
  screenShareState,
  connectResolvers,
  connectRejecters,
  mockSend,
  mockPlaySelfJoin,
  mockPlaySelfLeave,
  mockPlayParticipantJoined,
  mockPlayParticipantLeft,
} = vi.hoisted(() => {
  const micState = { shouldFail: false };
  const cameraState = { shouldFail: false };
  const screenShareState = { shouldFail: false };
  const connectResolvers: Array<() => void> = [];
  // Parallel to connectResolvers (one entry pushed per room.connect() call, same index) so a test
  // can simulate room.connect() rejecting — e.g. the LiveKit server being unreachable — instead of
  // resolving, without disturbing every existing test that only ever resolves via connectResolvers.
  const connectRejecters: Array<(reason?: unknown) => void> = [];
  const mockSend = vi.fn();
  const mockPlaySelfJoin = vi.fn();
  const mockPlaySelfLeave = vi.fn();
  const mockPlayParticipantJoined = vi.fn();
  const mockPlayParticipantLeft = vi.fn();

  class MockRoom {
    connect = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          connectResolvers.push(resolve);
          connectRejecters.push(reject);
        }),
    );
    disconnect = vi.fn().mockResolvedValue(undefined);
    on = vi.fn().mockReturnThis();
    remoteParticipants = new Map();
    localParticipant = {
      identity: 'local-user',
      name: 'Local User',
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      connectionQuality: 'unknown',
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
      getTrackPublication: vi.fn(
        ():
          | { isMuted: boolean; mute: () => unknown; unmute: () => unknown }
          | { audioTrack: { setProcessor: (processor: unknown) => Promise<void>; stopProcessor: () => Promise<void> } }
          | undefined => undefined,
      ),
    };

    constructor() {
      roomInstances.push(this);
    }
  }
  const roomInstances: MockRoom[] = [];
  return {
    roomInstances,
    MockRoom,
    micState,
    cameraState,
    screenShareState,
    connectResolvers,
    connectRejecters,
    mockSend,
    mockPlaySelfJoin,
    mockPlaySelfLeave,
    mockPlayParticipantJoined,
    mockPlayParticipantLeft,
  };
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
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    ConnectionQualityChanged: 'connectionQualityChanged',
    Disconnected: 'disconnected',
  },
  Track: {
    Kind: { Audio: 'audio', Video: 'video' },
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
  AudioPresets: {
    musicHighQualityStereo: { maxBitrate: 128_000 },
  },
}));

vi.mock('./websocketClient', () => ({
  websocketClient: { send: mockSend },
}));

vi.mock('./soundEffects', () => ({
  playSelfJoin: mockPlaySelfJoin,
  playSelfLeave: mockPlaySelfLeave,
  playParticipantJoined: mockPlayParticipantJoined,
  playParticipantLeft: mockPlayParticipantLeft,
}));

const mockCreateNoiseSuppressionProcessor = vi.hoisted(() => vi.fn(() => ({ name: 'noise-suppression' })));
const mockIsNoiseSuppressionSupported = vi.hoisted(() => vi.fn(() => true));
const mockGetNoiseSuppressionPreference = vi.hoisted(() => vi.fn(() => true));

vi.mock('./audio/noiseSuppression', () => ({
  createNoiseSuppressionProcessor: mockCreateNoiseSuppressionProcessor,
  isNoiseSuppressionSupported: mockIsNoiseSuppressionSupported,
}));

vi.mock('../features/settings/audio/noiseSuppressionPreference', () => ({
  getNoiseSuppressionPreference: mockGetNoiseSuppressionPreference,
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

function mockAudioTrack() {
  return {
    setProcessor: vi.fn().mockResolvedValue(undefined),
    stopProcessor: vi.fn().mockResolvedValue(undefined),
  };
}

function remoteParticipant(identity: string) {
  return {
    identity,
    name: identity,
    isMicrophoneEnabled: true,
    isCameraEnabled: false,
    isScreenShareEnabled: false,
    connectionQuality: 'unknown',
    getTrackPublication: () => undefined,
  };
}

describe('voiceClient', () => {
  beforeEach(() => {
    roomInstances.length = 0;
    connectResolvers.length = 0;
    connectRejecters.length = 0;
    micState.shouldFail = false;
    cameraState.shouldFail = false;
    screenShareState.shouldFail = false;
    mockSend.mockClear();
    mockPlaySelfJoin.mockClear();
    mockPlaySelfLeave.mockClear();
    mockPlayParticipantJoined.mockClear();
    mockPlayParticipantLeft.mockClear();
    useVoiceStore.setState({ status: 'disconnected', channelId: null, participants: [], error: null, isDeafened: false });
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
    expect(local?.screenShareHasAudio).toBe(false);
    expect(local?.screenShareAudioEnabled).toBe(false);
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

  it('does not send VOICE_PRESENCE_LEAVE or play a self-leave sound when disconnect() is called after a failed connection attempt', async () => {
    const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
    connectRejecters[connectRejecters.length - 1](new Error('connection failed'));
    await promise;

    expect(useVoiceStore.getState().status).toBe('disconnected');
    expect(useVoiceStore.getState().error).toBe('Failed to connect to voice channel');

    mockSend.mockClear();
    mockPlaySelfLeave.mockClear();

    voiceClient.disconnect();

    expect(mockSend).not.toHaveBeenCalledWith({ type: 'VOICE_PRESENCE_LEAVE', payload: {} });
    expect(mockPlaySelfLeave).not.toHaveBeenCalled();
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

  it('starts screen sharing with an HD resolution constraint and no audio key when audio is not requested', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    voiceClient.toggleScreenShare({ quality: 'hd', withAudio: false });

    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(true, {
      resolution: { width: 1280, height: 720 },
    });
    const lastCall = vi.mocked(room.localParticipant.setScreenShareEnabled).mock.calls.at(-1) as [
      boolean,
      Record<string, unknown>?,
    ];
    expect(lastCall[1]).not.toHaveProperty('audio');
  });

  it('starts screen sharing with an FHD resolution constraint when a quality is given', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    voiceClient.toggleScreenShare({ quality: 'fhd', withAudio: false });

    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(true, {
      resolution: { width: 1920, height: 1080 },
    });
  });

  it('captures unprocessed stereo audio and publishes it at a high-quality preset when audio is requested', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    voiceClient.toggleScreenShare({ quality: 'hd', withAudio: true });

    // autoGainControl/echoCancellation/noiseSuppression are mic-oriented processing that muffles
    // continuous non-speech audio (music, game/video sound) — must be explicitly disabled here
    // rather than left to the browser's own default for display-capture audio.
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(
      true,
      {
        resolution: { width: 1280, height: 720 },
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          channelCount: 2,
        },
      },
      {
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
        red: true,
        forceStereo: true,
      },
    );
  });

  it('stops screen sharing with a single boolean argument even when options are passed', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    voiceClient.toggleScreenShare({ quality: 'hd', withAudio: true });
    voiceClient.toggleScreenShare({ quality: 'fhd', withAudio: true });

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

  it('marks local screenShareAudioEnabled true when the screen-share-audio publication is unmuted', async () => {
    const publication = { isMuted: false, mute: vi.fn(), unmute: vi.fn() };
    const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[roomInstances.length - 1];
    room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
      source === 'screen_share_audio' ? publication : undefined,
    );
    connectResolvers[connectResolvers.length - 1]();
    await promise;

    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.screenShareAudioEnabled).toBe(true);
  });

  it('marks local screenShareAudioEnabled false when the screen-share-audio publication is muted', async () => {
    const publication = { isMuted: true, mute: vi.fn(), unmute: vi.fn() };
    const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[roomInstances.length - 1];
    room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
      source === 'screen_share_audio' ? publication : undefined,
    );
    connectResolvers[connectResolvers.length - 1]();
    await promise;

    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.screenShareAudioEnabled).toBe(false);
  });

  it('toggles local screen-share audio off then on without restarting the share', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const publication = {
      isMuted: false,
      mute: vi.fn(() => {
        publication.isMuted = true;
        return Promise.resolve(undefined);
      }),
      unmute: vi.fn(() => {
        publication.isMuted = false;
        return Promise.resolve(undefined);
      }),
    };
    room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
      source === 'screen_share_audio' ? publication : undefined,
    );

    voiceClient.toggleScreenShareAudio();
    expect(publication.mute).toHaveBeenCalledTimes(1);
    expect(publication.unmute).not.toHaveBeenCalled();

    voiceClient.toggleScreenShareAudio();
    expect(publication.unmute).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled();
  });

  it('does nothing when toggling screen-share audio with no published audio track', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

    expect(() => voiceClient.toggleScreenShareAudio()).not.toThrow();
  });

  it('records an error but keeps the publication when toggling screen-share audio fails', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const publication = { isMuted: false, mute: vi.fn(() => Promise.reject(new Error('failed'))), unmute: vi.fn() };
    room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
      source === 'screen_share_audio' ? publication : undefined,
    );

    voiceClient.toggleScreenShareAudio();
    await Promise.resolve();
    await Promise.resolve();

    expect(useVoiceStore.getState().error).toBe('Failed to change screen share audio state');
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
    expect(bobEntry?.screenShareHasAudio).toBe(false);
  });

  it('marks screenShareHasAudio true when the participant has a published screen-share audio track', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];

    const bob = {
      identity: 'bob',
      name: 'Bob',
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      isScreenShareEnabled: true,
      getTrackPublication: vi.fn((source: string) => (source === 'screen_share_audio' ? {} : undefined)),
    };
    room.remoteParticipants.set('bob', bob);

    const onParticipantConnected = handlerFor(room, 'participantConnected');
    onParticipantConnected();

    const bobEntry = useVoiceStore.getState().participants.find((p) => p.identity === 'bob');
    expect(bobEntry?.screenShareHasAudio).toBe(true);
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

  it('does not reconnect when disconnect() runs between beginConnect() and connect() — the race a slow token fetch can hit', async () => {
    // Mirrors useJoinVoiceChannel: capture the generation synchronously, then (in this test)
    // simulate an explicit leave happening while the token fetch that would follow is still
    // in flight, before connect() itself is ever called.
    const generation = voiceClient.beginConnect('channel-1');

    voiceClient.disconnect();

    await voiceClient.connect('channel-1', 'token-a', 'wss://example.test/livekit', generation);

    expect(roomInstances).toHaveLength(0);
    expect(useVoiceStore.getState().status).toBe('disconnected');
    expect(useVoiceStore.getState().channelId).toBeNull();
  });

  it('updates a participant\'s connectionQuality when ConnectionQualityChanged fires', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    room.localParticipant.connectionQuality = 'poor';

    const onConnectionQualityChanged = handlerFor(room, 'connectionQualityChanged');
    onConnectionQualityChanged();

    const local = useVoiceStore.getState().participants.find((p) => p.isLocal);
    expect(local?.connectionQuality).toBe('poor');
  });

  it('deafening mutes remote audio elements and the local mic', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const mockElement = document.createElement('audio');
    onTrackSubscribed(
      { kind: 'audio', sid: 'track-1', attach: vi.fn().mockReturnValue(mockElement) },
      {},
      { identity: 'remote-user', name: 'Remote User' },
    );

    voiceClient.toggleDeafen();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockElement.muted).toBe(true);
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
    expect(useVoiceStore.getState().isDeafened).toBe(true);
  });

  it('un-deafening unmutes remote audio but leaves the mic muted', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const mockElement = document.createElement('audio');
    onTrackSubscribed(
      { kind: 'audio', sid: 'track-1', attach: vi.fn().mockReturnValue(mockElement) },
      {},
      { identity: 'remote-user', name: 'Remote User' },
    );

    voiceClient.toggleDeafen();
    await Promise.resolve();
    await Promise.resolve();
    voiceClient.toggleDeafen();

    expect(mockElement.muted).toBe(false);
    expect(useVoiceStore.getState().isDeafened).toBe(false);
    expect(room.localParticipant.isMicrophoneEnabled).toBe(false);
  });

  it("sets a remote participant's microphone volume independently of their screen-share audio", async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const micElement = document.createElement('audio');
    const screenAudioElement = document.createElement('audio');
    const bob = { identity: 'bob', name: 'Bob' };

    onTrackSubscribed(
      { kind: 'audio', sid: 'track-mic', source: 'microphone', attach: vi.fn().mockReturnValue(micElement) },
      {},
      bob,
    );
    onTrackSubscribed(
      {
        kind: 'audio',
        sid: 'track-screen-audio',
        source: 'screen_share_audio',
        attach: vi.fn().mockReturnValue(screenAudioElement),
      },
      {},
      bob,
    );

    voiceClient.setParticipantVolume('bob', 0.4);
    voiceClient.setScreenShareVolume('bob', 0.9);

    expect(micElement.volume).toBe(0.4);
    expect(screenAudioElement.volume).toBe(0.9);
  });

  it('does not throw when setting volume for a participant with no matching subscribed track', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

    expect(() => voiceClient.setParticipantVolume('nobody', 0.5)).not.toThrow();
    expect(() => voiceClient.setScreenShareVolume('nobody', 0.5)).not.toThrow();
  });

  it("stops affecting a track's element after it is unsubscribed", async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const onTrackUnsubscribed = handlerFor(room, 'trackUnsubscribed');
    const micElement = document.createElement('audio');
    const bob = { identity: 'bob', name: 'Bob' };
    const track = {
      kind: 'audio',
      sid: 'track-mic',
      source: 'microphone',
      attach: vi.fn().mockReturnValue(micElement),
      detach: vi.fn(),
    };

    onTrackSubscribed(track, {}, bob);
    onTrackUnsubscribed(track, {}, bob);
    voiceClient.setParticipantVolume('bob', 0.4);

    expect(micElement.volume).toBe(1); // untouched default — the setter found nothing to act on
  });

  it('turning the mic on while deafened clears deafened state and unmutes remote audio', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const mockElement = document.createElement('audio');
    onTrackSubscribed(
      { kind: 'audio', sid: 'track-1', attach: vi.fn().mockReturnValue(mockElement) },
      {},
      { identity: 'remote-user', name: 'Remote User' },
    );

    voiceClient.toggleDeafen();
    await Promise.resolve();
    await Promise.resolve();
    expect(room.localParticipant.isMicrophoneEnabled).toBe(false);

    voiceClient.toggleMute();
    await Promise.resolve();
    await Promise.resolve();

    expect(room.localParticipant.isMicrophoneEnabled).toBe(true);
    expect(useVoiceStore.getState().isDeafened).toBe(false);
    expect(mockElement.muted).toBe(false);
  });

  it('a remote audio track subscribed while deafened starts muted', async () => {
    await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
    voiceClient.toggleDeafen();
    await Promise.resolve();
    await Promise.resolve();
    const room = roomInstances[0];
    const onTrackSubscribed = handlerFor(room, 'trackSubscribed');
    const mockElement = document.createElement('audio');

    onTrackSubscribed(
      { kind: 'audio', sid: 'track-2', attach: vi.fn().mockReturnValue(mockElement) },
      {},
      { identity: 'remote-user-2', name: 'Remote User 2' },
    );

    expect(mockElement.muted).toBe(true);
  });

  describe('voice presence reporting', () => {
    it('reports its own presence over the app WebSocket after connecting', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      });
    });

    it('does not send a duplicate report when a resync leaves the local state unchanged', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();
      const room = roomInstances[0];

      // A remote-only event still triggers syncParticipants(), but the local participant's own
      // state hasn't changed, so no new report should be sent.
      const onParticipantConnected = handlerFor(room, 'participantConnected');
      onParticipantConnected();

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('reports an updated payload when the microphone is muted', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();

      voiceClient.toggleMute();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      });
    });

    it('reports an updated payload when the camera is turned on', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();

      voiceClient.toggleCamera();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: false, cameraOn: true, screenSharing: false, speaking: false, deafened: false },
      });
    });

    it('reports an updated payload when screen sharing starts', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();

      voiceClient.toggleScreenShare();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: false, cameraOn: false, screenSharing: true, speaking: false, deafened: false },
      });
    });

    it('reports speaking: true when the local participant becomes an active speaker', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();
      const room = roomInstances[0];

      const onActiveSpeakersChanged = handlerFor(room, 'activeSpeakersChanged');
      onActiveSpeakersChanged([room.localParticipant]);

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: false, cameraOn: false, screenSharing: false, speaking: true, deafened: false },
      });
    });

    it('reports speaking: false once the local participant stops being an active speaker', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      const onActiveSpeakersChanged = handlerFor(room, 'activeSpeakersChanged');
      onActiveSpeakersChanged([room.localParticipant]);
      mockSend.mockClear();

      onActiveSpeakersChanged([]);

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      });
    });

    it('reports deafened: true when deafening (mic already on)', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();

      voiceClient.toggleDeafen();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: true },
      });
    });

    it('reports deafened: true when deafening while already muted (regression: previously never reported)', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      voiceClient.toggleMute();
      await Promise.resolve();
      await Promise.resolve();
      mockSend.mockClear();

      voiceClient.toggleDeafen();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: true },
      });
    });

    it('reports deafened: false after un-deafening', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      voiceClient.toggleDeafen();
      await Promise.resolve();
      await Promise.resolve();
      mockSend.mockClear();

      voiceClient.toggleDeafen();

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-1', muted: true, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      });
    });

    it('sends VOICE_PRESENCE_LEAVE for the connected channel on disconnect', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockSend.mockClear();

      voiceClient.disconnect();

      expect(mockSend).toHaveBeenCalledWith({ type: 'VOICE_PRESENCE_LEAVE', payload: {} });
    });

    it('does not send VOICE_PRESENCE_LEAVE when disconnect() is called without an active connection', () => {
      voiceClient.disconnect();

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends VOICE_PRESENCE_LEAVE for the old channel before reporting presence on the new one when switching channels', async () => {
      await connectVoice('channel-1', 'token-a', 'wss://example.test/livekit');
      mockSend.mockClear();

      await connectVoice('channel-2', 'token-b', 'wss://example.test/livekit');

      expect(mockSend.mock.calls[0]).toEqual([{ type: 'VOICE_PRESENCE_LEAVE', payload: {} }]);
      expect(mockSend.mock.calls.at(-1)).toEqual([{
        type: 'VOICE_PRESENCE_UPDATE',
        payload: { channelId: 'channel-2', muted: false, cameraOn: false, screenSharing: false, speaking: false, deafened: false },
      }]);
    });
  });

  describe('sound notifications', () => {
    it('plays a self-join sound after connecting', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

      expect(mockPlaySelfJoin).toHaveBeenCalledTimes(1);
    });

    it('plays a self-leave sound when disconnect() is called explicitly', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      mockPlaySelfJoin.mockClear();

      voiceClient.disconnect();

      expect(mockPlaySelfLeave).toHaveBeenCalledTimes(1);
    });

    it('does not play a self-leave sound when disconnect() is called without an active connection', () => {
      voiceClient.disconnect();

      expect(mockPlaySelfLeave).not.toHaveBeenCalled();
    });

    it('plays self-join for the new channel but not self-leave for the old one when switching channels', async () => {
      await connectVoice('channel-1', 'token-a', 'wss://example.test/livekit');
      mockPlaySelfJoin.mockClear();

      await connectVoice('channel-2', 'token-b', 'wss://example.test/livekit');

      expect(mockPlaySelfLeave).not.toHaveBeenCalled();
      expect(mockPlaySelfJoin).toHaveBeenCalledTimes(1);
    });

    it('does not play a join sound for a participant already in the room at connect time', async () => {
      const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.remoteParticipants.set('bob', remoteParticipant('bob'));
      connectResolvers[connectResolvers.length - 1]();
      await promise;

      expect(mockPlayParticipantJoined).not.toHaveBeenCalled();
    });

    it('plays a join sound when a participant connects after the initial sync', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.remoteParticipants.set('bob', remoteParticipant('bob'));

      const onParticipantConnected = handlerFor(room, 'participantConnected');
      onParticipantConnected();

      expect(mockPlayParticipantJoined).toHaveBeenCalledTimes(1);
    });

    it('plays a leave sound when a participant disconnects', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.remoteParticipants.set('bob', remoteParticipant('bob'));
      handlerFor(room, 'participantConnected')();
      mockPlayParticipantJoined.mockClear();

      room.remoteParticipants.delete('bob');
      const onParticipantDisconnected = handlerFor(room, 'participantDisconnected');
      onParticipantDisconnected();

      expect(mockPlayParticipantLeft).toHaveBeenCalledTimes(1);
    });

    it('does not play a join or leave sound for an event that does not change who is in the room', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.remoteParticipants.set('bob', remoteParticipant('bob'));
      handlerFor(room, 'participantConnected')();
      mockPlayParticipantJoined.mockClear();

      const onTrackMuted = handlerFor(room, 'trackMuted');
      onTrackMuted();

      expect(mockPlayParticipantJoined).not.toHaveBeenCalled();
      expect(mockPlayParticipantLeft).not.toHaveBeenCalled();
    });

    it('treats participants in a freshly connected channel as already present, not as new joins, after a previous disconnect', async () => {
      await connectVoice('channel-1', 'token-a', 'wss://example.test/livekit');
      voiceClient.disconnect();
      mockPlayParticipantJoined.mockClear();

      const promise = voiceClient.connect('channel-2', 'token-b', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.remoteParticipants.set('carol', remoteParticipant('carol'));
      connectResolvers[connectResolvers.length - 1]();
      await promise;

      expect(mockPlayParticipantJoined).not.toHaveBeenCalled();
    });
  });

  describe('noise suppression', () => {
    beforeEach(() => {
      mockCreateNoiseSuppressionProcessor.mockClear();
      mockIsNoiseSuppressionSupported.mockReset().mockReturnValue(true);
      mockGetNoiseSuppressionPreference.mockReset().mockReturnValue(true);
    });

    it('applies the noise suppression processor to the mic track after connecting, when the preference is enabled', async () => {
      const track = mockAudioTrack();
      const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );
      connectResolvers[connectResolvers.length - 1]();
      await promise;

      expect(track.setProcessor).toHaveBeenCalledWith({ name: 'noise-suppression' });
    });

    it('does not apply the processor after connecting when the preference is disabled', async () => {
      mockGetNoiseSuppressionPreference.mockReturnValue(false);
      const track = mockAudioTrack();
      const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );
      connectResolvers[connectResolvers.length - 1]();
      await promise;

      expect(track.setProcessor).not.toHaveBeenCalled();
      expect(track.stopProcessor).toHaveBeenCalled();
    });

    it('does not apply the processor when the browser does not support it', async () => {
      mockIsNoiseSuppressionSupported.mockReturnValue(false);
      const track = mockAudioTrack();
      const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );
      connectResolvers[connectResolvers.length - 1]();
      await promise;

      expect(track.setProcessor).not.toHaveBeenCalled();
    });

    it('does not throw when the processor fails to initialize, and the call keeps working', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const track = mockAudioTrack();
      track.setProcessor.mockRejectedValue(new Error('AudioWorklet failed to load'));
      const promise = voiceClient.connect('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[roomInstances.length - 1];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );
      connectResolvers[connectResolvers.length - 1]();

      await expect(promise).resolves.toBeUndefined();
      expect(useVoiceStore.getState().status).toBe('connected');
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to enable noise suppression; continuing without it',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('does nothing when there is no published microphone track', async () => {
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');

      await expect(voiceClient.setNoiseSuppressionEnabled(true)).resolves.toBeUndefined();
    });

    it('re-applies the processor when the microphone is re-enabled via toggleMute', async () => {
      const track = mockAudioTrack();
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );
      track.setProcessor.mockClear();

      voiceClient.toggleMute(); // off
      await Promise.resolve();
      await Promise.resolve();
      voiceClient.toggleMute(); // back on
      await Promise.resolve();
      await Promise.resolve();

      expect(track.setProcessor).toHaveBeenCalledWith({ name: 'noise-suppression' });
    });

    it('setNoiseSuppressionEnabled(true) applies the processor directly, e.g. from the Settings toggle', async () => {
      const track = mockAudioTrack();
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );

      await voiceClient.setNoiseSuppressionEnabled(true);

      expect(track.setProcessor).toHaveBeenCalledWith({ name: 'noise-suppression' });
    });

    it('setNoiseSuppressionEnabled(false) removes the processor directly, e.g. from the Settings toggle', async () => {
      const track = mockAudioTrack();
      await connectVoice('channel-1', 'token', 'wss://example.test/livekit');
      const room = roomInstances[0];
      room.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track } : undefined,
      );

      await voiceClient.setNoiseSuppressionEnabled(false);

      expect(track.stopProcessor).toHaveBeenCalled();
      expect(track.setProcessor).not.toHaveBeenCalled();
    });

    it('does not apply noise suppression on behalf of a connect() attempt superseded while its own mic-enable is still in flight', async () => {
      // Pins the race the code review flagged: applyNoiseSuppressionPreference() reads
      // `this.room` (the CURRENT room field), not a value captured at the start of this specific
      // connect() call. So if a stale connect()'s own setMicrophoneEnabled(true) is still
      // pending when a newer connect() fully supersedes it — reassigning `this.room` to the new
      // room in the meantime — the stale call must not touch anything once its mic-enable
      // finally resolves. `setMicrophoneEnabled` here is given a manually-resolved promise
      // (instead of the mock's usual auto-resolving one) specifically so this ordering is
      // controlled directly, rather than relying on incidental microtask-queue timing.
      const track1 = mockAudioTrack();
      const track2 = mockAudioTrack();
      let resolveMic1: () => void = () => {};

      const first = voiceClient.connect('channel-1', 'token-a', 'wss://example.test/livekit');
      const room1 = roomInstances[roomInstances.length - 1];
      room1.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track1 } : undefined,
      );
      room1.localParticipant.setMicrophoneEnabled = vi.fn(
        () => new Promise<undefined>((resolve) => { resolveMic1 = () => resolve(undefined); }),
      );
      connectResolvers[connectResolvers.length - 1](); // resolves room1.connect()
      await Promise.resolve(); // lets first's connect() reach `this.room = room1` and call setMicrophoneEnabled(true), which now hangs on resolveMic1

      // A second connect() fully supersedes and completes — e.g. the user switched channels again
      // while the first was still stuck waiting on the mic permission prompt — reassigning
      // `this.room` to room2 well before the first's mic-enable ever resolves.
      const second = voiceClient.connect('channel-2', 'token-b', 'wss://example.test/livekit');
      const room2 = roomInstances[roomInstances.length - 1];
      room2.localParticipant.getTrackPublication = vi.fn((source?: string) =>
        source === 'microphone' ? { audioTrack: track2 } : undefined,
      );
      connectResolvers[connectResolvers.length - 1](); // resolves room2.connect()
      await second;

      // Only now does the stale first connect()'s long-pending mic-enable resolve.
      resolveMic1();
      await first;

      expect(track1.setProcessor).not.toHaveBeenCalled();
      expect(track1.stopProcessor).not.toHaveBeenCalled();
      // Exactly once (from the legitimate second connect()) — without the generation guard, the
      // stale first connect() would read `this.room` (by then reassigned to room2) and apply the
      // processor to room2's track a second, redundant time.
      expect(track2.setProcessor).toHaveBeenCalledTimes(1);
    });
  });
});

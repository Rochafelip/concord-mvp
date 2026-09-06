import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { websocketClient } from './websocketClient';
import * as soundEffects from './soundEffects';
import { SCREEN_SHARE_QUALITY_PRESETS } from '../features/calls/screenShareQuality';
import { useVoiceStore } from '../stores/voiceStore';
import type { ScreenShareOptions, VoiceParticipant } from '../types/voice';

function audioKey(identity: string, source: Track.Source): string {
  return `${identity}:${source}`;
}

interface ReportedPresence {
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  speaking: boolean;
}

/**
 * Thin wrapper around livekit-client's `Room`. A single instance (the singleton exported below)
 * owns the actual media connection; components only ever touch the reactive `voiceStore` — same
 * "service owns the imperative connection, store holds reactive state" split as
 * websocketClient.ts/wsConnectionStore.ts.
 */
class VoiceClient {
  private room: Room | null = null;
  private audioElements = new Map<string, HTMLMediaElement>();
  // Bumped on every connect()/disconnect() so an in-flight connect() that resolves after being
  // superseded by a newer one (e.g. rapid channel switching) can recognize it's stale and back
  // off instead of clobbering the newer connection — last-clicked wins, not last-resolved.
  private connectGeneration = 0;
  // The channel a VOICE_PRESENCE_LEAVE should be reported for on disconnect — tracked separately
  // from voiceStore so it survives up to the point disconnect() calls reset().
  private currentChannelId: string | null = null;
  private lastReportedPresence: ReportedPresence | null = null;
  private localSpeaking = false;
  // Tracks remote participant identities across syncParticipants() calls so join/leave sounds can
  // be diffed against the previous sync rather than played for everyone already in the room.
  private knownRemoteIds = new Set<string>();
  // False until the first syncParticipants() after a connect has run once — that first call only
  // seeds knownRemoteIds from whoever's already in the room, without playing any join sounds,
  // since they didn't just join, they were already there when we connected.
  private hasSeededRemoteIds = false;

  async connect(channelId: string, token: string, url: string): Promise<void> {
    if (this.room) {
      // disconnect() also bumps connectGeneration, invalidating any older in-flight connect()
      // still running — this call's own generation is captured AFTER that, below. silent: true
      // since this is an internal teardown ahead of the new connection below, not a real "leave"
      // — playSelfLeave() must not fire for it (only the explicit-disconnect path plays that).
      this.disconnect({ silent: true });
    }
    const generation = ++this.connectGeneration;
    this.currentChannelId = channelId;

    useVoiceStore.getState().setError(null);
    useVoiceStore.getState().setStatus('connecting', channelId);

    const room = new Room();
    this.registerListeners(room);

    try {
      await room.connect(url, token);
    } catch {
      if (generation === this.connectGeneration) {
        useVoiceStore.getState().setError('Failed to connect to voice channel');
        useVoiceStore.getState().setStatus('disconnected', null);
        this.currentChannelId = null;
      } else {
        abandonRoom(room);
      }
      return;
    }

    if (generation !== this.connectGeneration) {
      abandonRoom(room);
      return;
    }
    this.room = room;

    try {
      // Mic ON by default: this is what actually triggers the getUserMedia permission prompt.
      // A denial must not tear down the room connection — the user is still "in" the voice
      // channel, just without a mic published (PRODUCT.md §16: surface the error, don't
      // silently fail, don't kill the session).
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch {
      if (generation === this.connectGeneration) {
        useVoiceStore.getState().setError('Microphone permission denied');
      }
    }

    if (generation !== this.connectGeneration) {
      abandonRoom(room);
      return;
    }

    useVoiceStore.getState().setStatus('connected', channelId);
    soundEffects.playSelfJoin();
    this.syncParticipants();
  }

  disconnect(options: { silent?: boolean } = {}): void {
    this.connectGeneration++;
    if (this.room) {
      abandonRoom(this.room);
    }
    this.room = null;
    if (this.currentChannelId) {
      websocketClient.send({ type: 'VOICE_PRESENCE_LEAVE', payload: {} });
      if (!options.silent) {
        soundEffects.playSelfLeave();
      }
    }
    this.currentChannelId = null;
    this.lastReportedPresence = null;
    this.localSpeaking = false;
    this.knownRemoteIds = new Set();
    this.hasSeededRemoteIds = false;
    // Removed proactively rather than left for the room's own TrackUnsubscribed events to clean
    // up: livekit-client's real Room.disconnect() awaits a server round-trip before emitting
    // those, so relying on them here would leak these elements for the entire duration of that
    // round-trip — routine on every channel switch, not just a final "leave".
    this.audioElements.forEach((element) => element.remove());
    this.audioElements.clear();
    useVoiceStore.getState().reset();
  }

  toggleMute(): void {
    const localParticipant = this.room?.localParticipant;
    if (!localParticipant) return;
    const enabling = !localParticipant.isMicrophoneEnabled;
    localParticipant
      .setMicrophoneEnabled(enabling)
      .then(() => {
        this.syncParticipants();
        if (enabling) this.setDeafened(false);
      })
      .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
  }

  /**
   * Deafen is a purely local concept — LiveKit has no server-side notion of it. Deafening mutes
   * every remote participant's <audio> element in this browser only (nobody else is affected)
   * and, like Discord, also mutes the local mic if it's on — there's no reason to keep
   * broadcasting audio you can't hear a response to. Un-deafening restores remote audio but
   * deliberately does NOT re-enable the mic; toggleMute() above clears isDeafened instead when
   * the user explicitly unmutes, so audio is never silently turned back on by itself.
   */
  toggleDeafen(): void {
    const deafening = !useVoiceStore.getState().isDeafened;
    this.setDeafened(deafening);
    if (deafening && this.room?.localParticipant.isMicrophoneEnabled) {
      this.room.localParticipant
        .setMicrophoneEnabled(false)
        .then(() => this.syncParticipants())
        .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
    }
  }

  // Unlike the microphone (enabled automatically on connect, see connect() above), the camera is
  // never enabled by default — PRODUCT.md §11.1 frames it as an explicit user action, and there's
  // no reason to prompt for camera permission before the user has asked for video.
  toggleCamera(): void {
    const localParticipant = this.room?.localParticipant;
    if (!localParticipant) return;
    localParticipant
      .setCameraEnabled(!localParticipant.isCameraEnabled)
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change camera state'));
  }

  // Off by default, same reasoning as the camera — starting a share is always an explicit user
  // action (PRODUCT.md §12.1). A rejection here covers both an OS/browser permission denial and
  // the user dismissing the screen/window picker without selecting anything — both surface as a
  // rejected promise from setScreenShareEnabled, so there's no need to tell them apart.
  //
  // `options` is only meaningful when starting a share; it's ignored when stopping one. The
  // single-argument call shape is preserved whenever there's nothing to apply (stopping, or a
  // caller that doesn't pass options) so existing behavior for those cases is unchanged. `audio`
  // is included in the capture options only when explicitly requested — Chrome's native
  // screen/window picker only shows its own "Share audio" checkbox when an audio capture option
  // is present at all, so passing `audio: false` would show browser UI that doesn't match what
  // was chosen in our modal.
  toggleScreenShare(options?: ScreenShareOptions): void {
    const localParticipant = this.room?.localParticipant;
    if (!localParticipant) return;
    const enabling = !localParticipant.isScreenShareEnabled;
    const promise =
      enabling && options
        ? localParticipant.setScreenShareEnabled(true, {
            resolution: SCREEN_SHARE_QUALITY_PRESETS[options.quality],
            ...(options.withAudio ? { audio: true } : {}),
          })
        : localParticipant.setScreenShareEnabled(enabling);
    promise
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change screen sharing state'));
  }

  setParticipantVolume(identity: string, volume: number): void {
    const element = this.audioElements.get(audioKey(identity, Track.Source.Microphone));
    if (element) element.volume = volume;
  }

  setScreenShareVolume(identity: string, volume: number): void {
    const element = this.audioElements.get(audioKey(identity, Track.Source.ScreenShareAudio));
    if (element) element.volume = volume;
  }

  private setDeafened(value: boolean): void {
    useVoiceStore.getState().setDeafened(value);
    this.audioElements.forEach((element) => {
      element.muted = value;
    });
  }

  private registerListeners(room: Room): void {
    room.on(RoomEvent.ParticipantConnected, this.syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, this.syncParticipants);
    room.on(RoomEvent.TrackMuted, this.syncParticipants);
    room.on(RoomEvent.TrackUnmuted, this.syncParticipants);
    room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed);
    // livekit-client detects a screen-share track ending outside our own toggle*() call (e.g.
    // the browser's native "Stop sharing" control) and unpublishes it itself, firing this event.
    // Without listening for it, the store would keep showing the local participant as still
    // sharing after the browser already stopped it, until some unrelated event happened to
    // trigger a resync — the same class of staleness bug already fixed once for remote mic state
    // (see the "fix: resync participant mic state on track subscribe" commit), now closed for
    // this local-unpublish case too. (Camera/mic device loss is a separate path — livekit-client
    // tries restartTrack() first and falls back to muting rather than unpublishing, so that case
    // is already covered by the existing TrackMuted listener above, not this one.)
    room.on(RoomEvent.LocalTrackUnpublished, this.syncParticipants);
    // Feeds VoiceParticipant.connectionQuality (surfaced by VoiceConnectionBar's quality icon) —
    // same "resync on change" pattern as every other listener in this method.
    room.on(RoomEvent.ConnectionQualityChanged, this.syncParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakersChanged);
  }

  private handleActiveSpeakersChanged = (speakers: Participant[]): void => {
    const room = this.room;
    if (!room) return;
    this.localSpeaking = speakers.includes(room.localParticipant);
    this.reportPresenceIfChanged();
  };

  // A subscribed remote audio track is not audible until it is attached to a media element —
  // LiveKit does not do this automatically. Attached to a hidden element in the document body,
  // since audio has no on-screen representation. Video tracks (camera or screen share) are
  // handled differently: they're attached directly by ParticipantTile/ScreenShareTile to a
  // visible <video> element they own, so no DOM element is created for them here — this handler
  // only needs to make sure a resync happens so tiles pick up the new videoTrack/screenShareTrack
  // reference (via toVoiceParticipant below).
  //
  // The resync also matters for audio: a remote participant's ParticipantConnected can fire
  // before their mic track is actually published (found via manual two-browser testing, not a
  // mock), so the isMicrophoneEnabled snapshot taken at that moment reads false. Without a resync
  // on subscribe, the UI would show them as muted indefinitely — until they happened to
  // explicitly toggle mute once and trigger TrackMuted/TrackUnmuted.
  private handleTrackSubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void => {
    if (track.kind === Track.Kind.Audio) {
      const element = track.attach();
      element.muted = useVoiceStore.getState().isDeafened;
      element.dataset.trackSid = track.sid ?? '';
      document.body.appendChild(element);
      this.audioElements.set(audioKey(participant.identity, track.source), element);
    }
    this.syncParticipants();
  };

  private handleTrackUnsubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void => {
    const key = audioKey(participant.identity, track.source);
    const element = this.audioElements.get(key);
    if (element) {
      track.detach(element);
      element.remove();
      this.audioElements.delete(key);
    }
    this.syncParticipants();
  };

  private syncParticipants = (): void => {
    const room = this.room;
    if (!room) return;

    const currentRemoteIds = new Set(room.remoteParticipants.keys());
    if (this.hasSeededRemoteIds) {
      for (const id of currentRemoteIds) {
        if (!this.knownRemoteIds.has(id)) soundEffects.playParticipantJoined();
      }
      for (const id of this.knownRemoteIds) {
        if (!currentRemoteIds.has(id)) soundEffects.playParticipantLeft();
      }
    }
    this.knownRemoteIds = currentRemoteIds;
    this.hasSeededRemoteIds = true;

    const participants: VoiceParticipant[] = [
      toVoiceParticipant(room.localParticipant, true),
      ...Array.from(room.remoteParticipants.values(), (p) => toVoiceParticipant(p, false)),
    ];

    useVoiceStore.getState().setParticipants(participants);
    this.reportPresenceIfChanged();
  };

  // Reports the local participant's own state to the rest of the server over the app WebSocket
  // (docs/superpowers/specs/2026-09-04-voice-channel-participant-preview-design.md §3.1/§4.4) —
  // only when it actually changed, since this runs on every resync, including ones triggered by
  // a remote participant's activity that leaves the local participant's own state untouched.
  private reportPresenceIfChanged(): void {
    const room = this.room;
    if (!room || !this.currentChannelId) return;

    const current: ReportedPresence = {
      muted: !room.localParticipant.isMicrophoneEnabled,
      cameraOn: room.localParticipant.isCameraEnabled,
      screenSharing: room.localParticipant.isScreenShareEnabled,
      speaking: this.localSpeaking,
    };

    if (
      this.lastReportedPresence != null &&
      this.lastReportedPresence.muted === current.muted &&
      this.lastReportedPresence.cameraOn === current.cameraOn &&
      this.lastReportedPresence.screenSharing === current.screenSharing &&
      this.lastReportedPresence.speaking === current.speaking
    ) {
      return;
    }

    this.lastReportedPresence = current;
    websocketClient.send({
      type: 'VOICE_PRESENCE_UPDATE',
      payload: { channelId: this.currentChannelId, ...current },
    });
  }
}

// room.disconnect() is async (it awaits a server round-trip) and can reject — e.g. if the
// signaling connection was already broken. These call sites are all fire-and-forget cleanup of
// a room nothing references anymore, so a rejection here has nothing useful to surface to the
// user; the only thing that matters is it doesn't escape as an unhandled promise rejection.
function abandonRoom(room: Room): void {
  room.disconnect().catch(() => {});
}

function toVoiceParticipant(participant: Participant | LocalParticipant, isLocal: boolean): VoiceParticipant {
  return {
    identity: participant.identity,
    name: participant.name ?? participant.identity,
    isLocal,
    micEnabled: participant.isMicrophoneEnabled,
    cameraEnabled: participant.isCameraEnabled,
    videoTrack: participant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
    screenShareEnabled: participant.isScreenShareEnabled,
    screenShareTrack: participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack ?? null,
    screenShareHasAudio: participant.getTrackPublication(Track.Source.ScreenShareAudio) != null,
    connectionQuality: participant.connectionQuality,
  };
}

export const voiceClient = new VoiceClient();

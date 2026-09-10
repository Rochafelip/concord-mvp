import {
  AudioPresets,
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
import { createNoiseSuppressionProcessor, isNoiseSuppressionSupported } from './audio/noiseSuppression';
import { SCREEN_SHARE_QUALITY_PRESETS } from '../features/calls/screenShareQuality';
import { getNoiseSuppressionPreference } from '../features/settings/audio/noiseSuppressionPreference';
import { useVoiceStore } from '../stores/voiceStore';
import type { ScreenShareOptions, VoiceParticipant } from '../types/voice';

function audioKey(identity: string, source: Track.Source): string {
  return `${identity}:${source}`;
}

function identitySetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const identity of a) {
    if (!b.has(identity)) return false;
  }
  return true;
}

interface ReportedPresence {
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  speaking: boolean;
  deafened: boolean;
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
  // Identities of every participant (local or remote) LiveKit currently considers an active
  // speaker, from RoomEvent.ActiveSpeakersChanged — feeds VoiceParticipant.speaking so
  // ParticipantTile's highlight ring tracks live audio the same way ChannelSidebar's does,
  // instead of being permanently on for the local participant regardless of activity.
  private speakingIdentities = new Set<string>();
  // Tracks remote participant identities across syncParticipants() calls so join/leave sounds can
  // be diffed against the previous sync rather than played for everyone already in the room.
  private knownRemoteIds = new Set<string>();
  // False until the first syncParticipants() after a connect has run once — that first call only
  // seeds knownRemoteIds from whoever's already in the room, without playing any join sounds,
  // since they didn't just join, they were already there when we connected.
  private hasSeededRemoteIds = false;

  // Synchronous half of connect(): bumps the generation guard and flips the store to
  // "connecting" immediately, before any async work happens. Split out from connect() itself so
  // a caller that first fetches something async (a voice token) can capture the generation
  // *before* that fetch starts — otherwise a disconnect() that happens mid-fetch would bump
  // connectGeneration too late to be seen by the connect() call that follows once the fetch
  // resolves, and the user would be silently reconnected to the channel they just left.
  beginConnect(channelId: string): number {
    if (this.room) {
      // disconnect() also bumps connectGeneration, invalidating any older in-flight connect()
      // still running — this call's own generation is captured AFTER that, below. silent: true
      // since this is an internal teardown ahead of the new connection below, not a real "leave"
      // — playSelfLeave() must not fire for it (only the explicit-disconnect path plays that).
      this.disconnect({ silent: true });
    }
    this.connectGeneration++;
    this.currentChannelId = channelId;

    useVoiceStore.getState().setError(null);
    useVoiceStore.getState().setStatus('connecting', channelId);

    return this.connectGeneration;
  }

  // `generation` defaults to a freshly-begun one so direct callers (existing call sites, tests)
  // that don't have an async gap between deciding to connect and calling this keep working
  // unchanged. A caller with an async gap (useJoinVoiceChannel, fetching a token first) must call
  // beginConnect() itself beforehand and pass the result here — see beginConnect's comment.
  async connect(
    channelId: string,
    token: string,
    url: string,
    generation: number = this.beginConnect(channelId),
  ): Promise<void> {
    if (generation !== this.connectGeneration) return;

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
      if (generation === this.connectGeneration) {
        this.applyNoiseSuppressionPreference();
      }
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
    this.speakingIdentities = new Set();
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
        if (enabling) {
          this.setDeafened(false);
          this.applyNoiseSuppressionPreference();
        }
      })
      .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
  }

  /**
   * Deafen is a purely local concept — LiveKit has no server-side notion of it. Deafening mutes
   * every remote participant's <audio> element in this browser only (nobody else is affected)
   * and, like Discord, also mutes the local mic if it's on — there's no reason to keep
   * broadcasting audio you can't hear a response to. Un-deafening restores remote audio and also
   * re-enables the mic unconditionally, so the user always comes out of deafen ready to talk
   * rather than silently still muted. The deafened state is also reported to other participants
   * via the voice-presence broadcast below.
   */
  toggleDeafen(): void {
    const deafening = !useVoiceStore.getState().isDeafened;
    this.setDeafened(deafening);
    const localParticipant = this.room?.localParticipant;
    if (deafening && localParticipant?.isMicrophoneEnabled) {
      localParticipant
        .setMicrophoneEnabled(false)
        .then(() => this.syncParticipants())
        .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
    } else if (!deafening && localParticipant) {
      localParticipant
        .setMicrophoneEnabled(true)
        .then(() => {
          this.syncParticipants();
          this.applyNoiseSuppressionPreference();
        })
        .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
    } else {
      this.reportPresenceIfChanged();
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

  async setNoiseSuppressionEnabled(enabled: boolean): Promise<void> {
    const track = this.room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
    if (!track) return;

    if (!enabled) {
      await track.stopProcessor().catch((error: unknown) => {
        console.warn('Failed to remove noise suppression processor', error);
      });
      return;
    }
    if (!isNoiseSuppressionSupported()) return;
    try {
      await track.setProcessor(createNoiseSuppressionProcessor());
    } catch (error) {
      // WASM/AudioWorklet failure — the call keeps working on the unprocessed track.
      console.warn('Failed to enable noise suppression; continuing without it', error);
    }
  }

  private applyNoiseSuppressionPreference(): void {
    void this.setNoiseSuppressionEnabled(getNoiseSuppressionPreference());
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
  //
  // When audio is requested, both the capture constraints and the publish options are overridden
  // rather than left at LiveKit's defaults. Room-wide publishDefaults (48kbps mono + dtx) are
  // tuned for mic/speech; dtx in particular is a voice-activity-detection silence gate that isn't
  // meant for continuous non-speech audio (music, game/video sound) and, combined with the low
  // mono bitrate, was the cause of reported muffled/degraded stream audio. autoGainControl/
  // echoCancellation/noiseSuppression are similarly mic-oriented processing that must be disabled
  // on capture, since some browsers apply them to display-capture audio by default otherwise.
  toggleScreenShare(options?: ScreenShareOptions): void {
    const localParticipant = this.room?.localParticipant;
    if (!localParticipant) return;
    const enabling = !localParticipant.isScreenShareEnabled;
    const promise =
      enabling && options
        ? options.withAudio
          ? localParticipant.setScreenShareEnabled(
              true,
              {
                resolution: SCREEN_SHARE_QUALITY_PRESETS[options.quality],
                audio: {
                  autoGainControl: false,
                  echoCancellation: false,
                  noiseSuppression: false,
                  channelCount: 2,
                },
              },
              { audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: true, forceStereo: true },
            )
          : localParticipant.setScreenShareEnabled(true, {
              resolution: SCREEN_SHARE_QUALITY_PRESETS[options.quality],
            })
        : localParticipant.setScreenShareEnabled(enabling);
    promise
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change screen sharing state'));
  }

  // Mutes/unmutes the local screen-share-audio publication in place, rather than restarting the
  // whole share (which would require going through the capture picker again) — LiveKit's
  // TrackMuted/TrackUnmuted events fire for local tracks too, and registerListeners already
  // resyncs on those, so no new event wiring is needed here.
  toggleScreenShareAudio(): void {
    const publication = this.room?.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
    if (!publication) return;
    const promise = publication.isMuted ? publication.unmute() : publication.mute();
    promise
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change screen share audio state'));
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
    const nextSpeakingIdentities = new Set(speakers.map((speaker) => speaker.identity));
    // LiveKit re-emits this event on every audio-level-driven reorder of `activeSpeakers`, not
    // just when who's-speaking membership actually changes — skip the resync below when the set
    // is unchanged so tiles aren't rebuilt/re-rendered on every level tick while someone talks.
    if (identitySetsEqual(nextSpeakingIdentities, this.speakingIdentities)) return;
    this.speakingIdentities = nextSpeakingIdentities;
    this.localSpeaking = this.speakingIdentities.has(room.localParticipant.identity);
    // Resyncs (not just reportPresenceIfChanged) so every tile's `speaking` flag — local and
    // remote — picks up the change; reportPresenceIfChanged alone only broadcasts the local
    // participant's own state for the sidebar and wouldn't touch the grid's store data.
    this.syncParticipants();
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
      toVoiceParticipant(room.localParticipant, true, this.speakingIdentities.has(room.localParticipant.identity)),
      ...Array.from(room.remoteParticipants.values(), (p) =>
        toVoiceParticipant(p, false, this.speakingIdentities.has(p.identity)),
      ),
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
      deafened: useVoiceStore.getState().isDeafened,
    };

    if (
      this.lastReportedPresence != null &&
      this.lastReportedPresence.muted === current.muted &&
      this.lastReportedPresence.cameraOn === current.cameraOn &&
      this.lastReportedPresence.screenSharing === current.screenSharing &&
      this.lastReportedPresence.speaking === current.speaking &&
      this.lastReportedPresence.deafened === current.deafened
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

function toVoiceParticipant(
  participant: Participant | LocalParticipant,
  isLocal: boolean,
  speaking: boolean,
): VoiceParticipant {
  const screenShareAudioPublication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
  return {
    identity: participant.identity,
    name: participant.name ?? participant.identity,
    isLocal,
    micEnabled: participant.isMicrophoneEnabled,
    cameraEnabled: participant.isCameraEnabled,
    videoTrack: participant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
    screenShareEnabled: participant.isScreenShareEnabled,
    screenShareTrack: participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack ?? null,
    screenShareHasAudio: screenShareAudioPublication != null,
    screenShareAudioEnabled: screenShareAudioPublication != null && !screenShareAudioPublication.isMuted,
    connectionQuality: participant.connectionQuality,
    speaking,
  };
}

export const voiceClient = new VoiceClient();

import { Room, RoomEvent, Track, type LocalParticipant, type Participant, type RemoteTrack } from 'livekit-client';
import { useVoiceStore } from '../stores/voiceStore';
import type { VoiceParticipant } from '../types/voice';

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

  async connect(channelId: string, token: string, url: string): Promise<void> {
    if (this.room) {
      // disconnect() also bumps connectGeneration, invalidating any older in-flight connect()
      // still running — this call's own generation is captured AFTER that, below.
      this.disconnect();
    }
    const generation = ++this.connectGeneration;

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
    this.syncParticipants();
  }

  disconnect(): void {
    this.connectGeneration++;
    if (this.room) {
      abandonRoom(this.room);
    }
    this.room = null;
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
    localParticipant
      .setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change microphone state'));
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
  toggleScreenShare(): void {
    const localParticipant = this.room?.localParticipant;
    if (!localParticipant) return;
    localParticipant
      .setScreenShareEnabled(!localParticipant.isScreenShareEnabled)
      .then(() => this.syncParticipants())
      .catch(() => useVoiceStore.getState().setError('Failed to change screen sharing state'));
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
  }

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
  private handleTrackSubscribed = (track: RemoteTrack): void => {
    if (track.kind === Track.Kind.Audio && track.sid) {
      const element = track.attach();
      element.dataset.trackSid = track.sid;
      document.body.appendChild(element);
      this.audioElements.set(track.sid, element);
    }
    this.syncParticipants();
  };

  private handleTrackUnsubscribed = (track: RemoteTrack): void => {
    if (!track.sid) return;
    const element = this.audioElements.get(track.sid);
    if (element) {
      track.detach(element);
      element.remove();
      this.audioElements.delete(track.sid);
    }
    this.syncParticipants();
  };

  private syncParticipants = (): void => {
    const room = this.room;
    if (!room) return;

    const participants: VoiceParticipant[] = [
      toVoiceParticipant(room.localParticipant, true),
      ...Array.from(room.remoteParticipants.values(), (p) => toVoiceParticipant(p, false)),
    ];

    useVoiceStore.getState().setParticipants(participants);
  };
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
  };
}

export const voiceClient = new VoiceClient();

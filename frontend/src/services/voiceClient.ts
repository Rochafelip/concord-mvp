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

  private registerListeners(room: Room): void {
    room.on(RoomEvent.ParticipantConnected, this.syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, this.syncParticipants);
    room.on(RoomEvent.TrackMuted, this.syncParticipants);
    room.on(RoomEvent.TrackUnmuted, this.syncParticipants);
    room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed);
  }

  // A subscribed remote audio track is not audible until it is attached to a media element —
  // LiveKit does not do this automatically. Attached to a hidden element in the document body
  // since this feature is audio-only (no video/screen tracks exist yet — later phases).
  private handleTrackSubscribed = (track: RemoteTrack): void => {
    if (track.kind !== Track.Kind.Audio || !track.sid) return;
    const element = track.attach();
    element.dataset.trackSid = track.sid;
    document.body.appendChild(element);
    this.audioElements.set(track.sid, element);
  };

  private handleTrackUnsubscribed = (track: RemoteTrack): void => {
    if (!track.sid) return;
    const element = this.audioElements.get(track.sid);
    if (!element) return;
    track.detach(element);
    element.remove();
    this.audioElements.delete(track.sid);
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
  };
}

export const voiceClient = new VoiceClient();

import { HeadphoneOff, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Avatar } from '../../components/Avatar';
import { voiceClient } from '../../services/voiceClient';
import type { VoiceParticipant } from '../../types/voice';
import { VolumeControl } from './VolumeControl';

interface ParticipantTileProps {
  participant: VoiceParticipant;
  /** Looked up by identity from voice presence data; undefined/null falls back to an initial letter. */
  avatarUrl?: string | null;
  /** From voice presence, looked up by identity in ParticipantList — defaults to false so tiles render correctly before the first presence fetch resolves. */
  deafened?: boolean;
}

// Literal colors (not theme tokens), same as the tile's other overlay chrome — must read the
// same in both themes, and must contrast with the white text/icons drawn on top.
const TILE_COLORS = [
  'bg-rose-900',
  'bg-orange-900',
  'bg-amber-900',
  'bg-emerald-900',
  'bg-cyan-900',
  'bg-blue-900',
  'bg-violet-900',
  'bg-fuchsia-900',
] as const;

/** Deterministic per-participant tile background: same identity always picks the same color. */
export function tileColorFor(identity: string): string {
  let hash = 0;
  for (let index = 0; index < identity.length; index++) {
    hash = (hash * 31 + identity.charCodeAt(index)) | 0;
  }
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

/**
 * Owns the actual <video> element for one participant's camera tile. Attaches/detaches the
 * livekit-client Track imperatively via a ref + effect — the standard way to bridge a track's
 * imperative attach(element)/detach(element) API into a React-owned DOM node. See the design
 * spec (docs/superpowers/specs/2026-09-03-phase3-camera-design.md §4.1) for why this was chosen
 * over having voiceClient manage video elements itself, the way it does for hidden audio
 * elements.
 *
 * The local participant's own controls (mic/camera/screen-share-audio/leave) live in
 * CallControlBar, rendered once by CallView, not here — see
 * docs/superpowers/specs/2026-09-08-call-view-control-bar-redesign-design.md.
 *
 * The tile background and control-bar chrome (black/white overlays) stay literal colors
 * rather than tokens — they sit on top of live video and must read the same in both themes.
 */
export function ParticipantTile({ participant, avatarUrl, deafened = false }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { videoTrack } = participant;

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  return (
    <div
      className={`group relative flex aspect-video items-center justify-center overflow-hidden rounded ${
        videoTrack ? 'bg-gray-800' : tileColorFor(participant.identity)
      } ${participant.isLocal ? 'ring-2 ring-brand' : ''}`}
    >
      {videoTrack ? (
        <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <Avatar displayName={participant.name} avatarUrl={avatarUrl} size="lg" />
      )}

      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-caption text-white">
        {deafened ? (
          <HeadphoneOff data-testid="deaf-status-on" size={12} aria-hidden="true" />
        ) : participant.micEnabled ? (
          <Mic data-testid="mic-status-on" size={12} aria-hidden="true" />
        ) : (
          <MicOff data-testid="mic-status-off" size={12} aria-hidden="true" />
        )}
        {participant.name}
        {participant.isLocal ? ' (you)' : ''}
      </span>

      {!participant.isLocal && (
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
          <VolumeControl
            label={participant.name}
            onVolumeChange={(volume) => voiceClient.setParticipantVolume(participant.identity, volume)}
          />
        </div>
      )}
    </div>
  );
}

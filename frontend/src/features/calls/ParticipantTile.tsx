import { useEffect, useRef } from 'react';
import type { VoiceParticipant } from '../../types/voice';

interface ParticipantTileProps {
  participant: VoiceParticipant;
}

/**
 * Owns the actual <video> element for one participant's camera tile. Attaches/detaches the
 * livekit-client Track imperatively via a ref + effect — the standard way to bridge a track's
 * imperative attach(element)/detach(element) API into a React-owned DOM node. See the design
 * spec (docs/superpowers/specs/2026-09-03-phase3-camera-design.md §4.1) for why this was chosen
 * over having voiceClient manage video elements itself, the way it does for hidden audio
 * elements.
 */
export function ParticipantTile({ participant }: ParticipantTileProps) {
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
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-gray-800">
      {videoTrack ? (
        <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-semibold text-gray-100" aria-hidden="true">
          {participant.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        <span aria-hidden="true">{participant.micEnabled ? '🎤' : '🔇'}</span>
        {participant.name}
        {participant.isLocal ? ' (you)' : ''}
      </span>
    </div>
  );
}

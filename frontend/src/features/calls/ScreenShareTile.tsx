import { useEffect, useRef } from 'react';
import type { VoiceParticipant } from '../../types/voice';

interface ScreenShareTileProps {
  participant: VoiceParticipant;
}

/**
 * Renders one participant's active screen share. Only ever rendered by ParticipantList for a
 * participant whose screenShareTrack is non-null, so — unlike ParticipantTile — there is no
 * placeholder branch: a mounted ScreenShareTile always has a track to attach. Same attach/detach-
 * via-ref pattern as ParticipantTile (see its doc comment, and design spec
 * docs/superpowers/specs/2026-09-04-phase4-screenshare-design.md §4.1) for why.
 *
 * Spans the grid's full row width (col-span-2) rather than sharing camera tiles' 1-column size —
 * screen content (text, code, slides) is illegible squeezed into a small square tile.
 */
export function ScreenShareTile({ participant }: ScreenShareTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { screenShareTrack } = participant;

  useEffect(() => {
    const element = videoRef.current;
    if (!screenShareTrack || !element) return;
    screenShareTrack.attach(element);
    return () => {
      screenShareTrack.detach(element);
    };
  }, [screenShareTrack]);

  return (
    <div className="relative col-span-2 flex aspect-video items-center justify-center overflow-hidden rounded bg-gray-900">
      <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-contain" />
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        <span aria-hidden="true">🖥️</span>
        {participant.name}
        's screen
        {participant.isLocal ? ' (you)' : ''}
      </span>
    </div>
  );
}

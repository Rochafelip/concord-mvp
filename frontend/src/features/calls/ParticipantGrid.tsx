import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';
import type { FocusTarget } from './useWatchTargets';
import { useGridLayout } from './useGridLayout';

interface ParticipantGridProps {
  participants: VoiceParticipant[];
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
  onWatch: (target: FocusTarget) => void;
}

/**
 * Renders every connected participant — camera on or off — in the tiered layout from
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md, unified per
 * docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §1: a camera-off
 * participant shows as an avatar tile in this same grid instead of a separate roster. Only
 * camera-on tiles are click-watchable (onWatch) — pinning an off-camera avatar tile into the
 * watched area isn't a meaningful action.
 */
export function ParticipantGrid({ participants, avatarUrlByUserId, deafenedByUserId, onWatch }: ParticipantGridProps) {
  const { containerRef, containerClassName, tileClassName, style } = useGridLayout(participants.length);

  if (participants.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-testid="participant-grid"
      className={`group/camera-grid flex-1 overflow-y-auto p-4 ${containerClassName}`}
      style={style}
    >
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          avatarUrl={avatarUrlByUserId.get(participant.identity)}
          deafened={deafenedByUserId.get(participant.identity) ?? false}
          className={tileClassName}
          onWatchClick={
            participant.cameraEnabled ? () => onWatch({ type: 'camera', identity: participant.identity }) : undefined
          }
        />
      ))}
    </div>
  );
}

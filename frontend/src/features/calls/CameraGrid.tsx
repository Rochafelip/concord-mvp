import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';
import { useGridLayout } from './useGridLayout';

interface CameraGridProps {
  participants: VoiceParticipant[];
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

/**
 * Renders every camera-on participant in the tiered layout from
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md. Off-camera participants are
 * handled separately by OffCameraRoster, not here.
 */
export function CameraGrid({ participants, avatarUrlByUserId, deafenedByUserId }: CameraGridProps) {
  const { containerRef, containerClassName, tileClassName, style } = useGridLayout(participants.length);

  if (participants.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-testid="camera-grid"
      className={`flex-1 overflow-y-auto p-4 ${containerClassName}`}
      style={style}
    >
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          avatarUrl={avatarUrlByUserId.get(participant.identity)}
          deafened={deafenedByUserId.get(participant.identity) ?? false}
          className={tileClassName}
        />
      ))}
    </div>
  );
}

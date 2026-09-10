import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';
import type { FocusTarget } from './useFocusTarget';
import { useGridLayout } from './useGridLayout';

interface CameraGridProps {
  participants: VoiceParticipant[];
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
  onFocus: (target: FocusTarget) => void;
}

/**
 * Renders every camera-on participant in the tiered layout from
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md. Off-camera participants are
 * handled separately by OffCameraRoster, not here. Each tile's small onFocusClick button (not a
 * whole-tile click target — see ParticipantTile) lets the user manually pin a camera into the
 * call's focused main slot even when no screen share is active, per
 * docs/superpowers/specs/2026-09-09-call-focus-mode-design.md.
 */
export function CameraGrid({ participants, avatarUrlByUserId, deafenedByUserId, onFocus }: CameraGridProps) {
  const { containerRef, containerClassName, tileClassName, style } = useGridLayout(participants.length);

  if (participants.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-testid="camera-grid"
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
          revealOnGridHover
          onWatchClick={() => onFocus({ type: 'camera', identity: participant.identity })}
        />
      ))}
    </div>
  );
}

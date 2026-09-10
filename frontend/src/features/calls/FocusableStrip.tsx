import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareThumbnail } from './ScreenShareThumbnail';
import type { FocusTarget } from './useWatchTargets';

interface FocusableStripProps {
  participants: VoiceParticipant[];
  watchTargets: FocusTarget[];
  onAddWatch: (target: FocusTarget) => void;
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

function isWatched(watchTargets: FocusTarget[], type: FocusTarget['type'], identity: string): boolean {
  return watchTargets.some((target) => target.type === type && target.identity === identity);
}

/**
 * Everything the user could add to the watched set, besides whatever's already watched — see
 * docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §4. Exclusion is
 * by the exact (type, identity) pair, not identity alone: someone who is both sharing and
 * camera-on still gets a camera entry here when only their share is watched (and vice versa),
 * since watching both at once is exactly what multi-watch is for.
 */
export function FocusableStrip({
  participants,
  watchTargets,
  onAddWatch,
  avatarUrlByUserId,
  deafenedByUserId,
}: FocusableStripProps) {
  const otherShares = participants.filter(
    (participant) => participant.screenShareTrack && !isWatched(watchTargets, 'share', participant.identity),
  );
  const otherCameras = participants.filter(
    (participant) => participant.cameraEnabled && !isWatched(watchTargets, 'camera', participant.identity),
  );

  if (otherShares.length === 0 && otherCameras.length === 0) return null;

  return (
    <div data-testid="focusable-strip" className="flex flex-shrink-0 gap-2 overflow-x-auto p-2">
      {otherShares.map((participant) => (
        <ScreenShareThumbnail
          key={`${participant.identity}-share`}
          name={participant.name}
          onClick={() => onAddWatch({ type: 'share', identity: participant.identity })}
        />
      ))}
      {otherCameras.map((participant) => (
        <button
          key={`${participant.identity}-camera`}
          type="button"
          aria-label={`Focus on ${participant.name}'s camera`}
          onClick={() => onAddWatch({ type: 'camera', identity: participant.identity })}
        >
          <ParticipantTile
            participant={participant}
            avatarUrl={avatarUrlByUserId.get(participant.identity)}
            deafened={deafenedByUserId.get(participant.identity) ?? false}
            className="h-24 w-40 flex-shrink-0"
            showVolumeControl={false}
          />
        </button>
      ))}
    </div>
  );
}

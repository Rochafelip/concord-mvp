import type { VoiceParticipant } from '../../types/voice';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareThumbnail } from './ScreenShareThumbnail';
import type { FocusTarget } from './useFocusTarget';

interface FocusableStripProps {
  participants: VoiceParticipant[];
  focusTarget: FocusTarget;
  onFocus: (target: FocusTarget) => void;
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

function isFocused(target: FocusTarget, type: FocusTarget['type'], identity: string): boolean {
  return target.type === type && target.identity === identity;
}

/**
 * Everything the user could switch focus to, besides whatever's currently focused — see
 * docs/superpowers/specs/2026-09-09-call-focus-mode-design.md §4. Exclusion is by the exact
 * (type, identity) pair, not identity alone: someone who is both sharing and camera-on still
 * gets a camera entry here when their share is what's focused (and vice versa), since switching
 * from "their screen" to "their camera" is exactly what this feature is for.
 */
export function FocusableStrip({
  participants,
  focusTarget,
  onFocus,
  avatarUrlByUserId,
  deafenedByUserId,
}: FocusableStripProps) {
  const otherShares = participants.filter(
    (participant) => participant.screenShareTrack && !isFocused(focusTarget, 'share', participant.identity),
  );
  const otherCameras = participants.filter(
    (participant) => participant.cameraEnabled && !isFocused(focusTarget, 'camera', participant.identity),
  );

  if (otherShares.length === 0 && otherCameras.length === 0) return null;

  return (
    <div data-testid="focusable-strip" className="flex flex-shrink-0 gap-2 overflow-x-auto p-2">
      {otherShares.map((participant) => (
        <ScreenShareThumbnail
          key={`${participant.identity}-share`}
          name={participant.name}
          onClick={() => onFocus({ type: 'share', identity: participant.identity })}
        />
      ))}
      {otherCameras.map((participant) => (
        <button
          key={`${participant.identity}-camera`}
          type="button"
          aria-label={`Focus on ${participant.name}'s camera`}
          onClick={() => onFocus({ type: 'camera', identity: participant.identity })}
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

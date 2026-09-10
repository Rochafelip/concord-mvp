import { LayoutGrid } from 'lucide-react';
import type { VoiceParticipant } from '../../types/voice';
import { FocusableStrip } from './FocusableStrip';
import { OffCameraRoster } from './OffCameraRoster';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';
import type { FocusTarget } from './useFocusTarget';

interface FocusedCallViewProps {
  participants: VoiceParticipant[];
  focusTarget: FocusTarget;
  isManual: boolean;
  onFocus: (target: FocusTarget) => void;
  onReturnToAutomatic: () => void;
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

/**
 * Renders the call view when something is focused (a manual pin, or the automatic share
 * default) — see docs/superpowers/specs/2026-09-09-call-focus-mode-design.md §3. ParticipantList
 * renders this instead of the Phase 1 CameraGrid/OffCameraRoster pair whenever useFocusTarget
 * resolves a non-null target. `pb-20` (bottom clearance for the floating CallControlBar) is kept
 * here for the same reason ParticipantList's own Phase 1 wrapper has it.
 */
export function FocusedCallView({
  participants,
  focusTarget,
  isManual,
  onFocus,
  onReturnToAutomatic,
  avatarUrlByUserId,
  deafenedByUserId,
}: FocusedCallViewProps) {
  const offCamera = participants.filter(
    (participant) => !participant.cameraEnabled && !participant.screenShareTrack,
  );
  const focusedParticipant = participants.find((participant) => participant.identity === focusTarget.identity);

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-20">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {focusedParticipant &&
          (focusTarget.type === 'share' ? (
            <ScreenShareTile participant={focusedParticipant} />
          ) : (
            <ParticipantTile
              participant={focusedParticipant}
              avatarUrl={avatarUrlByUserId.get(focusedParticipant.identity)}
              deafened={deafenedByUserId.get(focusedParticipant.identity) ?? false}
              className="h-full max-h-full max-w-full"
            />
          ))}
        {isManual && (
          <button
            type="button"
            aria-label="Return to automatic layout"
            onClick={onReturnToAutomatic}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <LayoutGrid size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <FocusableStrip
        participants={participants}
        focusTarget={focusTarget}
        onFocus={onFocus}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
      <OffCameraRoster
        participants={offCamera}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    </div>
  );
}

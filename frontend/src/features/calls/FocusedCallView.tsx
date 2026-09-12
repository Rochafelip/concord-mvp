import { LayoutGrid } from 'lucide-react';
import type { VoiceParticipant } from '../../types/voice';
import { FocusableStrip } from './FocusableStrip';
import { OffCameraRoster } from './OffCameraRoster';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';
import { useGridLayout } from './useGridLayout';
import type { FocusTarget } from './useWatchTargets';

interface FocusedCallViewProps {
  participants: VoiceParticipant[];
  watchTargets: FocusTarget[];
  isManual: boolean;
  onAddWatch: (target: FocusTarget) => void;
  onRemoveWatch: (target: FocusTarget) => void;
  onReturnToAutomatic: () => void;
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

/**
 * Renders the call view whenever at least one camera/share is being watched — see
 * docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md §4. The main area
 * reuses useGridLayout — the exact same tiering ParticipantGrid uses for the plain grid — so 1
 * watched tile fills the space, 2 split evenly, 3 center the third, etc, with no separate layout
 * math to maintain. Clicking any watched tile removes it via onRemoveWatch (each tile type wires
 * its own click-to-remove — ParticipantTile's whole-tile click, ScreenShareTile's non-fullscreen
 * click).
 *
 * The watched area carries `group/camera-grid` for the same reason ParticipantGrid's container
 * does (docs/superpowers/specs/2026-09-09-call-grid-controls-hover-design.md): the tiles' overlay
 * controls stay hidden until the mouse enters this area, and then every visible tile reveals its
 * controls at once. The zone is this padded area — not the strip or roster below it, which have
 * no overlay controls to reveal — and the "return to automatic layout" button stays always
 * visible, since it duplicates nothing in the footer.
 */
export function FocusedCallView({
  participants,
  watchTargets,
  isManual,
  onAddWatch,
  onRemoveWatch,
  onReturnToAutomatic,
  avatarUrlByUserId,
  deafenedByUserId,
}: FocusedCallViewProps) {
  const offCamera = participants.filter((participant) => !participant.cameraEnabled && !participant.screenShareTrack);
  const { containerRef, containerClassName, tileClassName, style } = useGridLayout(watchTargets.length);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-20">
      <div data-testid="watched-area" className="group/camera-grid relative flex min-h-0 min-w-0 flex-1 overflow-hidden p-4">
        <div ref={containerRef} className={`min-h-0 min-w-0 flex-1 ${containerClassName}`} style={style}>
          {watchTargets.map((target) => {
            const watched = participants.find((participant) => participant.identity === target.identity);
            if (!watched) return null;
            const key = `${target.type}-${target.identity}`;
            return target.type === 'share' ? (
              <ScreenShareTile
                key={key}
                participant={watched}
                className={tileClassName}
                onWatchClick={() => onRemoveWatch(target)}
              />
            ) : (
              <ParticipantTile
                key={key}
                participant={watched}
                avatarUrl={avatarUrlByUserId.get(watched.identity)}
                deafened={deafenedByUserId.get(watched.identity) ?? false}
                className={tileClassName}
                onWatchClick={() => onRemoveWatch(target)}
              />
            );
          })}
        </div>
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
        watchTargets={watchTargets}
        onAddWatch={onAddWatch}
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

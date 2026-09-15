import { LayoutGrid } from 'lucide-react';

import type { VoiceParticipant } from '../../types/voice';

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
  canDisconnect?: boolean;
  channelId?: string | null;
}

/**
 * Renders the call view whenever at least one camera/share is being watched.
 *
 * The watched area contains only the currently watched targets.
 *
 * FocusableStrip is intentionally rendered outside this component by the
 * parent call view. This allows available screen shares and cameras to remain
 * visible even when watchTargets is empty and ParticipantGrid is displayed.
 */
export function FocusedCallView({
  participants,
  watchTargets,
  isManual,
  onRemoveWatch,
  onReturnToAutomatic,
  avatarUrlByUserId,
  deafenedByUserId,
         canDisconnect,
         channelId,
}: FocusedCallViewProps) {
  const offCamera = participants.filter(
    (participant) =>
      !participant.cameraEnabled && !participant.screenShareTrack,
  );

  const {
    containerRef,
    containerClassName,
    tileClassName,
    style,
  } = useGridLayout(watchTargets.length);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        data-testid="watched-area"
        className="group/camera-grid relative flex min-h-0 min-w-0 flex-1 overflow-hidden p-4"
      >
        <div
          ref={containerRef}
          className={`min-h-0 min-w-0 flex-1 ${containerClassName}`}
          style={style}
        >
          {watchTargets.map((target) => {
            const watched = participants.find(
              (participant) => participant.identity === target.identity,
            );

            if (!watched) return null;

            const key = `${target.type}-${target.identity}`;

            return target.type === 'share' ? (
              <ScreenShareTile
                key={key}
                participant={watched}
                className={tileClassName}
                onWatchClick={() => onRemoveWatch(target)}
                      canDisconnect={canDisconnect}
                      channelId={channelId}
              />
            ) : (
              <ParticipantTile
                key={key}
                participant={watched}
                avatarUrl={avatarUrlByUserId.get(watched.identity)}
                deafened={
                  deafenedByUserId.get(watched.identity) ?? false
                }
                className={tileClassName}
                onWatchClick={() => onRemoveWatch(target)}
                canDisconnect={canDisconnect}
                channelId={channelId}
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

      <OffCameraRoster
        participants={offCamera}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    </div>
  );
}

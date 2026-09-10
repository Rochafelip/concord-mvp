import { Avatar } from '../../components/Avatar';
import type { VoiceParticipant } from '../../types/voice';
import { MicStatusIcon } from './MicStatusIcon';

interface OffCameraRosterProps {
  participants: VoiceParticipant[];
  avatarUrlByUserId: Map<string, string | null | undefined>;
  deafenedByUserId: Map<string, boolean>;
}

/**
 * Horizontal strip for participants who are in the call but not showing camera video (and not
 * screen-sharing, which gets its own ScreenShareTile), so they don't take up main-grid space
 * alongside camera tiles — see docs/superpowers/specs/2026-09-09-call-grid-layout-design.md §3.
 * Renders nothing when empty.
 */
export function OffCameraRoster({ participants, avatarUrlByUserId, deafenedByUserId }: OffCameraRosterProps) {
  if (participants.length === 0) return null;

  return (
    <div
      data-testid="off-camera-roster"
      className="flex flex-shrink-0 gap-3 overflow-x-auto border-t border-border bg-surface/50 py-2"
    >
      {participants.map((participant) => {
        const deafened = deafenedByUserId.get(participant.identity) ?? false;
        return (
          <div key={participant.identity} className="flex flex-shrink-0 items-center gap-2">
            <Avatar
              displayName={participant.name}
              avatarUrl={avatarUrlByUserId.get(participant.identity)}
              size="sm"
              className={participant.speaking ? 'ring-2 ring-success' : ''}
            />
            <span className="flex items-center gap-1 text-caption text-ink">
              <MicStatusIcon micEnabled={participant.micEnabled} deafened={deafened} />
              {participant.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

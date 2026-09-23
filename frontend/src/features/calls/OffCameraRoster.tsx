import { Avatar } from '../../components/Avatar';
import { voiceClient } from '../../services/voiceClient';
import { UserProfileCard } from '../users/UserProfileCard';
import type { VoiceParticipant } from '../../types/voice';
import { MicStatusIcon } from './MicStatusIcon';
import { muteParticipantMenuItem } from './muteParticipantMenuItem';
import { VolumeControl } from './VolumeControl';

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
 *
 * Each remote entry carries its own volume control, on the same hover-to-reveal pattern as
 * ParticipantTile's. This roster is where every mic-only participant lands the moment anyone
 * starts sharing a screen, so without one here a listener loses the ability to adjust exactly
 * the people they are still only listening to — the most visible half of the reported
 * "screen share resets participant volume" bug, which was never a reset at all: voiceClient kept
 * the level (262415b), the control to see and change it just stopped being rendered.
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
        const profileUser = {
          id: participant.identity,
          displayName: participant.name,
          avatarUrl: avatarUrlByUserId.get(participant.identity),
        };
        const contextMenuExtraItems = participant.isLocal ? [] : [muteParticipantMenuItem(participant.identity)];
        return (
          <div
            key={participant.identity}
            className="group/roster-entry flex flex-shrink-0 items-center gap-2"
          >
            <UserProfileCard user={profileUser} contextMenuExtraItems={contextMenuExtraItems}>
              <button type="button" className="rounded-full">
                <Avatar
                  displayName={participant.name}
                  avatarUrl={avatarUrlByUserId.get(participant.identity)}
                  size="sm"
                  className={participant.speaking ? 'ring-2 ring-success' : ''}
                />
              </button>
            </UserProfileCard>
            <span className="flex items-center gap-1 text-caption text-ink">
              <MicStatusIcon micEnabled={participant.micEnabled} deafened={deafened} />
              <UserProfileCard user={profileUser} contextMenuExtraItems={contextMenuExtraItems}>
                <button type="button" className="hover:underline">
                  {participant.name}
                </button>
              </UserProfileCard>
            </span>
            {!participant.isLocal && (
              <div className="opacity-0 transition-opacity group-hover/roster-entry:opacity-100 group-focus-within/roster-entry:opacity-100">
                <VolumeControl
                  label={participant.name}
                  initialVolume={voiceClient.getParticipantVolume(participant.identity)}
                  onVolumeChange={(volume) => voiceClient.setParticipantVolume(participant.identity, volume)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

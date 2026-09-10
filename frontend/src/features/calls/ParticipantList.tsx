import { useMemo } from 'react';
import { Spinner } from '../../components/Spinner';
import { CameraGrid } from './CameraGrid';
import { useVoiceParticipants, useVoicePresence } from './hooks';
import { OffCameraRoster } from './OffCameraRoster';
import { ScreenShareTile } from './ScreenShareTile';

interface ParticipantListProps {
  /** The current channel's server — used to look up who's deafened/their avatar via voice presence. */
  serverId?: string;
}

/**
 * Splits participants into three groups per
 * docs/superpowers/specs/2026-09-09-call-grid-layout-design.md: active screen shares (full-width,
 * rendered first, unchanged from before), camera-on participants (CameraGrid's tiered layout),
 * and everyone else (OffCameraRoster's horizontal strip) — so off-camera participants no longer
 * take up main-grid space alongside camera tiles.
 */
export function ParticipantList({ serverId }: ParticipantListProps) {
  const participants = useVoiceParticipants();
  const { data: presence } = useVoicePresence(serverId);

  // participant.identity is LiveKit's identifier, but the backend mints LiveKit tokens with the
  // app's user UUID as the JWT `sub` claim (MediaService), so it's safe to compare directly
  // against VoicePresenceEntry.userId here — no separate lookup table exists or is needed.
  const deafenedByUserId = useMemo(() => {
    const map = new Map<string, boolean>();
    (presence ?? []).forEach((entry) => map.set(entry.userId, entry.deafened));
    return map;
  }, [presence]);

  const avatarUrlByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    (presence ?? []).forEach((entry) => map.set(entry.userId, entry.avatarUrl));
    return map;
  }, [presence]);

  if (participants.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-4 text-body text-muted">
        <Spinner />
        Connecting…
      </div>
    );
  }

  const sharing = participants.filter((participant) => participant.screenShareTrack);
  const onCamera = participants.filter((participant) => participant.cameraEnabled);
  const offCamera = participants.filter(
    (participant) => !participant.cameraEnabled && !participant.screenShareTrack,
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-20">
      {sharing.length > 0 && (
        <div className="flex flex-shrink-0 flex-col gap-2 p-4 pb-0">
          {sharing.map((participant) => (
            <ScreenShareTile key={`${participant.identity}-screen`} participant={participant} />
          ))}
        </div>
      )}
      <CameraGrid participants={onCamera} avatarUrlByUserId={avatarUrlByUserId} deafenedByUserId={deafenedByUserId} />
      <OffCameraRoster
        participants={offCamera}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    </div>
  );
}

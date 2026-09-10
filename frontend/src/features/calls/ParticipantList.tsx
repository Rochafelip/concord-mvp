import { useMemo } from 'react';
import { Spinner } from '../../components/Spinner';
import { CameraGrid } from './CameraGrid';
import { FocusedCallView } from './FocusedCallView';
import { useVoiceParticipants, useVoicePresence } from './hooks';
import { OffCameraRoster } from './OffCameraRoster';
import { useFocusTarget } from './useFocusTarget';

interface ParticipantListProps {
  /** The current channel's server — used to look up who's deafened/their avatar via voice presence. */
  serverId?: string;
}

/**
 * Per docs/superpowers/specs/2026-09-09-call-focus-mode-design.md: whenever useFocusTarget
 * resolves a non-null target (a manual pin, or the automatic share default), renders
 * FocusedCallView instead of the plain grid. With no shares and no pin, renders exactly Phase 1's
 * CameraGrid/OffCameraRoster pair (docs/superpowers/specs/2026-09-09-call-grid-layout-design.md),
 * unchanged.
 */
export function ParticipantList({ serverId }: ParticipantListProps) {
  const participants = useVoiceParticipants();
  const { data: presence } = useVoicePresence(serverId);
  const { focusTarget, isManual, setFocus, clearFocus } = useFocusTarget(participants);

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

  if (focusTarget) {
    return (
      <FocusedCallView
        participants={participants}
        focusTarget={focusTarget}
        isManual={isManual}
        onFocus={setFocus}
        onReturnToAutomatic={clearFocus}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    );
  }

  const onCamera = participants.filter((participant) => participant.cameraEnabled);
  const offCamera = participants.filter(
    (participant) => !participant.cameraEnabled && !participant.screenShareTrack,
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-20">
      <CameraGrid
        participants={onCamera}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
        onFocus={setFocus}
      />
      <OffCameraRoster
        participants={offCamera}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    </div>
  );
}

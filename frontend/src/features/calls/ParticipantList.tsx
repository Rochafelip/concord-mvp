import { useMemo } from 'react';
import { Spinner } from '../../components/Spinner';
import { FocusedCallView } from './FocusedCallView';
import { useVoiceParticipants, useVoicePresence } from './hooks';
import { ParticipantGrid } from './ParticipantGrid';
import { useWatchTargets } from './useWatchTargets';

interface ParticipantListProps {
  /** The current channel's server — used to look up who's deafened/their avatar via voice presence. */
  serverId?: string;
}

/**
 * Per docs/superpowers/specs/2026-09-09-call-grid-unification-multiwatch-design.md: whenever
 * useWatchTargets resolves at least one watched target (a manual pin/add, or the automatic
 * share default), renders FocusedCallView. With nothing watched, renders ParticipantGrid alone —
 * every connected participant, camera on or off.
 */
export function ParticipantList({ serverId }: ParticipantListProps) {
  const participants = useVoiceParticipants();
  const { data: presence } = useVoicePresence(serverId);
  const { watchTargets, isManual, addWatch, removeWatch, clearManual } = useWatchTargets(participants);

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

  if (watchTargets.length > 0) {
    return (
      <FocusedCallView
        participants={participants}
        watchTargets={watchTargets}
        isManual={isManual}
        onAddWatch={addWatch}
        onRemoveWatch={removeWatch}
        onReturnToAutomatic={clearManual}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-20">
      <ParticipantGrid
        participants={participants}
        avatarUrlByUserId={avatarUrlByUserId}
        deafenedByUserId={deafenedByUserId}
        onWatch={addWatch}
      />
    </div>
  );
}

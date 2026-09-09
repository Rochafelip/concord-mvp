import { useMemo } from 'react';
import { Spinner } from '../../components/Spinner';
import { useVoiceParticipants, useVoicePresence } from './hooks';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';

interface ParticipantListProps {
  /**
   * Historically wired to the local participant's tile to render its in-tile control bar.
   * ParticipantTile no longer renders that bar (moved out in a concurrent, unrelated redesign —
   * see docs/superpowers/plans/2026-09-08-call-view-control-bar-redesign.md), so this prop is
   * currently unused here. Kept on the interface so CallView's existing call site still
   * type-checks; that redesign's own remaining tasks are expected to relocate this wiring to a
   * new CallControlBar rendered by CallView instead.
   */
  onLeave?: () => void;
  /** The current channel's server — used to look up who's deafened via voice presence. */
  serverId?: string;
}

export function ParticipantList({ serverId }: ParticipantListProps) {
  const participants = useVoiceParticipants();
  const { data: presence } = useVoicePresence(serverId);

  const deafenedByUserId = useMemo(() => {
    const map = new Map<string, boolean>();
    (presence ?? []).forEach((entry) => map.set(entry.userId, entry.deafened));
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

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 overflow-y-auto p-4">
      {sharing.map((participant) => (
        <ScreenShareTile key={`${participant.identity}-screen`} participant={participant} />
      ))}
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          deafened={deafenedByUserId.get(participant.identity) ?? false}
        />
      ))}
    </div>
  );
}

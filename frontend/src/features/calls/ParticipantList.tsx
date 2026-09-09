import { useMemo } from 'react';
import { Spinner } from '../../components/Spinner';
import { useVoiceParticipants, useVoicePresence } from './hooks';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';

interface ParticipantListProps {
  /** The current channel's server — used to look up who's deafened/their avatar via voice presence. */
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

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 overflow-y-auto p-4 pb-20">
      {sharing.map((participant) => (
        <ScreenShareTile key={`${participant.identity}-screen`} participant={participant} />
      ))}
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          avatarUrl={avatarUrlByUserId.get(participant.identity)}
          deafened={deafenedByUserId.get(participant.identity) ?? false}
        />
      ))}
    </div>
  );
}

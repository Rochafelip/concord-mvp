import { Spinner } from '../../components/Spinner';
import { useVoiceParticipants } from './hooks';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';

interface ParticipantListProps {
  /** Wired to the local participant's tile only — renders its in-tile control bar. */
  onLeave?: () => void;
}

export function ParticipantList({ onLeave }: ParticipantListProps) {
  const participants = useVoiceParticipants();

  if (participants.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-4 text-sm text-muted">
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
          onLeave={participant.isLocal ? onLeave : undefined}
        />
      ))}
    </div>
  );
}

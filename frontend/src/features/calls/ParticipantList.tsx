import { useVoiceParticipants } from './hooks';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';

export function ParticipantList() {
  const participants = useVoiceParticipants();

  if (participants.length === 0) {
    return <div className="flex-1 p-4 text-sm text-gray-500">Connecting…</div>;
  }

  const sharing = participants.filter((participant) => participant.screenShareTrack);

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-4">
      {sharing.map((participant) => (
        <ScreenShareTile key={`${participant.identity}-screen`} participant={participant} />
      ))}
      {participants.map((participant) => (
        <ParticipantTile key={participant.identity} participant={participant} />
      ))}
    </div>
  );
}

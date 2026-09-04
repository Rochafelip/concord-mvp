import { useVoiceParticipants } from './hooks';
import { ParticipantTile } from './ParticipantTile';

export function ParticipantList() {
  const participants = useVoiceParticipants();

  if (participants.length === 0) {
    return <div className="flex-1 p-4 text-sm text-gray-500">Connecting…</div>;
  }

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-4">
      {participants.map((participant) => (
        <ParticipantTile key={participant.identity} participant={participant} />
      ))}
    </div>
  );
}

import { useVoiceParticipants } from './hooks';

export function ParticipantList() {
  const participants = useVoiceParticipants();

  if (participants.length === 0) {
    return <div className="flex-1 p-4 text-sm text-gray-500">Connecting…</div>;
  }

  const others = participants.filter((participant) => !participant.isLocal);
  if (others.length === 0) {
    return <div className="flex-1 p-4 text-sm text-gray-500">No one else is here yet.</div>;
  }

  return (
    <ul className="flex-1 space-y-1 overflow-y-auto p-4">
      {participants.map((participant) => (
        <li key={participant.identity} className="flex items-center gap-2 text-sm text-gray-800">
          <span aria-hidden="true">{participant.micEnabled ? '🎤' : '🔇'}</span>
          <span>
            {participant.name}
            {participant.isLocal ? ' (you)' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

import { useNavigate, useParams } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { useVoiceParticipants } from './hooks';

export function VoiceControls() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const participants = useVoiceParticipants();
  const local = participants.find((participant) => participant.isLocal);
  const muted = local ? !local.micEnabled : false;
  const cameraOn = local ? local.cameraEnabled : false;
  const sharingScreen = local ? local.screenShareEnabled : false;

  function handleLeave() {
    voiceClient.disconnect();
    navigate(`/app/servers/${serverId}`);
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t border-gray-200 px-4 py-3">
      <button
        type="button"
        aria-pressed={muted}
        onClick={() => voiceClient.toggleMute()}
        className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-300"
      >
        {muted ? '🔇 Unmute' : '🎤 Mute'}
      </button>
      <button
        type="button"
        aria-pressed={cameraOn}
        onClick={() => voiceClient.toggleCamera()}
        className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-300"
      >
        {cameraOn ? '📹 Camera off' : '📷 Camera on'}
      </button>
      <button
        type="button"
        aria-pressed={sharingScreen}
        onClick={() => voiceClient.toggleScreenShare()}
        className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-300"
      >
        {sharingScreen ? '🛑 Stop sharing' : '🖥️ Share screen'}
      </button>
      <button
        type="button"
        onClick={handleLeave}
        className="rounded bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200"
      >
        Leave
      </button>
    </div>
  );
}

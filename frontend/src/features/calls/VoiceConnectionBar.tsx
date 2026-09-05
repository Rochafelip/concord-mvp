import type { ConnectionQuality } from 'livekit-client';
import { Link } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { useChannel } from '../channels/hooks';
import { useServer } from '../servers/hooks';
import { useVoiceParticipants, useVoiceStatus } from './hooks';

const QUALITY_ICON: Record<ConnectionQuality, string> = {
  excellent: '🟢',
  good: '🟡',
  poor: '🔴',
  lost: '🔴',
  unknown: '⚪',
};

export function VoiceConnectionBar() {
  const { status, channelId, isDeafened } = useVoiceStatus();
  const { data: channel } = useChannel(channelId ?? undefined);
  const { data: server } = useServer(channel?.serverId);
  const localParticipant = useVoiceParticipants().find((participant) => participant.isLocal);

  if (status === 'disconnected' || !channelId) return null;

  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-2">
      <Link
        to={`/app/servers/${channel?.serverId}/channels/${channelId}`}
        className="flex min-w-0 flex-col gap-0.5 hover:opacity-80"
      >
        <span className="flex items-center gap-1 truncate text-sm font-medium text-gray-900">
          🔊 {status === 'connecting' ? 'Connecting…' : (channel?.name ?? '…')}
          {localParticipant && (
            <span
              title={localParticipant.connectionQuality}
              aria-label={`Connection: ${localParticipant.connectionQuality}`}
            >
              {QUALITY_ICON[localParticipant.connectionQuality]}
            </span>
          )}
        </span>
        {server && <span className="truncate text-xs text-gray-500">{server.name}</span>}
      </Link>

      {localParticipant && (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={localParticipant.micEnabled ? 'Mute' : 'Unmute'}
            onClick={() => voiceClient.toggleMute()}
            className="rounded-full bg-gray-200 p-1.5 text-sm leading-none text-gray-700 hover:bg-gray-300"
          >
            {localParticipant.micEnabled ? '🎤' : '🔇'}
          </button>
          <button
            type="button"
            aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
            onClick={() => voiceClient.toggleDeafen()}
            className="rounded-full bg-gray-200 p-1.5 text-sm leading-none text-gray-700 hover:bg-gray-300"
          >
            {isDeafened ? '🙉' : '🎧'}
          </button>
          <button
            type="button"
            aria-label="Leave call"
            onClick={() => voiceClient.disconnect()}
            className="rounded-full bg-red-500/90 p-1.5 text-sm leading-none text-white hover:bg-red-500"
          >
            📵
          </button>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { voiceClient } from '../../services/voiceClient';
import { useChannel } from '../channels/hooks';
import { useServer } from '../servers/hooks';
import { useVoiceStatus } from './hooks';

export function VoiceConnectionBar() {
  const { status, channelId } = useVoiceStatus();
  const { data: channel } = useChannel(channelId ?? undefined);
  const { data: server } = useServer(channel?.serverId);

  if (status === 'disconnected' || !channelId) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-2">
      <Link
        to={`/app/servers/${channel?.serverId}/channels/${channelId}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 hover:opacity-80"
      >
        <span className="truncate text-sm font-medium text-gray-900">
          🔊 {status === 'connecting' ? 'Connecting…' : (channel?.name ?? '…')}
        </span>
        {server && <span className="truncate text-xs text-gray-500">{server.name}</span>}
      </Link>
      <button
        type="button"
        onClick={() => voiceClient.disconnect()}
        className="flex-shrink-0 text-xs font-medium text-red-600 hover:text-red-800"
      >
        Leave
      </button>
    </div>
  );
}

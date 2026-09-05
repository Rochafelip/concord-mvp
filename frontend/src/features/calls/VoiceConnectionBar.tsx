import { Link } from 'react-router-dom';
import { useChannel } from '../channels/hooks';
import { useServer } from '../servers/hooks';
import { useVoiceStatus } from './hooks';

export function VoiceConnectionBar() {
  const { status, channelId } = useVoiceStatus();
  const { data: channel } = useChannel(channelId ?? undefined);
  const { data: server } = useServer(channel?.serverId);

  if (status === 'disconnected' || !channelId) return null;

  return (
    <Link
      to={`/app/servers/${channel?.serverId}/channels/${channelId}`}
      className="flex flex-shrink-0 flex-col gap-0.5 border-t border-gray-200 px-3 py-2 hover:bg-gray-100"
    >
      <span className="truncate text-sm font-medium text-gray-900">
        🔊 {status === 'connecting' ? 'Connecting…' : (channel?.name ?? '…')}
      </span>
      {server && <span className="truncate text-xs text-gray-500">{server.name}</span>}
    </Link>
  );
}

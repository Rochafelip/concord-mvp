import { useParams } from 'react-router-dom';
import { useChannel } from '../channels/hooks';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

/**
 * Replaces the /app/servers/:serverId/channels/:channelId placeholder. Reads :channelId
 * straight from the URL (same URL-as-source-of-truth pattern as ChannelSidebar/ServerLayout).
 */
export function ChatWindow() {
  const { channelId } = useParams<{ channelId: string }>();
  const { data: channel } = useChannel(channelId);

  if (!channelId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <span className="font-semibold text-gray-900">
          {channel ? `# ${channel.name}` : 'Loading…'}
        </span>
      </div>
      <MessageList channelId={channelId} />
      <MessageInput channelId={channelId} />
    </div>
  );
}

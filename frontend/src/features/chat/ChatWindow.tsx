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
      {/* key={channelId} forces a full remount on channel switch. Without it, client-side
          navigation only changes props, not identity — MessageList's scroll-state refs (e.g. a
          load-older-messages fetch still pending from the PREVIOUS channel) and MessageInput's
          draft text would otherwise carry over into the newly selected channel. */}
      <MessageList key={channelId} channelId={channelId} />
      {channel?.type === 'ONBOARDING' ? (
        <p className="border-t border-gray-200 p-3 text-center text-xs text-gray-500">
          This channel is read-only.
        </p>
      ) : (
        <MessageInput key={channelId} channelId={channelId} />
      )}
    </div>
  );
}

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
      <div className="flex-shrink-0 border-b bg-surface px-4 py-3">
        <span className="text-heading font-semibold text-ink">
          {channel ? `# ${channel.name}` : 'Loading…'}
        </span>
      </div>
      {/* Keying by channelId forces a full remount on channel switch. Without it, client-side
          navigation only changes props, not identity — MessageList's scroll-state refs (e.g. a
          load-older-messages fetch still pending from the PREVIOUS channel) and MessageInput's
          draft text would otherwise carry over into the newly selected channel. The two keys
          below must not be equal to each other: MessageList and MessageInput (or the read-only
          notice) are SIBLINGS, and giving siblings the same literal key value is a duplicate-key
          bug — React warns "children may be duplicated and/or omitted" for exactly that case,
          which showed up here as stale messages from a previous visit reappearing alongside the
          current channel's list after switching channels. Prefixing each slot keeps them
          distinct while still changing (forcing a remount) whenever channelId changes. */}
      <MessageList key={`messages-${channelId}`} channelId={channelId} />
      {channel?.type === 'ONBOARDING' ? (
        <p
          key={`input-${channelId}`}
          className="border-t p-3 text-center text-caption text-muted"
        >
          This channel is read-only.
        </p>
      ) : (
        <MessageInput key={`input-${channelId}`} channelId={channelId} />
      )}
    </div>
  );
}

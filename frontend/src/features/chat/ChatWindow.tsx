import { useParams } from 'react-router-dom';
import { useChannel } from '../channels/hooks';
import { hasPermission } from '../../types/permission';
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

  // Resolved here, in the container, and passed down: MessageList and MessageInput stay
  // presentation-only. Hiding these is a courtesy — the backend refuses each one regardless.
  const canReadHistory = hasPermission(channel?.permissions, 'READ_MESSAGE_HISTORY');
  const canSendMessages = hasPermission(channel?.permissions, 'SEND_MESSAGES');
  const canAttachFiles = hasPermission(channel?.permissions, 'ATTACH_FILES');
  const canManageMessages = hasPermission(channel?.permissions, 'MANAGE_MESSAGES');
  const readOnly = channel?.type === 'ONBOARDING';

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-14 flex-shrink-0 items-center border-b bg-surface px-3 py-3 sm:px-4">
        <span className="truncate text-heading font-semibold text-ink">
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
      {channel != null && !canReadHistory ? (
        <div
          key={`messages-${channelId}`}
          className="flex flex-1 items-center justify-center p-6 text-center text-caption text-muted"
        >
          Você não tem permissão para ler o histórico deste canal.
        </div>
      ) : (
        <MessageList
          key={`messages-${channelId}`}
          channelId={channelId}
          canManageMessages={canManageMessages}
        />
      )}
      {readOnly || (channel != null && !canSendMessages) ? (
        <p
          key={`input-${channelId}`}
          className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-caption text-muted"
        >
          {readOnly
            ? 'This channel is read-only.'
            : 'Você não tem permissão para enviar mensagens neste canal.'}
        </p>
      ) : (
        <MessageInput
          key={`input-${channelId}`}
          channelId={channelId}
          canAttachFiles={canAttachFiles}
        />
      )}
    </div>
  );
}

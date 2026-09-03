import { useParams } from 'react-router-dom';
import { CallView } from '../features/calls/CallView';
import { useChannel } from '../features/channels/hooks';
import { ChatWindow } from '../features/chat/ChatWindow';

/**
 * Replaces the /app/servers/:serverId/channels/:channelId placeholder. Branches on the
 * channel's type: VOICE channels get the LiveKit call UI, TEXT channels get the existing chat
 * UI unchanged.
 */
export function ChannelRoute() {
  const { channelId } = useParams<{ channelId: string }>();
  const { data: channel } = useChannel(channelId);

  if (!channelId) return null;
  if (!channel) return <div className="p-4 text-gray-500">Loading…</div>;

  // Deliberately NOT keyed by channel.id (unlike ChatWindow): CallView relies on staying
  // mounted across a voice-channel switch so its join effect can re-fire without an
  // intervening unmount/disconnect (see CallView's own comment) — keying it here would force a
  // remount and break that switch-without-disconnect behavior.
  return channel.type === 'VOICE' ? <CallView channel={channel} /> : <ChatWindow />;
}

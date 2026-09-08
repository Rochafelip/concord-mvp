import { Navigate, useParams } from 'react-router-dom';
import { useChannels } from '../features/channels/hooks';
import { getLastVisitedTextChannelId } from '../features/channels/lastVisitedChannel';

/**
 * Rendered for /app/servers/:serverId (no channel in the URL yet) — reached both when a
 * user selects a server and when CallView's "Leave call" navigates back to the server
 * root. Prefers the last TEXT channel the user visited in this server (if it's still a valid
 * TEXT channel); otherwise falls back to the first accessible TEXT channel, so the app doesn't
 * show an empty pane. Falls back to a placeholder when the server has no TEXT channel at all.
 */
export function ServerIndexRoute() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: channels } = useChannels(serverId);

  if (!channels) return <div className="p-4 text-muted">Loading…</div>;

  const textChannels = channels.filter((channel) => channel.type === 'TEXT');
  const lastVisitedId = serverId ? getLastVisitedTextChannelId(serverId) : null;
  const lastVisited = textChannels.find((channel) => channel.id === lastVisitedId);
  const target = lastVisited ?? textChannels[0];

  if (target) {
    return <Navigate to={`/app/servers/${serverId}/channels/${target.id}`} replace />;
  }

  return <div className="p-4 text-muted">No text channel available</div>;
}

import { Navigate, useParams } from 'react-router-dom';
import { useChannels } from '../features/channels/hooks';

/**
 * Rendered for /app/servers/:serverId (no channel in the URL yet) — reached both when a
 * user selects a server and when CallView's "Leave call" navigates back to the server
 * root. Auto-selects the first accessible TEXT channel so the app doesn't show an empty
 * pane; falls back to a placeholder when the server has no TEXT channel.
 */
export function ServerIndexRoute() {
  const { serverId } = useParams<{ serverId: string }>();
  const { data: channels } = useChannels(serverId);

  if (!channels) return <div className="p-4 text-muted">Loading…</div>;

  const firstTextChannel = channels.find((channel) => channel.type === 'TEXT');
  if (firstTextChannel) {
    return <Navigate to={`/app/servers/${serverId}/channels/${firstTextChannel.id}`} replace />;
  }

  return <div className="p-4 text-muted">No text channel available</div>;
}

import { Outlet } from 'react-router-dom';
import { ChannelSidebar } from '../features/channels/ChannelSidebar';

/**
 * Layout route for /app/servers/:serverId. Renders the channel sidebar for the selected
 * server alongside an <Outlet/> that holds the channel-specific content — the chat UI
 * (features/chat/ChatWindow) when a channel is selected, or a "select a channel" placeholder
 * otherwise.
 */
export function ServerLayout() {
  return (
    <div className="flex h-full">
      <ChannelSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

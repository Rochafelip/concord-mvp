import { Outlet } from 'react-router-dom';
import { ChannelSidebar } from '../features/channels/ChannelSidebar';

/**
 * Layout route for /app/servers/:serverId. Renders the channel sidebar for the selected
 * server alongside an <Outlet/> that holds the channel-specific content — currently a
 * placeholder (or "select a channel"), later the actual chat UI built by features/chat/ (a
 * later task, not built here).
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

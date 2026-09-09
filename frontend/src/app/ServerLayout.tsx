import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { Outlet } from 'react-router-dom';
import { ChannelSidebar } from '../features/channels/ChannelSidebar';

const SIDEBAR_MIN_PX = 180;
const SIDEBAR_MAX_PX = 400;
const SIDEBAR_DEFAULT_PX = 224;

/**
 * Layout route for /app/servers/:serverId. Renders the resizable channel sidebar for the
 * selected server alongside an <Outlet/> that holds the channel-specific content — the chat UI
 * (features/chat/ChatWindow) or call UI when a channel is selected, or (via ServerIndexRoute)
 * an auto-redirect to the server's first text channel, falling back to a "no text channel"
 * placeholder when none exists. Sidebar width is user-resizable (drag the separator) and
 * persisted to localStorage via useDefaultLayout, independent of voice connection state.
 */
export function ServerLayout() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'server-layout',
    panelIds: ['channel-sidebar', 'server-content'],
  });

  return (
    <Group className="h-full" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <Panel
        id="channel-sidebar"
        defaultSize={SIDEBAR_DEFAULT_PX}
        minSize={SIDEBAR_MIN_PX}
        maxSize={SIDEBAR_MAX_PX}
      >
        <ChannelSidebar />
      </Panel>
      <Separator
        aria-label="Resize channel sidebar"
        className="w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-brand/40 active:bg-brand/60"
      />
      <Panel id="server-content" className="min-w-0">
        <div className="h-full overflow-y-auto">
          <Outlet />
        </div>
      </Panel>
    </Group>
  );
}

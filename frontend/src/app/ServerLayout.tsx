import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'server-layout',
    panelIds: ['channel-sidebar', 'server-content'],
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return (
    <div className="relative h-full min-w-0">
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b bg-surface px-3">
            <button
              type="button"
              aria-label="Abrir canais"
              onClick={() => setMobileChannelsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded text-muted hover:bg-sidebar hover:text-ink"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <span className="text-caption font-medium text-muted">Canais do servidor</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      ) : (
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
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </Panel>
        </Group>
      )}

      {mobileChannelsOpen && (
        <div className="absolute inset-0 z-30 flex md:hidden">
          <button
            type="button"
            aria-label="Fechar canais"
            onClick={() => setMobileChannelsOpen(false)}
            className="flex-1 bg-black/50"
          />
          <div className="w-[min(86vw,20rem)] max-w-full shadow-xl">
            <div className="flex h-full flex-col">
              <div className="flex justify-end bg-sidebar px-2 pt-2">
                <button
                  type="button"
                  aria-label="Fechar canais"
                  onClick={() => setMobileChannelsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded text-muted hover:bg-border/40 hover:text-ink"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ChannelSidebar onNavigate={() => setMobileChannelsOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

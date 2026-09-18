import { Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CreateServerModal } from './CreateServerModal';
import { useServers } from './hooks';
import { useNotificationStore } from '../../stores/notificationStore';

/**
 * The persistent far-left "server rail" (Discord-style icon list). Selection is derived
 * from the URL's :serverId param, not duplicated into Zustand — see ARCHITECTURE.md's
 * URL-as-source-of-truth pattern already used by ProtectedRoute/AppRouter.
 */
export function ServerSidebar() {
  const { serverId } = useParams<{ serverId: string }>();
  const location = useLocation();
  const { data: servers } = useServers();
  const [createOpen, setCreateOpen] = useState(false);
  const unreadServerIds = useNotificationStore((state) => state.unreadServerIds);
  const clearServerUnread = useNotificationStore((state) => state.clearServerUnread);
  const unreadFriendIds = useNotificationStore((state) => state.unreadFriendIds);
  const isFriendsAreaSelected = location.pathname.startsWith('/app/friends') || location.pathname.startsWith('/app/dm');

  useEffect(() => {
    if (serverId) clearServerUnread(serverId);
  }, [clearServerUnread, serverId]);

  return (
    <nav
      aria-label="Servers"
      className="flex w-14 flex-shrink-0 flex-col items-center gap-2 overflow-y-auto border-r bg-rail py-2 sm:w-16 sm:py-3"
    >
      <div className="relative flex w-full items-center justify-center">
        {isFriendsAreaSelected && <span className="absolute left-0 h-8 w-1 rounded-r bg-brand" aria-hidden="true" />}
        <Link
          to="/app/friends"
          aria-label="Amigos"
          aria-current={isFriendsAreaSelected ? 'page' : undefined}
          title="Amigos"
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12 ${
            isFriendsAreaSelected ? 'bg-brand text-white' : 'bg-sidebar text-muted hover:bg-brand/20'
          }`}
        >
          <Users size={20} aria-hidden="true" />
          {unreadFriendIds.length > 0 && !isFriendsAreaSelected && (
            <span
              aria-label="Mensagens ou pedidos novos"
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-rail"
            />
          )}
        </Link>
      </div>
      <div className="w-8 border-t" />

      {(servers ?? []).map((server) => {
        const isSelected = server.id === serverId;
        const hasUnread = unreadServerIds.includes(server.id) && !isSelected;
        const initial = server.name.trim().charAt(0).toUpperCase() || '?';

        return (
          <div key={server.id} className="relative flex w-full items-center justify-center">
            {isSelected && (
              <span className="absolute left-0 h-8 w-1 rounded-r bg-brand" aria-hidden="true" />
            )}
            <Link
              to={`/app/servers/${server.id}`}
              aria-label={server.name}
              aria-current={isSelected ? 'page' : undefined}
              title={server.name}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-body font-semibold transition-colors sm:h-12 sm:w-12 ${
                isSelected ? 'bg-brand text-white' : 'bg-sidebar text-muted hover:bg-brand/20'
              }`}
            >
              {initial}
              {hasUnread && (
                <span
                  aria-label="Novas mensagens"
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-rail"
                />
              )}
            </Link>
          </div>
        );
      })}

      <div className="flex w-full flex-col items-center gap-2 border-t pt-2">
        <button
          type="button"
          aria-label="Create server"
          onClick={() => setCreateOpen(true)}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sidebar text-muted hover:bg-brand/20"
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>

      <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </nav>
  );
}

import { AlertTriangle, Plus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CreateServerModal } from './CreateServerModal';
import { useServers } from './hooks';
import { useFriends } from '../friends/hooks';
import { useNotificationStore } from '../../stores/notificationStore';
import { UserProfileCard } from '../users/UserProfileCard';
import type { Friend } from '../../types/friend';
import type { Server } from '../../types/server';

/**
 * The persistent far-left "server rail" (Discord-style icon list). Selection is derived
 * from the URL's :serverId/:friendUserId params, not duplicated into Zustand — see
 * ARCHITECTURE.md's URL-as-source-of-truth pattern already used by ProtectedRoute/AppRouter.
 *
 * Between the friends icon and the server list, it also renders one circle per friend —
 * DMs reuse the friend list (there is no separate "conversations" concept on the backend) so
 * every friend is one tap away, the same way every server is.
 */
export function ServerSidebar() {
  const { serverId, friendUserId } = useParams<{ serverId: string; friendUserId: string }>();
  const location = useLocation();
  const serversQuery = useServers();
  const friendsQuery = useFriends();
  const { data: servers } = serversQuery;
  const { data: friends } = friendsQuery;
  // A failed fetch left `data` undefined, which otherwise renders as an empty rail —
  // indistinguishable from genuinely having no servers/friends (security audit, Baixa finding).
  const hasLoadError = serversQuery.isError || friendsQuery.isError;
  const [createOpen, setCreateOpen] = useState(false);
  const unreadServerIds = useNotificationStore((state) => state.unreadServerIds);
  const clearServerUnread = useNotificationStore((state) => state.clearServerUnread);
  const unreadFriendIds = useNotificationStore((state) => state.unreadFriendIds);
  const isFriendsAreaSelected = location.pathname.startsWith('/app/friends');

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

      {hasLoadError && (
        <button
          type="button"
          aria-label="Falha ao carregar servidores/amigos. Tentar novamente"
          title="Falha ao carregar servidores/amigos. Tentar novamente"
          onClick={() => {
            if (serversQuery.isError) serversQuery.refetch();
            if (friendsQuery.isError) friendsQuery.refetch();
          }}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger transition-colors hover:bg-danger/20 sm:h-12 sm:w-12"
        >
          <AlertTriangle size={18} aria-hidden="true" />
        </button>
      )}

      {(friends ?? []).map((friend) => (
        <FriendRailIcon
          key={friend.friendshipId}
          friend={friend}
          isSelected={friend.user.id === friendUserId}
          hasUnread={unreadFriendIds.includes(friend.user.id) && friend.user.id !== friendUserId}
        />
      ))}

      {(friends ?? []).length > 0 && (servers ?? []).length > 0 && <div className="w-8 border-t" />}

      {(servers ?? []).map((server) => (
        <ServerRailIcon
          key={server.id}
          server={server}
          isSelected={server.id === serverId}
          hasUnread={unreadServerIds.includes(server.id) && server.id !== serverId}
        />
      ))}

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

/**
 * One server's circle in the rail. Mirrors FriendRailIcon's local `iconFailed` flag: a dead
 * iconUrl degrades to the initial rather than a broken image.
 */
function ServerRailIcon({
  server,
  isSelected,
  hasUnread,
}: {
  server: Server;
  isSelected: boolean;
  hasUnread: boolean;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  const initial = server.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative flex w-full items-center justify-center">
      {isSelected && <span className="absolute left-0 h-8 w-1 rounded-r bg-brand" aria-hidden="true" />}
      <Link
        to={`/app/servers/${server.id}`}
        aria-label={server.name}
        aria-current={isSelected ? 'page' : undefined}
        title={server.name}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-body font-semibold transition-colors sm:h-12 sm:w-12 ${
          isSelected ? 'bg-brand text-white' : 'bg-sidebar text-muted hover:bg-brand/20'
        }`}
      >
        {server.iconUrl && !iconFailed ? (
          <img
            src={server.iconUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            onError={() => setIconFailed(true)}
          />
        ) : (
          initial
        )}
        {hasUnread && (
          <span
            aria-label="Novas mensagens"
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-rail"
          />
        )}
      </Link>
    </div>
  );
}

/**
 * One friend's DM entry in the rail. A local `avatarFailed` flag (rather than Avatar's own,
 * differently-sized component) mirrors Avatar.tsx's broken-image fallback so a dead avatarUrl
 * still degrades to the initial, matching the server circles right below it.
 */
function FriendRailIcon({
  friend,
  isSelected,
  hasUnread,
}: {
  friend: Friend;
  isSelected: boolean;
  hasUnread: boolean;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const initial = friend.user.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative flex w-full items-center justify-center">
      {isSelected && <span className="absolute left-0 h-8 w-1 rounded-r bg-brand" aria-hidden="true" />}
      <UserProfileCard user={friend.user}>
        <button
          type="button"
          aria-label={friend.user.displayName}
          title={friend.user.displayName}
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-body font-semibold transition-colors sm:h-12 sm:w-12 ${
            isSelected ? 'bg-brand text-white' : 'bg-sidebar text-muted hover:bg-brand/20'
          }`}
        >
          {friend.user.avatarUrl && !avatarFailed ? (
            <img
              src={friend.user.avatarUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            initial
          )}
          {hasUnread && (
            <span
              aria-label="Novas mensagens"
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-rail"
            />
          )}
        </button>
      </UserProfileCard>
    </div>
  );
}

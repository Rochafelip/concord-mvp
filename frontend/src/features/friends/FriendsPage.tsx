import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  useAcceptFriendRequest,
  useCancelOrDeclineFriendRequest,
  useFriends,
  usePendingFriendRequests,
  useRemoveFriend,
} from './hooks';
import type { Friend, FriendRequest } from '../../types/friend';

type Tab = 'online' | 'all' | 'pending';

const TAB_LABELS: Record<Tab, string> = { online: 'Online', all: 'Todos', pending: 'Pendentes' };

/**
 * Reachable via the dedicated icon at the top of ServerSidebar. Friend requests are started
 * from a shared server's member list (ServerSettingsPanel's Members tab, via AddFriendButton) —
 * this page only manages requests and lists friends/opens DMs.
 */
export function FriendsPage() {
  const [tab, setTab] = useState<Tab>('online');
  const { data: friends = [], isLoading } = useFriends();
  const { data: pending } = usePendingFriendRequests();
  const removeMutation = useRemoveFriend();
  const acceptMutation = useAcceptFriendRequest();
  const cancelMutation = useCancelOrDeclineFriendRequest();
  const unreadFriendIds = useNotificationStore((state) => state.unreadFriendIds);
  const clearFriendUnread = useNotificationStore((state) => state.clearFriendUnread);
  const [friendsListRef] = useAutoAnimate();
  const [incomingListRef] = useAutoAnimate();
  const [outgoingListRef] = useAutoAnimate();

  // This page surfaces both pending requests and (via "Mensagem") every open DM, so opening it
  // addresses everything the friends rail icon's badge was flagging.
  useEffect(() => {
    unreadFriendIds.forEach(clearFriendUnread);
  }, [unreadFriendIds, clearFriendUnread]);

  const onlineFriends = friends.filter((friend) => friend.online);
  const pendingCount = (pending?.incoming.length ?? 0) + (pending?.outgoing.length ?? 0);

  function handleRemove(friend: Friend) {
    if (window.confirm(`Desfazer amizade com ${friend.user.displayName}?`)) {
      removeMutation.mutate(friend.friendshipId);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-app">
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Amigos</h1>
        </header>

        <div className="flex gap-4 border-b border-line">
          {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 px-1 pb-2 text-body font-medium ${
                tab === value ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {TAB_LABELS[value]}
              {value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        {tab !== 'pending' && (
          <ul ref={friendsListRef} className="space-y-1">
            {isLoading && <p className="text-body text-muted">Carregando…</p>}
            {!isLoading && (tab === 'online' ? onlineFriends : friends).length === 0 && (
              <p className="text-body text-muted">
                {tab === 'online'
                  ? 'Nenhum amigo online agora.'
                  : 'Você ainda não tem amigos. Adicione alguém pela lista de membros de um servidor.'}
              </p>
            )}
            {(tab === 'online' ? onlineFriends : friends).map((friend) => (
              <li
                key={friend.friendshipId}
                className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative">
                    <Avatar displayName={friend.user.displayName} avatarUrl={friend.user.avatarUrl} />
                    <span
                      aria-label={friend.online ? 'Online' : 'Offline'}
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-app ${
                        friend.online ? 'bg-success' : 'bg-muted'
                      }`}
                    />
                  </span>
                  <span className="min-w-0 truncate text-body text-ink">{friend.user.displayName}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  <Link to={`/app/dm/${friend.user.id}`}>
                    <Button variant="secondary">Mensagem</Button>
                  </Link>
                  <button
                    type="button"
                    className="text-caption text-muted hover:text-danger hover:underline"
                    onClick={() => handleRemove(friend)}
                  >
                    Remover
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'pending' && (
          <div className="space-y-6">
            <section className="space-y-2">
              <h2 className="text-body font-medium text-muted">Recebidos</h2>
              {(pending?.incoming.length ?? 0) === 0 && (
                <p className="text-body text-muted">Nenhum pedido recebido.</p>
              )}
              <ul ref={incomingListRef} className="space-y-1">
                {pending?.incoming.map((request) => (
                  <PendingRow key={request.friendshipId} request={request}>
                    <Button
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(request.friendshipId)}
                    >
                      Aceitar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(request.friendshipId)}
                    >
                      Recusar
                    </Button>
                  </PendingRow>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-body font-medium text-muted">Enviados</h2>
              {(pending?.outgoing.length ?? 0) === 0 && (
                <p className="text-body text-muted">Nenhum pedido enviado.</p>
              )}
              <ul ref={outgoingListRef} className="space-y-1">
                {pending?.outgoing.map((request) => (
                  <PendingRow key={request.friendshipId} request={request}>
                    <Button
                      variant="secondary"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(request.friendshipId)}
                    >
                      Cancelar
                    </Button>
                  </PendingRow>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRow({ request, children }: { request: FriendRequest; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-surface">
      <span className="flex min-w-0 items-center gap-3">
        <Avatar displayName={request.user.displayName} avatarUrl={request.user.avatarUrl} />
        <span className="min-w-0 truncate text-body text-ink">{request.user.displayName}</span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

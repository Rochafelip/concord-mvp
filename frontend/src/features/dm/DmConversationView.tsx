import { Phone } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { useNotificationStore } from '../../stores/notificationStore';
import { DmCallView } from '../calls/dm/DmCallView';
import { useDmCallStore } from '../calls/dm/dmCallStore';
import { startDmCall } from '../calls/dm/startDmCall';
import { useFriends } from '../friends/hooks';
import { DmMessageInput } from './DmMessageInput';
import { DmMessageList } from './DmMessageList';

/**
 * Mounted at /app/dm/:friendUserId. History stays readable after an unfriend (see the design
 * spec), but the composer only renders while the friendship is still active — sending requires
 * it server-side too (DmMessageService.sendMessage), this just avoids offering an action that
 * would 403.
 */
export function DmConversationView() {
  const { friendUserId } = useParams<{ friendUserId: string }>();
  const { data: friends, isLoading } = useFriends();
  const friend = friends?.find((candidate) => candidate.user.id === friendUserId);
  const clearFriendUnread = useNotificationStore((state) => state.clearFriendUnread);
  const callStatus = useDmCallStore((state) => state.status);
  const callPeerId = useDmCallStore((state) => state.peer?.id);

  useEffect(() => {
    if (friendUserId) clearFriendUnread(friendUserId);
  }, [clearFriendUnread, friendUserId]);

  if (!friendUserId) return null;

  if (callStatus === 'connected' && callPeerId === friendUserId) {
    return <DmCallView />;
  }

  function handleCall() {
    if (!friend) return;
    startDmCall(friend.user);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-14 flex-shrink-0 items-center gap-2 border-b bg-surface px-3 py-3 sm:px-4">
        {friend && <Avatar displayName={friend.user.displayName} avatarUrl={friend.user.avatarUrl} size="sm" />}
        <span className="truncate text-heading font-semibold text-ink">
          {friend?.user.displayName ?? 'Conversa'}
        </span>
        {friend && (
          <button
            type="button"
            aria-label="Ligar"
            title={friend.online ? 'Ligar' : `${friend.user.displayName} está offline`}
            disabled={!friend.online || callStatus !== 'idle'}
            onClick={handleCall}
            className="ml-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted"
          >
            <Phone size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <DmMessageList otherUserId={friendUserId} />

      {friend || isLoading ? (
        <DmMessageInput recipientId={friendUserId} />
      ) : (
        <p className="border-t p-3 text-center text-caption text-muted">
          Vocês não são mais amigos — não é possível enviar novas mensagens.
        </p>
      )}
    </div>
  );
}

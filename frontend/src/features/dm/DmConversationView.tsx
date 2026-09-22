import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { useNotificationStore } from '../../stores/notificationStore';
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

  useEffect(() => {
    if (friendUserId) clearFriendUnread(friendUserId);
  }, [clearFriendUnread, friendUserId]);

  if (!friendUserId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-14 flex-shrink-0 items-center gap-2 border-b bg-surface px-3 py-3 sm:px-4">
        {friend && <Avatar displayName={friend.user.displayName} avatarUrl={friend.user.avatarUrl} size="sm" />}
        <span className="truncate text-heading font-semibold text-ink">
          {friend?.user.displayName ?? 'Conversa'}
        </span>
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

import { useAuthStore } from '../auth/authStore';
import {
  useAcceptFriendRequest,
  useCancelOrDeclineFriendRequest,
  useFriends,
  usePendingFriendRequests,
  useSendFriendRequest,
} from './hooks';

/**
 * Friend action for one member row in ServerSettingsPanel's Members tab — the only place a
 * friend request can be started (docs/superpowers/specs/2026-09-18-friends-and-dm-design.md:
 * discovery is deliberately scoped to shared-server members, no global search).
 */
export function AddFriendButton({ userId }: { userId: string }) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: friends } = useFriends();
  const { data: pending } = usePendingFriendRequests();
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const cancelMutation = useCancelOrDeclineFriendRequest();

  if (userId === currentUserId) return null;
  if ((friends ?? []).some((friend) => friend.user.id === userId)) {
    return <span className="text-caption text-muted">Amigos</span>;
  }

  const incoming = pending?.incoming.find((request) => request.user.id === userId);
  if (incoming) {
    return (
      <button
        type="button"
        className="text-caption text-brand hover:underline disabled:opacity-60"
        disabled={acceptMutation.isPending}
        onClick={() => acceptMutation.mutate(incoming.friendshipId)}
      >
        Aceitar pedido de amizade
      </button>
    );
  }

  const outgoing = pending?.outgoing.find((request) => request.user.id === userId);
  if (outgoing) {
    return (
      <button
        type="button"
        className="text-caption text-muted hover:underline disabled:opacity-60"
        disabled={cancelMutation.isPending}
        onClick={() => cancelMutation.mutate(outgoing.friendshipId)}
      >
        Cancelar pedido enviado
      </button>
    );
  }

  return (
    <button
      type="button"
      className="text-caption text-brand hover:underline disabled:opacity-60"
      disabled={sendMutation.isPending}
      onClick={() => sendMutation.mutate(userId)}
    >
      Adicionar amigo
    </button>
  );
}

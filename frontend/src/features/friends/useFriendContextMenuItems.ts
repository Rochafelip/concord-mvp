import { useNavigate } from 'react-router-dom';
import type { ContextMenuItem } from '../../components/ContextMenu';
import { useDmCallStore } from '../calls/dm/dmCallStore';
import { startDmCall } from '../calls/dm/startDmCall';
import {
  useAcceptFriendRequest,
  useCancelOrDeclineFriendRequest,
  useFriends,
  usePendingFriendRequests,
  useRemoveFriend,
  useSendFriendRequest,
} from './hooks';

/**
 * The friend action(s) for `userId` — send/cancel/accept a request, or once friends: message,
 * call (if online and not already mid-call), and unfriend — as right-click context-menu items.
 * Same state machine as AddFriendButton, offered as ContextMenu entries instead of a rendered
 * button. Consumed by UserProfileCard, which is the one place this needs wiring since every
 * username in the app already renders through it.
 */
export function useFriendContextMenuItems(userId: string): ContextMenuItem[] {
  const navigate = useNavigate();
  const { data: friends } = useFriends();
  const { data: pending } = usePendingFriendRequests();
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const cancelMutation = useCancelOrDeclineFriendRequest();
  const removeMutation = useRemoveFriend();
  const dmCallStatus = useDmCallStore((state) => state.status);

  const friend = (friends ?? []).find((candidate) => candidate.user.id === userId);
  if (friend) {
    const items: ContextMenuItem[] = [{ label: 'Enviar mensagem', onSelect: () => navigate(`/app/dm/${userId}`) }];
    if (friend.online && dmCallStatus === 'idle') {
      items.push({ label: 'Iniciar chamada', onSelect: () => startDmCall(friend.user) });
    }
    items.push({
      label: 'Desfazer amizade',
      variant: 'danger',
      onSelect: () => removeMutation.mutate(friend.friendshipId),
    });
    return items;
  }

  const incoming = pending?.incoming.find((request) => request.user.id === userId);
  if (incoming) {
    return [
      { label: 'Aceitar pedido de amizade', onSelect: () => acceptMutation.mutate(incoming.friendshipId) },
    ];
  }

  const outgoing = pending?.outgoing.find((request) => request.user.id === userId);
  if (outgoing) {
    return [
      { label: 'Cancelar pedido enviado', onSelect: () => cancelMutation.mutate(outgoing.friendshipId) },
    ];
  }

  return [{ label: 'Adicionar amigo', onSelect: () => sendMutation.mutate(userId) }];
}

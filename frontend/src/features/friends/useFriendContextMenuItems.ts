import { useNavigate } from 'react-router-dom';
import type { ContextMenuItem } from '../../components/ContextMenu';
import {
  useAcceptFriendRequest,
  useCancelOrDeclineFriendRequest,
  useFriends,
  usePendingFriendRequests,
  useSendFriendRequest,
} from './hooks';

/**
 * The friend action for `userId` (send/cancel/accept a request, or jump to the DM once friends),
 * as a single right-click context-menu item — same state machine as AddFriendButton, offered
 * as a ContextMenu entry instead of a rendered button. Consumed by UserProfileCard, which is the
 * one place this needs wiring since every username in the app already renders through it.
 */
export function useFriendContextMenuItems(userId: string): ContextMenuItem[] {
  const navigate = useNavigate();
  const { data: friends } = useFriends();
  const { data: pending } = usePendingFriendRequests();
  const sendMutation = useSendFriendRequest();
  const acceptMutation = useAcceptFriendRequest();
  const cancelMutation = useCancelOrDeclineFriendRequest();

  if ((friends ?? []).some((friend) => friend.user.id === userId)) {
    return [{ label: 'Enviar mensagem', onSelect: () => navigate(`/app/dm/${userId}`) }];
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

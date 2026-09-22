import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../services/toast';
import * as api from './api';

const FRIEND_MUTATION_ERROR_MESSAGE = 'Não foi possível completar a ação. Tente novamente.';

function notifyError() {
  toast.error(FRIEND_MUTATION_ERROR_MESSAGE);
}

const FRIENDS_KEY = ['friends'];
const PENDING_KEY = ['friends', 'requests'];

export function useFriends() {
  return useQuery({ queryKey: FRIENDS_KEY, queryFn: api.listFriends });
}

export function usePendingFriendRequests() {
  return useQuery({ queryKey: PENDING_KEY, queryFn: api.listPendingRequests });
}

/** Whether `userId` is already an accepted friend of the current user. */
export function useIsFriend(userId: string | undefined): boolean {
  const { data: friends } = useFriends();
  return userId != null && (friends ?? []).some((friend) => friend.user.id === userId);
}

function useInvalidateFriends() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
    queryClient.invalidateQueries({ queryKey: PENDING_KEY });
  };
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (addresseeId: string) => api.sendFriendRequest(addresseeId),
    onSuccess: invalidate,
    onError: notifyError,
  });
}

export function useAcceptFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (friendshipId: string) => api.acceptFriendRequest(friendshipId),
    onSuccess: invalidate,
    onError: notifyError,
  });
}

export function useCancelOrDeclineFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (friendshipId: string) => api.cancelOrDeclineFriendRequest(friendshipId),
    onSuccess: invalidate,
    onError: notifyError,
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (friendshipId: string) => api.removeFriend(friendshipId),
    onSuccess: invalidate,
    onError: notifyError,
  });
}

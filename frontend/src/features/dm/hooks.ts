import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { websocketClient } from '../../services/websocketClient';
import * as api from './api';

const PAGE_SIZE = 50;

/**
 * Chronological DM history with `otherUserId`, paginated the same way as
 * features/chat/hooks.ts's useMessageHistory — see its comment for the page-ordering contract.
 */
export function useDmHistory(otherUserId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['dm', otherUserId, 'messages'],
    queryFn: ({ pageParam }) => api.getHistory(otherUserId!, pageParam, PAGE_SIZE),
    enabled: otherUserId != null,
    initialPageParam: undefined as api.DmMessageCursor | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const oldestOfPage = lastPage[0];
      return { before: oldestOfPage.createdAt, beforeId: oldestOfPage.id };
    },
  });
}

/**
 * There is no REST endpoint for sending a DM (same reasoning as features/chat/hooks.ts's
 * sendMessage) — the sent message reaches the UI later via the DM_MESSAGE_CREATE broadcast,
 * which includes the sender.
 */
export function sendDmMessage(recipientId: string, content: string): void {
  websocketClient.send({ type: 'DM_MESSAGE_CREATE', payload: { recipientId, content } });
}

const CONVERSATIONS_KEY = ['dm-conversations'];

/** The DM conversations currently visible in this user's list — see
 *  docs/superpowers/specs/2026-09-23-dm-conversation-visibility-design.md. */
export function useDmConversations() {
  return useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: api.listConversations });
}

/** Marks a conversation as opened by the current user, making it visible in their list. */
export function useOpenDmConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) => api.openConversation(otherUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

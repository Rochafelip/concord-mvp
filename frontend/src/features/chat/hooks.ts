import { useInfiniteQuery } from '@tanstack/react-query';
import { websocketClient } from '../../services/websocketClient';
import * as api from './api';

const PAGE_SIZE = 50;

/**
 * Chronological chat history for a channel, paginated backwards via the compound
 * (before, beforeId) cursor (see api.ts). `getNextPageParam` treats "next page" as "the next
 * OLDER page" — the natural fit for useInfiniteQuery's "load more" semantics — which means
 * `data.pages` ends up ordered [newest-fetched, ..., oldest-fetched]. Each individual page
 * comes back oldest-first internally (see MessageController's contract), so a consumer that
 * wants true chronological order must iterate `data.pages` in REVERSE before flattening
 * (done in MessageList, not here, since that's a rendering concern).
 */
export function useMessageHistory(channelId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['channels', channelId, 'messages'],
    queryFn: ({ pageParam }) => api.getHistory(channelId!, pageParam, PAGE_SIZE),
    enabled: channelId != null,
    initialPageParam: undefined as api.MessageCursor | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const oldestOfPage = lastPage[0];
      return { before: oldestOfPage.createdAt, beforeId: oldestOfPage.id };
    },
  });
}

/**
 * There is no REST endpoint for sending a message (docs/ARCHITECTURE.md §18) — this is the
 * only way to send one. Not a TanStack `useMutation` since there's no HTTP response to await;
 * the sent message reaches the UI later via the MESSAGE_CREATE broadcast (useRealtimeSync),
 * which includes the sender, so no local optimistic copy is rendered here.
 */
export function sendMessage(channelId: string, content: string): void {
  websocketClient.send({ type: 'MESSAGE_CREATE', payload: { channelId, content } });
}

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Avatar } from '../../components/Avatar';
import type { Message } from '../../types/message';
import { useMessageHistory } from './hooks';

interface MessageListProps {
  channelId: string;
}

/**
 * `data.pages` is ordered [newest-fetched, ..., oldest-fetched] (see hooks.ts) and each page is
 * already oldest-first internally, so true chronological order requires reversing the PAGES
 * array (not the messages within a page) before flattening.
 */
function toChronologicalOrder(pages: Message[][] | undefined): Message[] {
  if (!pages) return [];
  return [...pages].reverse().flat();
}

export function MessageList({ channelId }: MessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useMessageHistory(channelId);

  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);
  const pendingPrependRef = useRef(false);
  const scrollHeightBeforePrependRef = useRef(0);
  const lastMessageIdRef = useRef<string | undefined>(undefined);

  const messages = useMemo(() => toChronologicalOrder(data?.pages), [data]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (pendingPrependRef.current) {
      // Older history was just prepended: keep the user's current view stable by advancing
      // scrollTop by exactly how much taller the content got, instead of resetting to top.
      const delta = container.scrollHeight - scrollHeightBeforePrependRef.current;
      container.scrollTop += delta;
      pendingPrependRef.current = false;
    } else if (isFirstLoadRef.current) {
      if (messages.length > 0) {
        container.scrollTop = container.scrollHeight;
        isFirstLoadRef.current = false;
      }
    } else {
      const newLastId = messages[messages.length - 1]?.id;
      if (newLastId !== undefined && newLastId !== lastMessageIdRef.current) {
        // A genuinely new message arrived at the bottom (MESSAGE_CREATE via useRealtimeSync) —
        // follow it. Prepending older history never changes the last message's id, so this
        // branch doesn't fire for that case.
        container.scrollTop = container.scrollHeight;
      }
    }

    lastMessageIdRef.current = messages[messages.length - 1]?.id;
  }, [messages]);

  function handleLoadOlder() {
    const container = containerRef.current;
    if (container) {
      scrollHeightBeforePrependRef.current = container.scrollHeight;
      pendingPrependRef.current = true;
    }
    fetchNextPage();
  }

  if (isPending) {
    return <div className="p-4 text-gray-500">Loading messages…</div>;
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
      {hasNextPage && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={isFetchingNextPage}
            className="text-sm text-indigo-600 hover:underline disabled:text-gray-400"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      {messages.map((message) => (
        <div key={message.id} data-testid="message" className="flex items-start gap-3">
          <Avatar displayName={message.author.displayName} avatarUrl={message.author.avatarUrl} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {message.author.displayName}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p data-testid="message-content" className="whitespace-pre-wrap text-sm text-gray-800">
              {message.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

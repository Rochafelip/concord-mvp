import { useLayoutEffect, useMemo, useRef } from 'react';
import { Avatar } from '../../components/Avatar';
import type { Message } from '../../types/message';
import { useMessageHistory } from './hooks';
import { MessageContent } from './MessageContent';

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

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateDivider(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
    return <div className="p-4 text-muted">Loading messages…</div>;
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
      {hasNextPage && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={isFetchingNextPage}
            className="text-body text-brand hover:underline disabled:text-muted"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      {messages.map((message, index) => {
        const createdAt = new Date(message.createdAt);
        const previousCreatedAt =
          index > 0 ? new Date(messages[index - 1].createdAt) : undefined;
        const showDateDivider =
          previousCreatedAt === undefined || !isSameCalendarDay(createdAt, previousCreatedAt);

        return (
          <div key={message.id}>
            {showDateDivider && (
              <div
                data-testid="date-divider"
                className="flex items-center gap-3 py-2 text-caption text-muted"
              >
                <div className="flex-1 border-t" />
                {formatDateDivider(createdAt)}
                <div className="flex-1 border-t" />
              </div>
            )}
            <div data-testid="message" className="flex items-start gap-3">
              <Avatar
                displayName={message.author.displayName}
                avatarUrl={message.author.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-body font-semibold text-ink">
                    {message.author.displayName}
                  </span>
                  <span className="text-caption text-muted">
                    {createdAt.toLocaleTimeString()}
                  </span>
                </div>
                <MessageContent content={message.content} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

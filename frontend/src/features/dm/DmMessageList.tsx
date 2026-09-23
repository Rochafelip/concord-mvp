import { useLayoutEffect, useMemo, useRef } from 'react';
import { Avatar } from '../../components/Avatar';
import { MessageContent } from '../chat/MessageContent';
import { UserProfileCard } from '../users/UserProfileCard';
import { useDmHistory } from './hooks';
import type { DmMessage } from '../../types/dm';

/**
 * Same page-ordering contract as features/chat/MessageList.tsx's toChronologicalOrder — see its
 * comment. Duplicated rather than shared because the two lists diverge in what they render
 * (no attachments, no delete) and sharing a helper this small isn't worth a cross-feature import.
 */
function toChronologicalOrder(pages: DmMessage[][] | undefined): DmMessage[] {
  if (!pages) return [];
  return [...pages].reverse().flat();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateDivider(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function DmMessageList({ otherUserId }: { otherUserId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useDmHistory(otherUserId);

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
    return <div className="p-4 text-muted">Carregando mensagens…</div>;
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
            {isFetchingNextPage ? 'Carregando…' : 'Carregar mensagens antigas'}
          </button>
        </div>
      )}

      {messages.length === 0 && (
        <p className="p-4 text-center text-body text-muted">
          Essa é o início da sua conversa. Diga olá!
        </p>
      )}

      {messages.map((message, index) => {
        const createdAt = new Date(message.createdAt);
        const previousCreatedAt = index > 0 ? new Date(messages[index - 1].createdAt) : undefined;
        const showDateDivider = previousCreatedAt === undefined || !isSameCalendarDay(createdAt, previousCreatedAt);

        return (
          <div key={message.id}>
            {showDateDivider && (
              <div className="flex items-center gap-3 py-2 text-caption text-muted">
                <div className="flex-1 border-t" />
                {formatDateDivider(createdAt)}
                <div className="flex-1 border-t" />
              </div>
            )}
            <div className="flex items-start gap-3">
              <UserProfileCard user={message.author}>
                <button type="button" className="rounded-full">
                  <Avatar displayName={message.author.displayName} avatarUrl={message.author.avatarUrl} size="md" />
                </button>
              </UserProfileCard>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <UserProfileCard user={message.author}>
                    <button type="button" className="rounded text-body font-semibold text-ink hover:underline">
                      {message.author.displayName}
                    </button>
                  </UserProfileCard>
                  <span className="text-caption text-muted">{createdAt.toLocaleTimeString()}</span>
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

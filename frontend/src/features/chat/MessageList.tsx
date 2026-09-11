import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { useAuthStore } from '../auth/authStore';
import { deleteMessage } from './api';
import type { Message } from '../../types/message';
import { useMessageHistory } from './hooks';
import { MessageContent } from './MessageContent';

interface MessageListProps {
  channelId: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'];

function isImageUrl(url: string): boolean {
  const extension = url.split('.').pop()?.toLowerCase();
  return extension != null && IMAGE_EXTENSIONS.includes(extension);
}

function isPdfUrl(url: string): boolean {
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);

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

  async function handleDeleteAttachment(message: Message) {
    if (!window.confirm('Apagar este anexo e a mensagem?')) return;

    setDeletingMessageId(message.id);
    try {
      await deleteMessage(message.id);
    } catch {
      window.alert('Não foi possível apagar o anexo. Tente novamente.');
    } finally {
      setDeletingMessageId(null);
    }
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
                {message.content && <MessageContent content={message.content} />}
                {message.imageUrl && isImageUrl(message.imageUrl) && (
                  <div className="group relative mt-1 w-fit">
                    <img
                      src={message.imageUrl}
                      alt={message.fileName ?? 'Attached image'}
                      className="max-h-80 max-w-md cursor-pointer rounded"
                      onClick={() => setLightboxUrl(message.imageUrl)}
                    />
                    {message.author.id === currentUserId && (
                      <AttachmentDeleteButton
                        disabled={deletingMessageId === message.id}
                        onClick={() => void handleDeleteAttachment(message)}
                      />
                    )}
                  </div>
                )}
                {message.imageUrl && isPdfUrl(message.imageUrl) && (
                  <div className="group relative mt-1 w-full max-w-xl">
                    <iframe
                      src={message.imageUrl}
                      title={message.fileName ?? 'PDF attachment'}
                      className="h-96 w-full rounded border border-line bg-white"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <FileText size={16} className="text-danger" aria-hidden="true" />
                      <a href={message.imageUrl} download={message.fileName ?? 'document.pdf'} className="min-w-0 flex-1 truncate text-small text-brand hover:underline">
                        {message.fileName ?? 'Abrir PDF'}
                      </a>
                      {message.fileSize != null && (
                        <span className="flex-shrink-0 text-caption text-muted">
                          {formatFileSize(message.fileSize)}
                        </span>
                      )}
                      {message.author.id === currentUserId && (
                        <AttachmentDeleteButton
                          disabled={deletingMessageId === message.id}
                          onClick={() => void handleDeleteAttachment(message)}
                        />
                      )}
                    </div>
                  </div>
                )}
                {message.imageUrl && !isImageUrl(message.imageUrl) && (
                  !isPdfUrl(message.imageUrl) && (
                    <div className="group relative mt-1 w-fit">
                      <a
                        href={message.imageUrl}
                        download={message.fileName ?? undefined}
                        className="flex max-w-xs items-center gap-2 rounded border p-2 pr-11 text-body text-ink hover:bg-sidebar"
                      >
                        <span className="min-w-0 flex-1 truncate">{message.fileName ?? 'File'}</span>
                        {message.fileSize != null && (
                          <span className="flex-shrink-0 text-caption text-muted">
                            {formatFileSize(message.fileSize)}
                          </span>
                        )}
                      </a>
                      {message.author.id === currentUserId && (
                        <AttachmentDeleteButton
                          disabled={deletingMessageId === message.id}
                          onClick={() => void handleDeleteAttachment(message)}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Modal open={lightboxUrl != null} onClose={() => setLightboxUrl(null)}>
        {lightboxUrl && <img src={lightboxUrl} alt="Full-size attachment" className="max-h-[80vh] max-w-[80vw]" />}
      </Modal>
    </div>
  );
}

function AttachmentDeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Apagar anexo"
      title="Apagar anexo"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/65 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100 disabled:cursor-wait disabled:opacity-60"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

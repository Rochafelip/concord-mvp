import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { useAuthStore } from '../auth/authStore';
import { deleteMessage } from './api';
import type { Attachment, Message } from '../../types/message';
import { useMarkChannelAsRead } from '../channels/hooks';
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
  // Destructured because TanStack keeps `mutate` stable across renders while the mutation object
  // itself is a new value every render — depending on the object would re-run the effect below on
  // every render and mark the channel read in a loop.
  const { mutate: markChannelAsRead } = useMarkChannelAsRead();

  // Mark channel as read when messages are loaded
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      markChannelAsRead({
        channelId,
        lastReadMessageId: lastMessage.id,
      });
    }
  }, [channelId, messages, markChannelAsRead]);

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

  async function handleDeleteMessage(message: Message) {
    const confirmText = message.attachments.length > 0
      ? 'Apagar esta mensagem e seus anexos?'
      : 'Apagar esta mensagem?';
    if (!window.confirm(confirmText)) return;

    setDeletingMessageId(message.id);
    try {
      await deleteMessage(message.id);
    } catch {
      const errorText = message.attachments.length > 0
        ? 'Não foi possível apagar a mensagem e seus anexos. Tente novamente.'
        : 'Não foi possível apagar a mensagem. Tente novamente.';
      window.alert(errorText);
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
                <div className="group relative">
                  {message.content && <MessageContent content={message.content} />}
                  {message.author.id === currentUserId && (
                    <TextDeleteButton
                      disabled={deletingMessageId === message.id}
                      onClick={() => void handleDeleteMessage(message)}
                    />
                  )}
                </div>
                {message.attachments.length > 0 && (
                  <div
                    data-testid="message-attachments"
                    className={
                      message.attachments.length > 1
                        ? 'mt-1 grid max-w-xl grid-cols-2 gap-2'
                        : 'mt-1'
                    }
                  >
                    {message.attachments.map((attachment, attachmentIndex) => (
                      <MessageAttachment
                        key={`${message.id}-${attachmentIndex}`}
                        attachment={attachment}
                        isGrouped={message.attachments.length > 1}
                        onOpenImage={setLightboxUrl}
                      />
                    ))}
                  </div>
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

function TextDeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Apagar mensagem"
      title="Apagar mensagem"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-danger hover:bg-sidebar group-hover:opacity-100 disabled:cursor-wait disabled:opacity-60"
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}


/**
 * One attachment inside a message. The backend only ever deletes a whole message, so there is no
 * per-attachment delete here — the message-level button above covers it.
 */
function MessageAttachment({
  attachment,
  isGrouped,
  onOpenImage,
}: {
  attachment: Attachment;
  isGrouped: boolean;
  onOpenImage: (url: string) => void;
}) {
  if (isImageUrl(attachment.url)) {
    return (
      <img
        src={attachment.url}
        alt={attachment.fileName ?? 'Attached image'}
        // Grouped images are boxed to a uniform tile so a mixed set of aspect ratios still reads
        // as one grid; a lone image keeps its natural shape.
        className={
          isGrouped
            ? 'h-40 w-full cursor-pointer rounded object-cover'
            : 'max-h-80 max-w-md cursor-pointer rounded'
        }
        onClick={() => onOpenImage(attachment.url)}
      />
    );
  }

  if (isPdfUrl(attachment.url)) {
    return (
      <div className="w-full">
        <iframe
          src={attachment.url}
          title={attachment.fileName ?? 'PDF attachment'}
          className={`w-full rounded border border-line bg-white ${isGrouped ? 'h-40' : 'h-96'}`}
        />
        <div className="mt-2 flex items-center gap-2">
          <FileText size={16} className="text-danger" aria-hidden="true" />
          <a
            href={attachment.url}
            download={attachment.fileName ?? 'document.pdf'}
            className="min-w-0 flex-1 truncate text-small text-brand hover:underline"
          >
            {attachment.fileName ?? 'Abrir PDF'}
          </a>
          {attachment.fileSize != null && (
            <span className="flex-shrink-0 text-caption text-muted">
              {formatFileSize(attachment.fileSize)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.fileName ?? undefined}
      className="flex max-w-xs items-center gap-2 rounded border p-2 text-body text-ink hover:bg-sidebar"
    >
      <span className="min-w-0 flex-1 truncate">{attachment.fileName ?? 'File'}</span>
      {attachment.fileSize != null && (
        <span className="flex-shrink-0 text-caption text-muted">
          {formatFileSize(attachment.fileSize)}
        </span>
      )}
    </a>
  );
}

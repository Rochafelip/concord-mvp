import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { uploadAttachment } from './api';
import { sendMessage } from './hooks';

const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024;
/** Mirrors MessageService.MAX_ATTACHMENTS — the backend rejects an 11th with a 400. */
const MAX_ATTACHMENTS = 10;

interface MessageInputProps {
  channelId: string;
  /**
   * ATTACH_FILES in this channel, resolved by ChatWindow. Defaults to false so a caller that has
   * not resolved it yet hides the control rather than offering an action the backend refuses.
   */
  canAttachFiles?: boolean;
}

interface PendingAttachment {
  /** Stable key for React and for removal — `file.name` is not unique (and can be empty). */
  id: string;
  file: File;
  /** Object URL for the thumbnail; null for a non-image, which renders as a chip instead. */
  previewUrl: string | null;
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A screenshot pasted from the OS clipboard (Win + Shift + S, macOS Shift-Cmd-4, etc.) arrives as
 * a File whose `name` is either empty or a generic "image.png" that every paste reuses. Give it a
 * unique, recognizable name so the message shows something meaningful and two screenshots in the
 * same message don't look identical in the attachment list.
 */
function namePastedFile(file: File): File {
  if (file.name && file.name !== 'image.png') return file;

  const extension = file.type.split('/')[1]?.split('+')[0] || 'png';
  return new File([file], `pasted-image-${Date.now()}.${extension}`, { type: file.type });
}

export function MessageInput({ channelId, canAttachFiles = false }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useWsConnectionStore((state) => state.status);
  const isConnected = status === 'connected';

  // Mirrors the current attachments so the cleanup below can revoke their object URLs without
  // listing `attachments` as a dependency — which would make it tear down and re-run on every
  // single attach, revoking URLs that are still on screen.
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Two jobs, one cleanup. Object URLs are held by the browser until explicitly revoked, and the
  // component going away (unmount) or switching channels both strand them. Discarding the
  // pending attachments on a channel switch is also a correctness matter: an attachment staged
  // in one channel must not be sent to another one the user navigated to.
  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
      setAttachments([]);
      setUploadError(null);
    };
  }, [channelId]);

  function clearAttachments(pending: PendingAttachment[]) {
    for (const attachment of pending) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachments([]);
  }

  /**
   * The single entry point for all three ways to attach a file (paste, the paperclip, drag &
   * drop), so the limits and the preview behave identically whichever one the user reaches for.
   */
  function attachFiles(files: File[]) {
    // Covers all three entry points at once — paperclip, paste and drag & drop — so none of them
    // can stage a file the user is not allowed to upload.
    if (!canAttachFiles) return;
    if (files.length === 0) return;

    // Computed outside the state updater, which must stay free of side effects (creating object
    // URLs and setting the error) — React may invoke an updater more than once.
    const alreadyPending = attachments.length;
    const accepted: PendingAttachment[] = [];
    let rejectedForSize = false;
    let rejectedForCount = false;

    for (const file of files) {
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        rejectedForSize = true;
        continue;
      }
      if (alreadyPending + accepted.length >= MAX_ATTACHMENTS) {
        rejectedForCount = true;
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: isImage(file) ? URL.createObjectURL(file) : null,
      });
    }

    // Both can happen in one drop of many files; the size limit is the more actionable one.
    if (rejectedForSize) {
      setUploadError('File exceeds the 150 MB limit');
    } else if (rejectedForCount) {
      setUploadError(`A message can have at most ${MAX_ATTACHMENTS} attachments`);
    } else {
      setUploadError(null);
    }

    if (accepted.length > 0) {
      setAttachments((current) => [...current, ...accepted]);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
    setUploadError(null);
  }

  /**
   * Only intercepts the paste when the clipboard actually carries image files. Pasting text —
   * including text copied alongside an image, as some apps do — must keep its native behavior,
   * otherwise the composer would swallow ordinary Ctrl+V.
   */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const imageFiles = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null)
      .map(namePastedFile);

    if (imageFiles.length === 0) return;

    event.preventDefault();
    attachFiles(imageFiles);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    // `relatedTarget` is where the pointer went; if it's still inside the form, this is just the
    // cursor crossing a child element, not actually leaving the drop zone.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingOver(false);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    attachFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset the input's value immediately so picking the exact same file twice in a row still
    // fires this handler again.
    if (fileInputRef.current) fileInputRef.current.value = '';
    attachFiles(files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Blocks empty/whitespace-only content client-side (docs/PRODUCT.md §9.5), unless there is
    // an attachment to carry the message on its own.
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    // websocketClient.send() fails silently when the socket isn't open (by design — see
    // websocketClient.ts), so this component must not give the user any sign the message was
    // sent unless it actually could be (docs/PRODUCT.md §16: no silent failure of the user's
    // ability to communicate). The disabled button below already blocks this in the UI, but
    // guard here too in case of a race between the button's disabled state and a submit event.
    if (!isConnected) return;
    if (isUploading) return;

    if (attachments.length === 0) {
      sendMessage(channelId, trimmed);
      // Clear immediately — no optimistic render to wait for. The sent message reaches the list
      // shortly via the MESSAGE_CREATE broadcast, which includes the sender by design.
      setContent('');
      return;
    }

    const pending = attachments;
    setIsUploading(true);
    setUploadError(null);
    try {
      // All or nothing: a message shows its attachments together, so a partial upload would
      // either post an incomplete message or strand already-uploaded files with no message
      // pointing at them. On failure the previews stay put so the user can just retry.
      const uploaded = await Promise.all(
        pending.map((attachment) => uploadAttachment(channelId, attachment.file)),
      );

      // The connection can drop DURING the uploads, so this is checked again here rather than
      // only once before starting — otherwise the files would upload successfully but the
      // message announcing them would silently vanish. Read the store directly instead of the
      // `isConnected` closed over at the top of this function: that variable is fixed to
      // whatever render was active when this async function started.
      const stillConnected = useWsConnectionStore.getState().status === 'connected';
      if (!stillConnected) {
        setUploadError('Not connected — the files were uploaded but the message could not be sent');
        return;
      }

      sendMessage(
        channelId,
        trimmed,
        uploaded.map((result) => ({
          url: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
        })),
      );
      setContent('');
      clearAttachments(pending);
    } catch {
      setUploadError('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }

  const canSend = isConnected && !isUploading && (content.trim().length > 0 || attachments.length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="message-composer"
      className={`flex flex-col gap-1 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3 ${
        isDraggingOver ? 'bg-brand/5 ring-2 ring-inset ring-brand' : ''
      }`}
    >
      {attachments.length > 0 && (
        <ul
          aria-label="Pending attachments"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="relative flex-shrink-0 rounded border bg-sidebar p-1"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-20 w-20 rounded object-cover"
                />
              ) : (
                <div className="flex h-20 w-40 flex-col justify-center gap-0.5 px-2">
                  <span className="truncate text-caption text-ink">{attachment.file.name}</span>
                  <span className="text-caption text-muted">{formatFileSize(attachment.file.size)}</span>
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${attachment.file.name}`}
                title="Remove attachment"
                disabled={isUploading}
                onClick={() => removeAttachment(attachment.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white hover:bg-danger disabled:cursor-wait disabled:opacity-60"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        <div className="flex-1">
          <TextInput
            label="Message"
            name="content"
            autoComplete="off"
            hideLabel
            pill
            placeholder={isConnected ? 'Message…' : 'Reconnecting…'}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={handlePaste}
          />
        </div>
        {canAttachFiles && (
          <label className="flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink">
            <Paperclip size={18} aria-hidden="true" />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              aria-label="Attach file"
              disabled={isUploading || !isConnected}
              onChange={handleFileSelected}
              className="sr-only"
            />
          </label>
        )}
        <Button type="submit" disabled={!canSend}>
          <span className="hidden sm:inline">{isUploading ? 'Sending…' : 'Send'}</span>
          <span className="sm:hidden" aria-hidden="true">↑</span>
        </Button>
      </div>
      {!isConnected && (
        <p className="text-caption text-warning">
          Not connected — reconnecting… messages can&apos;t be sent right now.
        </p>
      )}
      {uploadError && <p className="text-caption text-danger">{uploadError}</p>}
    </form>
  );
}

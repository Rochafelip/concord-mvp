import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { uploadAttachment } from './api';
import { sendMessage } from './hooks';

const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024;

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useWsConnectionStore((state) => state.status);
  const isConnected = status === 'connected';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Blocks empty/whitespace-only content client-side (docs/PRODUCT.md §9.5).
    const trimmed = content.trim();
    if (!trimmed) return;

    // websocketClient.send() fails silently when the socket isn't open (by design — see
    // websocketClient.ts), so this component must not give the user any sign the message was
    // sent unless it actually could be (docs/PRODUCT.md §16: no silent failure of the user's
    // ability to communicate). The disabled button below already blocks this in the UI, but
    // guard here too in case of a race between the button's disabled state and a submit event.
    if (!isConnected) return;

    sendMessage(channelId, trimmed);
    // Clear immediately — no optimistic render to wait for. The sent message reaches the list
    // shortly via the MESSAGE_CREATE broadcast, which includes the sender by design.
    setContent('');
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input's value immediately (both success and failure paths) so picking the exact
    // same file twice in a row still fires this handler again.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setUploadError(null);

    // Same silent-failure concern as handleSubmit: don't even start the upload if the socket is
    // already known to be closed — the input's own disabled state below covers most cases, but
    // guard here too against a race between that disabled state and a change event.
    if (!isConnected) {
      setUploadError('Not connected — reconnecting… files can’t be sent right now');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError('File exceeds the 150 MB limit');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadAttachment(channelId, file);
      // websocketClient.send() fails silently when the socket isn't open (see handleSubmit's
      // comment above) — the connection can also drop DURING the upload itself, so this is
      // checked again here rather than only once before starting, otherwise the file would
      // upload successfully but the message announcing it would silently vanish. Read the store
      // directly instead of the `isConnected` closed over at the top of this function — that
      // variable is fixed to whatever render was active when this async function started, so it
      // would silently miss a disconnect that happened during the `await` above.
      const stillConnected = useWsConnectionStore.getState().status === 'connected';
      if (!stillConnected) {
        setUploadError('Not connected — the file was uploaded but the message could not be sent');
        return;
      }
      // Whatever the user had typed becomes this message's caption.
      sendMessage(channelId, content.trim(), result.url, result.fileName, result.fileSize);
      setContent('');
    } catch {
      setUploadError('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
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
          />
        </div>
        <label className="flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink">
          <Paperclip size={18} aria-hidden="true" />
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Attach file"
            disabled={isUploading || !isConnected}
            onChange={handleFileSelected}
            className="sr-only"
          />
        </label>
        <Button type="submit" disabled={!isConnected || content.trim().length === 0}>
          <span className="hidden sm:inline">Send</span>
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

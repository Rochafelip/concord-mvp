import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { uploadAttachment } from './api';
import { sendMessage } from './hooks';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

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

    // file.type is just a fast client-side UX hint (browser-reported, spoofable) — the backend
    // independently validates by actual file content and is the authoritative gate.
    const isImage = IMAGE_MIME_TYPES.includes(file.type);
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
    if (file.size > maxSize) {
      setUploadError(isImage ? 'Image exceeds the 8 MB limit' : 'File exceeds the 50 MB limit');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadAttachment(channelId, file);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 border-t p-3">
      <div className="flex items-end gap-2">
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
            disabled={isUploading}
            onChange={handleFileSelected}
            className="sr-only"
          />
        </label>
        <Button type="submit" disabled={!isConnected || content.trim().length === 0}>
          Send
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

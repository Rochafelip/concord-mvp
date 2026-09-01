import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { sendMessage } from './hooks';

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const [content, setContent] = useState('');
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 border-t border-gray-200 p-3">
      <div className="flex items-end gap-2">
        <TextInput
          label="Message"
          name="content"
          autoComplete="off"
          className="flex-1"
          placeholder={isConnected ? 'Message…' : 'Reconnecting…'}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <Button type="submit" disabled={!isConnected || content.trim().length === 0}>
          Send
        </Button>
      </div>
      {!isConnected && (
        <p className="text-xs text-amber-600">
          Not connected — reconnecting… messages can&apos;t be sent right now.
        </p>
      )}
    </form>
  );
}

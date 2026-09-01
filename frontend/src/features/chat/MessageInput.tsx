import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { sendMessage } from './hooks';

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const [content, setContent] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Blocks empty/whitespace-only content client-side (docs/PRODUCT.md §9.5).
    const trimmed = content.trim();
    if (!trimmed) return;

    sendMessage(channelId, trimmed);
    // Clear immediately — no optimistic render to wait for. The sent message reaches the list
    // shortly via the MESSAGE_CREATE broadcast, which includes the sender by design.
    setContent('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-gray-200 p-3">
      <TextInput
        label="Message"
        name="content"
        autoComplete="off"
        className="flex-1"
        placeholder="Message…"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <Button type="submit" disabled={content.trim().length === 0}>
        Send
      </Button>
    </form>
  );
}

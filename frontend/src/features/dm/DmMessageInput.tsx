import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { EmojiPickerButton } from '../../components/EmojiPickerButton';
import { TextInput } from '../../components/TextInput';
import { useWsConnectionStore } from '../../stores/wsConnectionStore';
import { sendDmMessage } from './hooks';

/**
 * Simplified sibling of features/chat/MessageInput.tsx — no attachments (out of scope for DM
 * v1, see the design spec), so no upload/paste/drag-and-drop plumbing to carry over.
 */
export function DmMessageInput({ recipientId }: { recipientId: string }) {
  const [content, setContent] = useState('');
  const status = useWsConnectionStore((state) => state.status);
  const isConnected = status === 'connected';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !isConnected) return;

    sendDmMessage(recipientId, trimmed);
    setContent('');
  }

  const canSend = isConnected && content.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3"
    >
      <div className="flex items-end gap-1.5 sm:gap-2">
        <div className="flex-1">
          <TextInput
            label="Mensagem"
            name="content"
            autoComplete="off"
            hideLabel
            pill
            placeholder={isConnected ? 'Mensagem…' : 'Reconectando…'}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            trailing={<EmojiPickerButton onSelect={(emoji) => setContent((current) => current + emoji)} />}
          />
        </div>
        <Button type="submit" disabled={!canSend}>
          <span className="hidden sm:inline">Enviar</span>
          <span className="sm:hidden" aria-hidden="true">↑</span>
        </Button>
      </div>
      {!isConnected && (
        <p className="text-caption text-warning">
          Sem conexão — reconectando… não é possível enviar mensagens agora.
        </p>
      )}
    </form>
  );
}

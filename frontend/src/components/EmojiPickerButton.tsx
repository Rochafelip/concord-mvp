import * as Popover from '@radix-ui/react-popover';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPickerButton({ onSelect }: EmojiPickerButtonProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Add emoji"
          className="flex h-10 w-10 items-center justify-center rounded text-muted hover:text-ink"
        >
          <Smile size={18} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={6}
          className="z-[110] overflow-hidden rounded border border-border shadow-lg"
        >
          <EmojiPicker theme={Theme.AUTO} onEmojiClick={(data) => onSelect(data.emoji)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

import * as RadixContextMenu from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';

interface ContextMenuItem {
  label: ReactNode;
  onSelect: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
  /** Leaves the native browser context menu untouched — used when the current user has no
   * permission to act on the right-clicked target, matching what a plain onContextMenu handler
   * that never calls preventDefault() would do. */
  disabled?: boolean;
}

const ITEM_VARIANT_CLASSES: Record<'default' | 'danger', string> = {
  default: 'text-ink data-[highlighted]:bg-brand data-[highlighted]:text-white',
  danger: 'text-danger data-[highlighted]:bg-danger/10',
};

export function ContextMenu({ children, items, disabled = false }: ContextMenuProps) {
  // Trigger's own `disabled` (rather than swapping the whole tree for a bare fragment) keeps the
  // wrapped element's position in the React tree stable across renders — important for callers
  // like ScreenShareTile, where `disabled` flips based on fullscreen state on an element that's
  // also the Fullscreen API target: unmounting it mid-toggle would kick it back out.
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild disabled={disabled || items.length === 0}>
        {children}
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="z-[110] min-w-44 rounded border border-border bg-surface p-1 shadow-lg">
          {items.map((item, index) => (
            <RadixContextMenu.Item
              key={index}
              onSelect={item.onSelect}
              className={`cursor-pointer rounded px-2 py-1.5 text-caption outline-none ${ITEM_VARIANT_CLASSES[item.variant ?? 'default']}`}
            >
              {item.label}
            </RadixContextMenu.Item>
          ))}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

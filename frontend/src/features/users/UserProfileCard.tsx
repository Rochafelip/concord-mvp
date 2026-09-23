import * as Popover from '@radix-ui/react-popover';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { ContextMenu, type ContextMenuEntry, type ContextMenuItem } from '../../components/ContextMenu';
import { useAuthStore } from '../auth/authStore';
import { AddFriendButton } from '../friends/AddFriendButton';
import { useIsFriend } from '../friends/hooks';
import { useFriendContextMenuItems } from '../friends/useFriendContextMenuItems';

interface UserProfileCardProps {
  user: { id: string; displayName: string; avatarUrl?: string | null };
  /** The single element that opens the card on click — becomes the popover's real DOM trigger
   * via Radix's `asChild` (same pattern as components/EmojiPickerButton.tsx), so no extra
   * wrapping element is introduced beyond what the caller already passes. */
  children: ReactElement;
  /** Extra right-click items a caller wants in the same menu as the friend action, e.g.
   * ChannelSidebar's "Disconnect from voice" for the voice participant list. Separated from the
   * friend item with a divider when both are present. */
  contextMenuExtraItems?: ContextMenuItem[];
}

/**
 * Wraps one avatar/username element with two ways to act on that user: clicking opens a small
 * profile popover (avatar, name, the existing friend-request action via AddFriendButton, and a
 * "Enviar mensagem" link once the two are friends — DM requires accepted friendship, see
 * docs/superpowers/specs/2026-09-18-friends-and-dm-design.md); right-clicking opens a context
 * menu with the same friend action collapsed to one item (useFriendContextMenuItems), plus
 * whatever `contextMenuExtraItems` the caller supplies. No-ops for the viewer's own id: no
 * popover, and the context menu only shows `contextMenuExtraItems` (no friend action against
 * yourself).
 */
export function UserProfileCard({ user, children, contextMenuExtraItems = [] }: UserProfileCardProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isFriend = useIsFriend(user.id);
  const isSelf = user.id === currentUserId;
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Always called (rules of hooks) even for the viewer's own id; the result is simply unused
  // below since `menuItems` short-circuits to `contextMenuExtraItems` for `isSelf`.
  const friendMenuItems = useFriendContextMenuItems(user.id);

  const menuItems: ContextMenuEntry[] = isSelf
    ? contextMenuExtraItems
    : [{ label: 'Perfil', onSelect: () => setPopoverOpen(true) }, ...friendMenuItems, ...(contextMenuExtraItems.length > 0 ? [{ separator: true } as const, ...contextMenuExtraItems] : [])];

  if (isSelf) {
    return <ContextMenu items={menuItems}>{children}</ContextMenu>;
  }

  return (
    <ContextMenu items={menuItems}>
      {/* display:contents keeps this wrapper out of layout entirely — ContextMenu needs a real
          DOM node to attach the right-click handler to, but Popover.Root itself doesn't forward
          a ref, so it can't be that node directly (same constraint noted where ChannelSidebar
          used to wrap its own ContextMenu around a plain div for this reason). */}
      <span className="contents">
        {/* Controlled (not just left-click-uncontrolled) so the right-click menu's "Perfil"
            item can open the same popover programmatically. */}
        <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Popover.Trigger asChild>{children}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={6}
              className="z-[110] w-56 rounded border border-border bg-surface p-3 shadow-lg"
            >
              <div className="flex items-center gap-2">
                <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size="lg" />
                <span className="min-w-0 truncate text-body font-semibold text-ink">{user.displayName}</span>
              </div>
              <div className="mt-3 flex flex-col items-start gap-1.5">
                {isFriend && (
                  <Popover.Close asChild>
                    <Link to={`/app/dm/${user.id}`} className="text-caption text-brand hover:underline">
                      Enviar mensagem
                    </Link>
                  </Popover.Close>
                )}
                <AddFriendButton userId={user.id} />
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </ContextMenu>
  );
}

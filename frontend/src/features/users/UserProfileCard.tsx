import * as Popover from '@radix-ui/react-popover';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../auth/authStore';
import { AddFriendButton } from '../friends/AddFriendButton';
import { useIsFriend } from '../friends/hooks';

interface UserProfileCardProps {
  user: { id: string; displayName: string; avatarUrl?: string | null };
  /** The single element that opens the card on click — becomes the popover's real DOM trigger
   * via Radix's `asChild` (same pattern as components/EmojiPickerButton.tsx), so no extra
   * wrapping element is introduced beyond what the caller already passes. */
  children: ReactElement;
}

/**
 * Wraps one avatar/username element so clicking it opens a small profile popover: avatar, name,
 * the existing friend-request action (AddFriendButton, unchanged), and a "Enviar mensagem" link
 * that only appears once the two are friends — DM requires accepted friendship (see
 * docs/superpowers/specs/2026-09-18-friends-and-dm-design.md). No-ops for the viewer's own id:
 * `children` renders unwrapped instead of opening a popover about yourself.
 */
export function UserProfileCard({ user, children }: UserProfileCardProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isFriend = useIsFriend(user.id);

  if (user.id === currentUserId) {
    return children;
  }

  return (
    <Popover.Root>
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
  );
}

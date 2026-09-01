import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import {
  useDeleteServer,
  useInvite,
  useIsServerOwner,
  useLeaveServer,
  useRegenerateInvite,
  useServer,
  useServerMembers,
  useTransferOwnership,
} from './hooks';

interface ServerSettingsPanelProps {
  serverId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Reachable via the gear icon in ChannelSidebar's header. Shows the invite code + member
 * list + ownership/leave actions, gated per docs/DECISIONS.md D6-D8: only the owner sees
 * the invite code, can transfer ownership, or delete the server, and the owner cannot leave
 * without transferring or deleting first (the backend is the real source of truth for that
 * rule — this UI just hides/disables the action so nobody has to hit the 403).
 */
export function ServerSettingsPanel({ serverId, open, onClose }: ServerSettingsPanelProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: server } = useServer(serverId);
  // Gated on `open`: this panel is always mounted (Modal just hides its DOM when closed), so
  // without this these would fire a members/invite GET as soon as any server is opened,
  // before the settings panel has ever been clicked open.
  const { data: members } = useServerMembers(open ? serverId : undefined);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const isOwner = useIsServerOwner(serverId);

  const inviteQuery = useInvite(open && isOwner ? serverId : undefined);
  const regenerateInviteMutation = useRegenerateInvite(serverId);
  const transferOwnershipMutation = useTransferOwnership(serverId);
  const deleteServerMutation = useDeleteServer();
  const leaveServerMutation = useLeaveServer();

  async function handleCopy() {
    if (!inviteQuery.data) return;
    try {
      await navigator.clipboard.writeText(inviteQuery.data.code);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // Clipboard API unavailable/denied — the code is still shown on screen to copy by hand.
    }
  }

  function handleRegenerate() {
    if (window.confirm('Regenerate the invite code? The current code will stop working immediately.')) {
      regenerateInviteMutation.mutate();
    }
  }

  function handleTransfer(newOwnerId: string, displayName: string) {
    if (window.confirm(`Transfer ownership to ${displayName}? You will no longer be the owner.`)) {
      transferOwnershipMutation.mutate({ newOwnerId });
    }
  }

  function handleDelete() {
    if (
      window.confirm(
        'Delete this server? This cannot be undone — all channels and messages will be permanently deleted.',
      )
    ) {
      deleteServerMutation.mutate(serverId);
    }
  }

  function handleLeave() {
    if (window.confirm('Leave this server?')) {
      leaveServerMutation.mutate(serverId);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-80 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{server?.name ?? 'Server'} settings</h2>

        {isOwner && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Invite code</h3>
            <ErrorBanner
              message={inviteQuery.error instanceof ApiError ? inviteQuery.error.message : null}
            />
            {inviteQuery.data && (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 text-sm">
                  {inviteQuery.data.code}
                </code>
                <Button type="button" variant="secondary" onClick={handleCopy}>
                  {copyState === 'copied' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleRegenerate}
              disabled={regenerateInviteMutation.isPending}
            >
              Regenerate code
            </Button>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Members</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {(members ?? []).map((member) => (
              <li key={member.user.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Avatar
                    displayName={member.user.displayName}
                    avatarUrl={member.user.avatarUrl}
                    className="h-6 w-6"
                  />
                  {member.user.displayName}
                  {server?.ownerId === member.user.id && (
                    <span className="text-xs uppercase text-gray-400">Owner</span>
                  )}
                </span>
                {isOwner && member.user.id !== currentUserId && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:underline"
                    onClick={() => handleTransfer(member.user.id, member.user.displayName)}
                  >
                    Make owner
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 border-t border-gray-200 pt-4">
          {isOwner ? (
            <>
              <p className="text-xs text-gray-500">
                You're the owner, so you can't leave directly — transfer ownership or delete
                the server instead.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled
                title="Transfer ownership or delete the server to leave"
              >
                Leave server
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full border border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleteServerMutation.isPending}
              >
                Delete server
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleLeave}
              disabled={leaveServerMutation.isPending}
            >
              Leave server
            </Button>
          )}
        </section>
      </div>
    </Modal>
  );
}

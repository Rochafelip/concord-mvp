import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../auth/authStore';
import { MemberRoleEditor } from '../permissions/MemberRoleEditor';
import { useRoles } from '../permissions/hooks';
import { RolesTab } from '../permissions/RolesTab';
import { UserProfileCard } from '../users/UserProfileCard';
import {
  useDeleteServer,
  useInvite,
  useHasPermission,
  useIsServerOwner,
  useLeaveServer,
  useRegenerateInvite,
  useServer,
  useServerMembers,
  useTransferOwnership,
  useUpdateMyServerMember,
} from './hooks';

interface ServerSettingsPanelProps {
  serverId: string;
  open: boolean;
  onClose: () => void;
}

type Tab = 'overview' | 'roles' | 'members';

const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', roles: 'Roles', members: 'Members' };

/**
 * Reachable via the gear icon in ChannelSidebar's header. Overview has the invite code + your
 * display name + ownership/leave actions, gated per docs/DECISIONS.md D6-D8: only the owner sees
 * the invite code, can transfer ownership, or delete the server, and the owner cannot leave
 * without transferring or deleting first (the backend is the real source of truth for that
 * rule — this UI just hides/disables the action so nobody has to hit the 403). Roles and Members
 * are their own tabs — role editing (name/color/permissions) and per-member role assignment don't
 * fit in a single narrow column together with all of the above.
 */
export function ServerSettingsPanel({ serverId, open, onClose }: ServerSettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: server } = useServer(serverId);
  // Gated on `open`: this panel is always mounted (Modal just hides its DOM when closed), so
  // without this these would fire a members/invite GET as soon as any server is opened,
  // before the settings panel has ever been clicked open.
  const { data: members } = useServerMembers(open ? serverId : undefined);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [displayNameDraft, setDisplayNameDraft] = useState<{ serverId: string; value: string } | null>(null);

  // Deleting the server and transferring ownership are not delegable by permission (D20), so
  // they stay on isOwner. The invite code moved to MANAGE_INVITES.
  const isOwner = useIsServerOwner(serverId);
  const canManageInvites = useHasPermission(serverId, 'MANAGE_INVITES');
  const canManageRoles = useHasPermission(serverId, 'MANAGE_ROLES');
  // Gated on canManageRoles, not just `open`: `roles` is only ever rendered inside RolesTab and
  // MemberRoleEditor, both already gated on the same permission — matches useInvite just below.
  const { data: roles } = useRoles(open && canManageRoles ? serverId : undefined);

  const inviteQuery = useInvite(open && canManageInvites ? serverId : undefined);
  const regenerateInviteMutation = useRegenerateInvite(serverId);
  const transferOwnershipMutation = useTransferOwnership(serverId);
  const updateMemberMutation = useUpdateMyServerMember(serverId);
  const deleteServerMutation = useDeleteServer();
  const leaveServerMutation = useLeaveServer();

  const currentMember = members?.find((member) => member.user.id === currentUserId);
  const memberDisplayName = currentMember?.displayName ?? currentMember?.user.displayName ?? '';
  const serverDisplayName = displayNameDraft?.serverId === serverId ? displayNameDraft.value : memberDisplayName;

  function handleDisplayNameSave() {
    const value = serverDisplayName.trim();
    updateMemberMutation.mutate({ displayName: value || null });
  }

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
      <div className="w-[38rem] space-y-4">
        <h2 className="text-heading font-semibold text-ink">{server?.name ?? 'Server'} settings</h2>

        <div className="flex gap-4 border-b border-border">
          {(['overview', canManageRoles ? 'roles' : null, 'members'] as const)
            .filter((value): value is Tab => value != null)
            .map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-1 pb-2 text-body font-medium ${
                  tab === value ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {TAB_LABELS[value]}
              </button>
            ))}
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {tab === 'overview' && (
            <>
              {canManageInvites && (
                <section className="space-y-2">
                  <h3 className="text-body font-medium text-muted">Invite code</h3>
                  <ErrorBanner
                    message={inviteQuery.error instanceof ApiError ? inviteQuery.error.message : null}
                  />
                  {inviteQuery.data && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-sidebar px-2 py-1 text-body text-ink">
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
                <h3 className="text-body font-medium text-muted">Your display name in this server</h3>
                <div className="flex gap-2">
                  <input
                    value={serverDisplayName}
                    maxLength={50}
                    onChange={(event) => setDisplayNameDraft({ serverId, value: event.target.value })}
                    className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-body text-ink"
                    aria-label="Your display name in this server"
                  />
                  <Button type="button" variant="secondary" onClick={handleDisplayNameSave} disabled={updateMemberMutation.isPending}>
                    Save
                  </Button>
                </div>
                <span className="text-caption text-muted">Leave it empty to use your global display name.</span>
              </section>

              <section className="space-y-2 border-t pt-4">
                {isOwner ? (
                  <>
                    <p className="text-caption text-muted">
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
                      className="w-full border border-danger/40 text-danger hover:bg-danger/10"
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
            </>
          )}

          {tab === 'roles' && canManageRoles && (
            <RolesTab
              serverId={serverId}
              currentUserId={currentUserId}
              isOwner={isOwner}
              currentUserPermissions={server?.permissions ?? []}
            />
          )}

          {tab === 'members' && (
            <ul className="space-y-1">
              {(members ?? []).map((member) => (
                <li key={member.user.id} className="space-y-1 text-body text-ink">
                  <div className="flex items-center justify-between gap-2">
                    <UserProfileCard
                      user={{
                        id: member.user.id,
                        displayName: member.displayName ?? member.user.displayName,
                        avatarUrl: member.user.avatarUrl,
                      }}
                    >
                      <button type="button" className="flex items-center gap-2 text-left">
                        <span aria-hidden="true">
                          <Avatar
                            displayName={member.displayName ?? member.user.displayName}
                            avatarUrl={member.user.avatarUrl}
                            className="h-6 w-6"
                          />
                        </span>
                        {member.displayName ?? member.user.displayName}
                        {server?.ownerId === member.user.id && (
                          <span className="text-caption uppercase text-muted">Owner</span>
                        )}
                      </button>
                    </UserProfileCard>
                    <span className="flex items-center gap-3">
                      {isOwner && member.user.id !== currentUserId && (
                        <button
                          type="button"
                          className="text-caption text-brand hover:underline"
                          onClick={() => handleTransfer(member.user.id, member.displayName ?? member.user.displayName)}
                        >
                          Make owner
                        </button>
                      )}
                    </span>
                  </div>
                  {canManageRoles && server?.ownerId !== member.user.id && member.user.id !== currentUserId && (
                    <MemberRoleEditor serverId={serverId} userId={member.user.id} roles={roles ?? []} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

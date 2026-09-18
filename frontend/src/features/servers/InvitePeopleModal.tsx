import { useState } from 'react';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../services/apiClient';
import { useInvite, useRegenerateInvite } from './hooks';

interface InvitePeopleModalProps {
  serverId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Focused "share a link" dialog, opened from ChannelSidebar's header — separate from the
 * broader ServerSettingsPanel so inviting people is a one-click, prominent action (matching
 * the ticket's "Convidar pessoas" flow) rather than buried in settings.
 */
export function InvitePeopleModal({ serverId, open, onClose }: InvitePeopleModalProps) {
  const inviteQuery = useInvite(open ? serverId : undefined);
  const regenerateInviteMutation = useRegenerateInvite(serverId);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const inviteUrl = inviteQuery.data ? `${window.location.origin}/invite/${inviteQuery.data.code}` : null;

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // Clipboard API unavailable/denied — the link is still shown on screen to copy by hand.
    }
  }

  function handleRegenerate() {
    if (window.confirm('Regenerate the invite link? The current link will stop working immediately.')) {
      regenerateInviteMutation.mutate();
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-80 space-y-4">
        <h2 className="text-heading font-semibold text-ink">Invite people</h2>

        <ErrorBanner message={inviteQuery.error instanceof ApiError ? inviteQuery.error.message : null} />

        {inviteUrl && (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate rounded bg-sidebar px-2 py-1 text-body text-ink">{inviteUrl}</span>
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copyState === 'copied' ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          onClick={handleRegenerate}
          disabled={regenerateInviteMutation.isPending}
        >
          Regenerate link
        </Button>
      </div>
    </Modal>
  );
}

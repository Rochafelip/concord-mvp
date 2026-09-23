import { Video } from 'lucide-react';
import { voiceClient } from '../../../services/voiceClient';
import { CallControlBar } from '../CallControlBar';
import { ParticipantList } from '../ParticipantList';
import { useDmCallStore } from './dmCallStore';

/**
 * Rendered by DmConversationView in place of the message list while a 1:1 call is connected.
 * Reuses the same call UI as a server voice channel (ParticipantList already degrades gracefully
 * without a serverId — no per-server presence/moderation applies to a 1:1 call) — see
 * docs/superpowers/specs/2026-09-23-dm-call-design.md. `canUseVideo` is always true: there are no
 * roles in a 1:1 call, both sides get full rights once accepted.
 */
export function DmCallView() {
  const peer = useDmCallStore((state) => state.peer);

  function handleLeave() {
    voiceClient.disconnect();
    useDmCallStore.getState().reset();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 flex-shrink-0 items-center gap-1.5 border-b bg-surface px-4">
        <Video size={16} className="text-muted" aria-hidden="true" />
        <span className="text-heading font-semibold text-ink">Chamada com {peer?.displayName ?? '…'}</span>
      </div>
      <div className="group/call-area relative flex flex-1 flex-col overflow-hidden bg-gray-950">
        <ParticipantList />
        <CallControlBar onLeave={handleLeave} canUseVideo />
      </div>
    </div>
  );
}

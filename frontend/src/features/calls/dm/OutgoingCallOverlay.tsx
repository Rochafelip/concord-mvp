import { PhoneOff } from 'lucide-react';
import { useEffect } from 'react';
import { Avatar } from '../../../components/Avatar';
import * as api from './api';
import { useDmCallStore } from './dmCallStore';

const RING_TIMEOUT_MS = 30_000;

/**
 * Fullscreen "calling…" overlay for the caller, mounted once in AppShell alongside
 * IncomingCallModal. Auto-cancels after 30s of no answer — backend has no distinct TIMEOUT wire
 * value, an unanswered call ending is just the caller giving up on it, so this calls the same
 * cancel() the Cancelar button does.
 */
export function OutgoingCallOverlay() {
  const status = useDmCallStore((state) => state.status);
  const callId = useDmCallStore((state) => state.callId);
  const peer = useDmCallStore((state) => state.peer);

  useEffect(() => {
    if (status !== 'ringing-out' || !callId) return;
    const timeout = window.setTimeout(() => {
      void api.cancelCall(callId).catch(() => {});
      useDmCallStore.getState().reset();
    }, RING_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [status, callId]);

  if (status !== 'ringing-out' || !peer) return null;

  function handleCancel() {
    if (callId) void api.cancelCall(callId).catch(() => {});
    useDmCallStore.getState().reset();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chamando ${peer.displayName}`}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-black/90 text-white"
    >
      <Avatar displayName={peer.displayName} avatarUrl={peer.avatarUrl} size="lg" />
      <p className="text-heading font-semibold">Chamando {peer.displayName}…</p>
      <button
        type="button"
        aria-label="Cancelar"
        onClick={handleCancel}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/90"
      >
        <PhoneOff size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

import { Phone, PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/Avatar';
import { voiceClient } from '../../../services/voiceClient';
import * as api from './api';
import { useDmCallStore } from './dmCallStore';
import { playRingtone, stopRingtone } from './ringtone';

const RING_TIMEOUT_MS = 30_000;

/**
 * Fullscreen incoming-call takeover, mounted once in AppShell (like VoiceConnectionBar) so a
 * call rings no matter what screen the recipient is on. Self-dismisses after 30s if ignored —
 * the caller's own OutgoingCallOverlay independently cancels around the same time, but this
 * timer doesn't depend on that broadcast actually arriving.
 */
export function IncomingCallModal() {
  const status = useDmCallStore((state) => state.status);
  const callId = useDmCallStore((state) => state.callId);
  const peer = useDmCallStore((state) => state.peer);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (status !== 'ringing-in') return;
    playRingtone();
    const timeout = window.setTimeout(() => useDmCallStore.getState().reset(), RING_TIMEOUT_MS);
    return () => {
      stopRingtone();
      window.clearTimeout(timeout);
    };
  }, [status]);

  if (status !== 'ringing-in' || !callId || !peer) return null;

  async function handleAccept() {
    setAccepting(true);
    try {
      const { token, url } = await api.acceptCall(callId!);
      useDmCallStore.getState().setConnected();
      await voiceClient.connect(null, token, url);
    } catch {
      useDmCallStore.getState().reset();
    } finally {
      setAccepting(false);
    }
  }

  function handleDecline() {
    void api.declineCall(callId!).catch(() => {});
    useDmCallStore.getState().reset();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chamada de ${peer.displayName}`}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-black/90 text-white"
    >
      <Avatar displayName={peer.displayName} avatarUrl={peer.avatarUrl} size="lg" />
      <div className="text-center">
        <p className="text-heading font-semibold">{peer.displayName}</p>
        <p className="text-body text-white/70">Chamada recebida…</p>
      </div>
      <div className="flex gap-6">
        <button
          type="button"
          aria-label="Recusar"
          onClick={handleDecline}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/90"
        >
          <PhoneOff size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Aceitar"
          disabled={accepting}
          onClick={() => void handleAccept()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white hover:bg-success/90 disabled:opacity-60"
        >
          <Phone size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

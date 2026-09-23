import * as dmCallApi from './api';
import { useDmCallStore, type DmCallPeer } from './dmCallStore';

/**
 * Invites `peer` to a 1:1 call and moves the store into "ringing-out" — shared by
 * DmConversationView's call button and UserProfileCard's "Iniciar chamada" context-menu item,
 * which both need the exact same invite → startOutgoing sequence. Silently drops a failed
 * invite (e.g. the peer went offline mid-click) rather than surfacing an error, matching the
 * call button's existing behavior.
 */
export function startDmCall(peer: DmCallPeer): void {
  dmCallApi
    .inviteCall(peer.id)
    .then(({ callId }) => {
      useDmCallStore.getState().startOutgoing(callId, peer);
    })
    .catch(() => {});
}

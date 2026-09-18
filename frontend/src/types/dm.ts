import type { FriendUser } from './friend';

/**
 * A direct message. There is no "conversation" id — a DM thread is identified by the other
 * participant's user id (see backend com.concordmvp.dm.DmMessage's javadoc for why).
 */
export interface DmMessage {
  id: string;
  author: FriendUser;
  /** The other participant relative to `author` — see backend DmMessageResponse. */
  recipientId: string;
  content: string;
  createdAt: string;
}

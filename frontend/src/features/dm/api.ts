import { apiClient } from '../../services/apiClient';
import type { DmMessage } from '../../types/dm';

/** Same compound cursor shape as features/chat/api.ts's MessageCursor — see its comment. */
export interface DmMessageCursor {
  before: string;
  beforeId: string;
}

export function getHistory(
  otherUserId: string,
  cursor: DmMessageCursor | undefined,
  limit: number,
): Promise<DmMessage[]> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('before', cursor.before);
    params.set('beforeId', cursor.beforeId);
  }
  params.set('limit', String(limit));

  return apiClient.get<DmMessage[]>(`dm/${otherUserId}/messages?${params.toString()}`);
}

export function openConversation(otherUserId: string): Promise<void> {
  return apiClient.post<void>(`dm/${otherUserId}/open`);
}

export function listConversations(): Promise<string[]> {
  return apiClient.get<string[]>('dm/conversations');
}

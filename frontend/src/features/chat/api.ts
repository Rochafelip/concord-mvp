import { apiClient } from '../../services/apiClient';
import type { Message } from '../../types/message';

/**
 * Compound pagination cursor (backend/src/main/java/com/concordmvp/messages/MessageController.java):
 * a bare timestamp can't disambiguate messages sharing the same `createdAt`, so an older page is
 * always requested with BOTH the oldest-loaded message's `createdAt` and `id` together. Omitting
 * `beforeId` while passing `before` is a 400 on the backend.
 */
export interface MessageCursor {
  before: string;
  beforeId: string;
}

export function getHistory(
  channelId: string,
  cursor: MessageCursor | undefined,
  limit: number,
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('before', cursor.before);
    params.set('beforeId', cursor.beforeId);
  }
  params.set('limit', String(limit));

  return apiClient.get<Message[]>(`channels/${channelId}/messages?${params.toString()}`);
}

import { apiClient, ApiError } from '../../services/apiClient';
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

export interface UploadedAttachment {
  url: string;
  fileName: string;
  fileSize: number;
}

/**
 * Uploads a file (image or otherwise) for a chat message. Bypasses `apiClient` (which always
 * JSON-encodes its body — see services/apiClient.ts) since a multipart upload needs a `FormData`
 * body and a browser-generated `Content-Type` boundary that must NOT be set manually.
 */
export async function uploadAttachment(channelId: string, file: File): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/v1/channels/${channelId}/attachments`, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? response.statusText, response.status);
  }

  return response.json();
}

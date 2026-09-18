import { apiClient } from '../../services/apiClient';
import type { Friend, PendingFriendRequests } from '../../types/friend';

export function listFriends(): Promise<Friend[]> {
  return apiClient.get<Friend[]>('friends');
}

export function listPendingRequests(): Promise<PendingFriendRequests> {
  return apiClient.get<PendingFriendRequests>('friends/requests');
}

export function sendFriendRequest(addresseeId: string): Promise<void> {
  return apiClient.post<void>('friends/requests', { addresseeId });
}

export function acceptFriendRequest(friendshipId: string): Promise<void> {
  return apiClient.post<void>(`friends/requests/${friendshipId}/accept`);
}

/** Cancels (if you sent it) or declines (if you received it) a still-pending request. */
export function cancelOrDeclineFriendRequest(friendshipId: string): Promise<void> {
  return apiClient.delete<void>(`friends/requests/${friendshipId}`);
}

export function removeFriend(friendshipId: string): Promise<void> {
  return apiClient.delete<void>(`friends/${friendshipId}`);
}

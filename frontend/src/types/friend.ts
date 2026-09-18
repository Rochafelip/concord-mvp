export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Friend {
  friendshipId: string;
  user: FriendUser;
  online: boolean;
  since: string;
}

export interface FriendRequest {
  friendshipId: string;
  user: FriendUser;
  createdAt: string;
}

export interface PendingFriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

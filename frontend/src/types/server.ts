export interface Server {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMember {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  joinedAt: string;
}

export interface InviteCode {
  code: string;
}

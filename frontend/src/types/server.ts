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
  /** Effective name in this server; older cached responses may omit it. */
  displayName?: string;
  joinedAt: string;
}

export interface InviteCode {
  code: string;
}

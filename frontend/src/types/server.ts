import type { Permission } from './permission';

export interface Server {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  /** The current user's effective permissions on this server. Absent on pre-roles cached responses. */
  permissions?: Permission[];
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

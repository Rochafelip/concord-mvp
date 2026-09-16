/**
 * Mirror of the backend's `com.concordmvp.permissions.Permission`. The backend owns the bit
 * indexes; the API only ever sends and accepts these names (docs/DECISIONS.md D20), so this file
 * never needs to know about the bitmask.
 *
 * `permission.test.ts` parses the Java enum and fails if the two lists diverge — keep them in sync
 * by adding to both, or that test will tell you.
 */
export const ALL_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_SERVER',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'MANAGE_INVITES',
  'VIEW_AUDIT_LOG',
  'VIEW_MEMBER_LIST',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'TIMEOUT_MEMBERS',
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'READ_MESSAGE_HISTORY',
  'ATTACH_FILES',
  'MANAGE_MESSAGES',
  'CONNECT',
  'SPEAK',
  'USE_VIDEO',
  'SHARE_SCREEN',
  'MUTE_MEMBERS',
  'DEAFEN_MEMBERS',
  'MOVE_MEMBERS',
  'DISCONNECT_MEMBERS',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/**
 * Hiding a control is a convenience so nobody has to walk into a 403 — it is never the
 * enforcement. The backend re-checks every one of these on the way in.
 *
 * Undefined means "the response predates this field", and is treated as no permission rather than
 * as full access: a stale cache must not unlock anything.
 */
export function hasPermission(
  permissions: readonly Permission[] | readonly string[] | undefined,
  permission: Permission,
): boolean {
  if (permissions == null) return false;
  return permissions.includes('ADMINISTRATOR') || permissions.includes(permission);
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  isEveryone: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelPermissionOverride {
  id: string;
  channelId: string;
  roleId: string | null;
  userId: string | null;
  allow: Permission[];
  deny: Permission[];
}

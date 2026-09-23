import type { Permission } from '../../types/permission';

/** Same grouping and order as the comments in the backend's `Permission` enum. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Server management',
    permissions: ['ADMINISTRATOR', 'MANAGE_SERVER', 'MANAGE_ROLES', 'MANAGE_CHANNELS', 'MANAGE_INVITES', 'VIEW_AUDIT_LOG'],
  },
  {
    label: 'Members',
    permissions: ['VIEW_MEMBER_LIST', 'KICK_MEMBERS', 'BAN_MEMBERS', 'TIMEOUT_MEMBERS'],
  },
  {
    label: 'Text channels',
    permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES', 'MANAGE_MESSAGES'],
  },
  {
    label: 'Voice channels',
    permissions: [
      'CONNECT',
      'SPEAK',
      'USE_VIDEO',
      'SHARE_SCREEN',
      'MUTE_MEMBERS',
      'DEAFEN_MEMBERS',
      'MOVE_MEMBERS',
      'DISCONNECT_MEMBERS',
    ],
  },
];

/**
 * Bits allocated for moderation and the audit log (Spec B), which nothing enforces yet — see
 * AGENTS.md's "Roles and permissions" section. Flagged so granting one doesn't imply a feature
 * that doesn't exist.
 */
export const NOT_ENFORCED_YET = new Set<Permission>([
  'VIEW_AUDIT_LOG',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'TIMEOUT_MEMBERS',
  'MUTE_MEMBERS',
  'DEAFEN_MEMBERS',
  'MOVE_MEMBERS',
]);

export function permissionLabel(permission: Permission): string {
  return permission
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

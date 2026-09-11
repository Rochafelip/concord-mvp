export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  /** Profiles cached before email verification shipped do not have this field. */
  emailVerified?: boolean;
}

export interface AuthResult {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified?: boolean;
}

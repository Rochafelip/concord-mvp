export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface AuthResult {
  userId: string;
  username: string;
  displayName: string;
  email: string;
}

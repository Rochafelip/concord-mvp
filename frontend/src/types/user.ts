export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface AuthResult {
  token: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
}

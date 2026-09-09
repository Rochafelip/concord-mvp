export interface Message {
  id: string;
  channelId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  content: string;
  imageUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
}

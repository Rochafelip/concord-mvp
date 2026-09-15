export interface Attachment {
  url: string;
  fileName: string | null;
  fileSize: number | null;
}

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
  /** Always present, ordered as the sender arranged them; empty for a text-only message. */
  attachments: Attachment[];
  createdAt: string;
}

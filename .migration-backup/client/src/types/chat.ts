// Chat and Message types for the messaging system

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface Message {
  id: number;
  subject: string;
  content: string;
  preview: string;
  senderName: string;
  senderId: number;
  messageType: 'user' | 'admin' | 'all' | 'registered' | 'badge_holders';
  createdAt: string | Date;
  updatedAt: string | Date;
  timestamp?: string | Date; // Some components use timestamp - will be mapped from createdAt
  attachments: Attachment[];
  replies?: Message[];
  conversationCount?: number;
  recipientName?: string | null; // Keep for UI compatibility
  read?: boolean; // Optional as not in DB schema
  inReplyTo?: number; // For tracking message threading
}

export interface ChatState {
  messages: Message[];
  selectedMessage: Message | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export type ChatActionType = 
  | { type: 'FETCH_MESSAGES_REQUEST' }
  | { type: 'FETCH_MESSAGES_SUCCESS'; payload: Message[] }
  | { type: 'FETCH_MESSAGES_FAILURE'; payload: string }
  | { type: 'SELECT_MESSAGE'; payload: Message | null }
  | { type: 'MARK_AS_READ'; payload: number }
  | { type: 'DELETE_MESSAGE'; payload: number }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'ADD_REPLY'; payload: { messageId: number; reply: Message } }
  | { type: 'UPDATE_UNREAD_COUNT'; payload: number };

export interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatActionType>;
  sendMessage: (message: {
    recipient: string;
    subject: string;
    content: string;
    attachments: File[];
  }) => Promise<void>;
  replyToMessage: (messageId: number, content: string, attachments: File[]) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  markAsRead: (messageId: number) => Promise<void>;
  fetchMessages: () => Promise<void>;
}

export interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
}
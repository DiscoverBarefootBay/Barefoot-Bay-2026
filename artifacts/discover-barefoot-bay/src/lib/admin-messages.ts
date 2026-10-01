export interface MessageSender {
  id: number;
  username: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
}

export interface MessageRecipient {
  id: number | null;
  username: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
  readAt: string | null;
  status: string | null;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  url: string;
  size: string | null;
  contentType: string | null;
}

export interface AdminMessage {
  id: number;
  subject: string;
  content: string;
  senderId: number;
  messageType: string;
  inReplyTo: number | null;
  deletedAt: string | null;
  deletedBySender: boolean | null;
  createdAt: string;
  updatedAt: string;
  sender: MessageSender | null;
  recipients: MessageRecipient[];
  attachments: MessageAttachment[];
  hasInferredRecipients?: boolean;
}

export interface AdminMessagesResult {
  messages: AdminMessage[];
  total: number;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchAdminMessages(fetcher: Fetcher = fetch): Promise<AdminMessagesResult> {
  const response = await fetcher("/api/admin/messages", { credentials: "include" });
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid messages response.");
  }

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Failed to fetch messages.");
  }
  if (!Array.isArray(result.data)) {
    throw new Error("The server returned an invalid messages list.");
  }

  const total = Number(result.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("The server returned an invalid total message count.");
  }

  return { messages: result.data as AdminMessage[], total };
}

export function filterAdminMessages(messages: AdminMessage[], searchTerm: string): AdminMessage[] {
  const search = searchTerm.trim().toLocaleLowerCase();
  if (!search) return messages;

  return messages.filter((message) => {
    const sender = message.sender;
    return [
      message.subject,
      message.content,
      sender?.username,
      sender?.fullName,
      sender?.email,
    ].some((value) => (value ?? "").toLocaleLowerCase().includes(search));
  });
}
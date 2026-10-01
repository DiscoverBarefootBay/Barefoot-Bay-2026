/** Works with both current and legacy message timestamps, without changing them. */
type ThreadRow = {
  id: number;
  timestamp?: string | Date;
  createdAt?: string | Date;
  lastActivityAt?: string | Date;
  replies?: ThreadRow[];
};

function sentTime(row: ThreadRow): number {
  const value = new Date(row.timestamp || row.createdAt || "").getTime();
  return Number.isFinite(value) ? value : 0;
}

export function threadActivityTime(row: ThreadRow): number {
  const storedActivity = new Date(row.lastActivityAt || "").getTime();
  return Math.max(sentTime(row), Number.isFinite(storedActivity) ? storedActivity : 0,
    ...(row.replies || []).map(threadActivityTime));
}

export function threadActivityDate(row: ThreadRow): Date | undefined {
  const time = threadActivityTime(row);
  return time ? new Date(time) : undefined;
}

export function sortConversations<T extends ThreadRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => threadActivityTime(b) - threadActivityTime(a) || b.id - a.id);
}

export function appendThreadReply<T extends ThreadRow>(thread: T, reply: T): T {
  const replies = new Map((thread.replies || []).map(row => [row.id, row]));
  replies.set(reply.id, reply);
  return {
    ...thread,
    replies: [...replies.values()].sort((a, b) => sentTime(a) - sentTime(b) || a.id - b.id),
  };
}

/** Reconcile by ID, never keep a stale object after an authoritative refresh. */
export function refreshedSelection<T extends ThreadRow>(rows: T[], selected: T | null): T | null {
  if (!selected) return null;
  return rows.find(row => row.id === selected.id ||
    row.replies?.some(reply => reply.id === selected.id)) || null;
}

export function normalizeConversationResponse<T extends ThreadRow>(data: unknown): T[] {
  const rows = Array.isArray(data) ? data : (data as { messages?: unknown })?.messages;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== "number" ||
    (row.replies !== undefined && !Array.isArray(row.replies)))) {
    throw new Error("Invalid messages response. Please try refreshing.");
  }
  return sortConversations(rows.map(row => ({ ...row, replies: row.replies || [] })));
}
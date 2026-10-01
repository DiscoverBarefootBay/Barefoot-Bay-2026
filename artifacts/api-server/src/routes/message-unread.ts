import { assembleMessageHistory } from './message-history';

type UnreadMessage = {
  id: number;
  inReplyTo: number | null;
  senderId: number;
  [key: string]: unknown;
};

/** Match the mailbox's thread badge and mobile individual-message badge. */
export function countVisibleUnreadHistory(
  visibleMessages: UnreadMessage[],
  recipientRows: Array<{ messageId: number; readAt: Date | null }>,
  currentUserId: number,
) {
  // The mailbox uses readAt, not the legacy status string. Sent messages are
  // always read, even when the sender is also listed as a recipient.
  const readStatus = new Map(recipientRows.map(row => [row.messageId, row.readAt !== null]));
  const threads = assembleMessageHistory(visibleMessages.map(message => ({
    ...message,
    read: message.senderId === currentUserId || readStatus.get(message.id) === true,
  })));
  let count = 0;
  let messageCount = 0;
  for (const thread of threads) {
    const unread = [thread, ...thread.replies].filter(message => !message.read).length;
    if (unread > 0) count++;
    messageCount += unread;
  }
  return { count, messageCount };
}
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countVisibleUnreadHistory } from '../routes/message-unread';

const message = (id: number, parent: number | null, senderId = 20) => ({ id, inReplyTo: parent, senderId });
const recipient = (messageId: number, readAt: Date | null = null) => ({ messageId, readAt });

test('unread counts distinguish threads and messages, including nested and orphan replies', () => {
  const visible = [
    message(1, null, 10), message(2, 1), message(3, 2),
    message(4, 999), message(5, null, 10), message(6, null),
  ];
  assert.deepEqual(countVisibleUnreadHistory(visible, [recipient(2), recipient(3), recipient(4), recipient(6, new Date())], 10),
    { count: 2, messageCount: 3 });
});

test('cycles are counted once; own messages and duplicate recipient records never inflate totals', () => {
  assert.deepEqual(countVisibleUnreadHistory(
    [message(1, 2), message(2, 1), message(3, null, 10)],
    [recipient(1), recipient(1), recipient(2), recipient(3)], 10,
  ), { count: 1, messageCount: 2 });
});

test('empty history ignores orphan recipient records and legacy status strings do not override readAt', () => {
  assert.deepEqual(countVisibleUnreadHistory([], [recipient(99)], 10), { count: 0, messageCount: 0 });
  const rows = [{ ...recipient(1), status: 'archived' }, { ...recipient(2, new Date()), status: 'unread' }];
  assert.deepEqual(countVisibleUnreadHistory([message(1, null), message(2, null)], rows, 10),
    { count: 1, messageCount: 1 });
});
import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import * as schema from '../../../../lib/db/src/schema/index';

const adminId = 10;
const residentId = 20;
const otherResidentId = 30;
const unrelatedId = 40;
let activeUserId = residentId;
let activeRole = 'registered';
let requestMessageId: number | undefined;
let userLimitCalls = 0;
let updates: Array<{ values: unknown; condition: unknown }> = [];

const stamp = (day: number) => new Date(`2025-01-${String(day).padStart(2, '0')}T12:00:00.000Z`);
const fixtureMessages = [
  { id: 1, senderId: adminId, subject: 'Community update', content: 'Visible broadcast root', messageType: 'all', inReplyTo: null, deletedBySender: false, createdAt: stamp(1), updatedAt: stamp(1) },
  { id: 2, senderId: residentId, subject: 'Re: Community update', content: 'Resident response', messageType: 'user', inReplyTo: 1, deletedBySender: false, createdAt: stamp(2), updatedAt: stamp(2) },
  { id: 3, senderId: adminId, subject: 'Re: Community update', content: 'Admin reply', messageType: 'user', inReplyTo: 1, deletedBySender: false, createdAt: stamp(3), updatedAt: stamp(3) },
  { id: 4, senderId: residentId, subject: 'Re: Admin reply', content: 'Nested resident reply', messageType: 'user', inReplyTo: 3, deletedBySender: false, createdAt: stamp(4), updatedAt: stamp(4) },
  { id: 5, senderId: otherResidentId, subject: 'Private reply', content: 'PRIVATE SIBLING REPLY', messageType: 'user', inReplyTo: 1, deletedBySender: false, createdAt: stamp(2), updatedAt: stamp(2) },
  { id: 6, senderId: residentId, subject: 'Legacy reply', content: 'Visible orphan reply', messageType: 'user', inReplyTo: 999, deletedBySender: false, createdAt: stamp(5), updatedAt: stamp(5) },
  { id: 7, senderId: adminId, subject: 'Another message', content: 'Other visible root', messageType: 'user', inReplyTo: null, deletedBySender: false, createdAt: stamp(2), updatedAt: stamp(2) },
  { id: 8, senderId: unrelatedId, subject: 'Private follow-up', content: 'PRIVATE NESTED REPLY', messageType: 'user', inReplyTo: 3, deletedBySender: false, createdAt: stamp(4), updatedAt: stamp(4) },
  { id: 10, senderId: adminId, subject: 'Re: Admin reply', content: 'Nested admin follow-up', messageType: 'user', inReplyTo: 3, deletedBySender: false, createdAt: stamp(5), updatedAt: stamp(5) },
  { id: 999, senderId: otherResidentId, subject: 'Private ancestor', content: 'INVISIBLE ANCESTOR CONTENT', messageType: 'user', inReplyTo: null, deletedBySender: false, createdAt: stamp(1), updatedAt: stamp(1) },
  { id: 11, senderId: otherResidentId, subject: 'Hidden reply', content: 'RECIPIENT-HIDDEN MESSAGE', messageType: 'user', inReplyTo: 1, deletedBySender: false, createdAt: stamp(4), updatedAt: stamp(4) },
  { id: 12, senderId: otherResidentId, subject: 'Soft-deleted reply', content: 'SOFT-DELETED RECIPIENT MESSAGE', messageType: 'user', inReplyTo: 1, deletedBySender: false, createdAt: stamp(4), updatedAt: stamp(4) },
];

const fixtureRecipients: Array<{
  id: number;
  messageId: number;
  recipientId: number;
  readAt: Date | null;
  status: string;
  deletedByRecipient?: boolean | null;
  deletedAt?: Date | null;
}> = [
  { id: 1, messageId: 1, recipientId: residentId, readAt: null, status: 'unread', deletedByRecipient: false, deletedAt: null },
  { id: 2, messageId: 1, recipientId: otherResidentId, readAt: null, status: 'unread' },
  { id: 3, messageId: 1, recipientId: unrelatedId, readAt: null, status: 'unread' },
  { id: 4, messageId: 2, recipientId: adminId, readAt: null, status: 'unread' },
  { id: 5, messageId: 3, recipientId: residentId, readAt: null, status: 'unread', deletedByRecipient: false, deletedAt: null },
  { id: 6, messageId: 4, recipientId: adminId, readAt: null, status: 'unread' },
  { id: 7, messageId: 5, recipientId: unrelatedId, readAt: null, status: 'unread' },
  { id: 8, messageId: 7, recipientId: residentId, readAt: stamp(3), status: 'read' },
  { id: 9, messageId: 8, recipientId: otherResidentId, readAt: null, status: 'unread' },
  { id: 10, messageId: 10, recipientId: residentId, readAt: null, status: 'unread', deletedByRecipient: false, deletedAt: null },
  { id: 11, messageId: 11, recipientId: residentId, readAt: null, status: 'unread', deletedByRecipient: true, deletedAt: null },
  { id: 12, messageId: 12, recipientId: residentId, readAt: null, status: 'unread', deletedByRecipient: false, deletedAt: stamp(4) },
];

function rowsFor(table: unknown, mode: 'await' | 'order' | 'limit', limit?: number) {
  if (table === schema.messageRecipients) {
    if (mode === 'limit') {
      const recipientRows = fixtureRecipients.filter(row => row.messageId === requestMessageId);
      return recipientRows.slice(0, limit);
    }
    return fixtureRecipients.filter(row => row.recipientId === activeUserId &&
      row.deletedByRecipient !== true && row.deletedAt == null);
  }
  if (table === schema.messages) {
    if (mode === 'order') {
      const receivedIds = new Set(fixtureRecipients
        .filter(row => row.recipientId === activeUserId &&
          row.deletedByRecipient !== true && row.deletedAt == null)
        .map(row => row.messageId));
      return fixtureMessages
        .filter(message => message.senderId === activeUserId ||
          (receivedIds.has(message.id) && message.deletedBySender !== true))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (mode === 'limit') {
      return fixtureMessages.filter(message => message.id === requestMessageId).slice(0, limit);
    }
    return [];
  }
  if (table === schema.messageAttachments) return [];
  if (table === schema.users) {
    const people = [
      { id: adminId, role: 'admin', fullName: 'Admin Person', username: 'admin' },
      { id: residentId, role: 'registered', fullName: 'Resident Person', username: 'resident' },
      { id: otherResidentId, role: 'registered', fullName: 'Other Resident', username: 'other' },
      { id: unrelatedId, role: 'registered', fullName: 'Unrelated User', username: 'unrelated' },
    ];
    if (mode === 'limit') {
      const requested = fixtureMessages.find(message => message.id === requestMessageId);
      const recipient = fixtureRecipients.find(row => row.messageId === requestMessageId)?.recipientId;
      const selectedUserId = userLimitCalls++ === 0 ? requested?.senderId : recipient;
      return people.filter(person => person.id === selectedUserId).slice(0, limit);
    }
    return people;
  }
  return [];
}

const mockedDb = {
  select: () => ({
    from: (table: unknown) => {
      const query: any = {
        where() { return query; },
        orderBy() { return Promise.resolve(rowsFor(table, 'order')); },
        limit(limit: number) { return Promise.resolve(rowsFor(table, 'limit', limit)); },
        then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          return Promise.resolve(rowsFor(table, 'await')).then(resolve, reject);
        },
      };
      return query;
    },
  }),
  update: () => ({
    set: (values: unknown) => {
      let condition: unknown;
      const builder: any = {
        where(value: unknown) {
          condition = value;
          return builder;
        },
        async returning() {
          updates.push({ values, condition });
          return fixtureRecipients
            .filter(row => row.recipientId === activeUserId && row.readAt === null &&
              row.deletedByRecipient !== true && row.deletedAt == null)
            .map(row => ({ messageId: row.messageId }));
        },
      };
      return builder;
    },
  }),
};

mock.module('@workspace/db', { namedExports: { ...schema } });
mock.module('../db.ts', { namedExports: { db: mockedDb } });
mock.module('../dmca/legal-hold.ts', { namedExports: { assertMessageDeletable: async () => undefined } });
mock.module('../attachment-storage-proxy.ts', { namedExports: {
  uploadAttachmentToObjectStorage: async () => null,
  getAttachmentUrl: () => '',
} });
mock.module('../message-email-progress.ts', { namedExports: {
  reserveMessageSend: (_req: unknown, _res: unknown, next: () => void) => next(),
  recordCreatedMessage: async () => undefined,
  enqueueMessageEmail: async () => undefined,
  listSendProgress: async () => [],
  dismissSendProgress: async () => false,
} });

const { default: chatRouter } = await import('../routes/chat');
let server: Server;
let origin: string;

before(async () => {
  const app = express();
  app.use((req: any, _res, next) => {
    const identity = req.header('x-test-user') || 'resident';
    activeRole = identity === 'admin' ? 'admin' : 'registered';
    activeUserId = identity === 'admin' ? adminId : residentId;
    userLimitCalls = 0;
    const idMatch = req.path.match(/(?:^|\/)messages\/(\d+)(?:\/|$)/);
    requestMessageId = idMatch ? Number(idMatch[1]) : undefined;
    req.isAuthenticated = () => identity !== 'anonymous';
    if (req.isAuthenticated()) req.user = { id: activeUserId, role: activeRole };
    next();
  });
  app.use('/api', chatRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
  updates = [];
});

test('mounted message history flattens visible descendants and marks orphan replies as safe thread heads', async () => {
  const response = await fetch(`${origin}/api/messages`, { headers: { 'x-test-user': 'resident' } });
  assert.equal(response.status, 200);
  const history: any[] = await response.json();

  const root = history.find(message => message.id === 1);
  assert.ok(root);
  assert.deepEqual(root.replies.map((reply: any) => reply.id), [2, 3, 4, 10]);
  assert.equal(root.replies.find((reply: any) => reply.id === 4).inReplyTo, 3);
  assert.equal(root.replies.every((reply: any) => reply.displayRootId === 1 && reply.threadRoot === false), true);
  assert.equal(root.lastActivityAt, stamp(5).toISOString());
  assert.equal(history[0].id, 6, 'history heads are ordered by their latest visible activity');

  const orphan = history.find(message => message.id === 6);
  assert.equal(orphan.threadRoot, true);
  assert.equal(orphan.displayRootId, 6);
  assert.equal(orphan.orphanedReply, true);
  assert.equal(orphan.inReplyTo, 999, 'the original parent ID remains intact');
  assert.equal(JSON.stringify(history).includes('PRIVATE SIBLING REPLY'), false);
  assert.equal(JSON.stringify(history).includes('PRIVATE NESTED REPLY'), false);
  assert.equal(JSON.stringify(history).includes('INVISIBLE ANCESTOR CONTENT'), false);
  assert.equal(JSON.stringify(history).includes('RECIPIENT-HIDDEN MESSAGE'), false);
  assert.equal(JSON.stringify(history).includes('SOFT-DELETED RECIPIENT MESSAGE'), false);
});

test('detail and the scoped replies endpoint share caller visibility for nested history', async () => {
  const detailResponse = await fetch(`${origin}/api/messages/1`, { headers: { 'x-test-user': 'resident' } });
  assert.equal(detailResponse.status, 200);
  const detail: any = await detailResponse.json();
  assert.deepEqual(detail.replies.map((reply: any) => reply.id), [2, 3, 4, 10]);
  assert.equal(detail.replies.find((reply: any) => reply.id === 4).inReplyTo, 3);
  assert.equal(detail.replies.every((reply: any) => reply.threadRoot === false && reply.displayRootId === 1), true);
  assert.equal(detail.replies.find((reply: any) => reply.id === 3).read, true);
  assert.equal(detail.replies.find((reply: any) => reply.id === 10).read, true);
  assert.equal(JSON.stringify(detail).includes('PRIVATE SIBLING REPLY'), false);
  assert.equal(JSON.stringify(detail).includes('PRIVATE NESTED REPLY'), false);
  assert.equal(updates.length, 1, 'opening a thread marks its visible unread nested messages read');

  const repliesResponse = await fetch(`${origin}/api/messages/1/replies`, { headers: { 'x-test-user': 'resident' } });
  assert.equal(repliesResponse.status, 200);
  const replies: any[] = await repliesResponse.json();
  assert.deepEqual(replies.map(reply => reply.id), [2, 3, 4, 10]);
  assert.equal(replies.every(reply => reply.threadRoot === false && reply.displayRootId === 1), true);
  assert.equal(JSON.stringify(replies).includes('PRIVATE SIBLING REPLY'), false);
  assert.equal(JSON.stringify(replies).includes('PRIVATE NESTED REPLY'), false);
});

test('normal members cannot use detail or replies routes to read an unrelated private reply', async () => {
  const detailResponse = await fetch(`${origin}/api/messages/5`, { headers: { 'x-test-user': 'resident' } });
  assert.equal(detailResponse.status, 403);
  const repliesResponse = await fetch(`${origin}/api/messages/5/replies`, { headers: { 'x-test-user': 'resident' } });
  assert.equal(repliesResponse.status, 403);
});

test('mounted read-thread marks all and only visible unread nested replies and returns the updated count', async () => {
  const response = await fetch(`${origin}/api/messages/1/read-thread`, {
    method: 'POST',
    headers: { 'x-test-user': 'resident' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    threadId: 1,
    markedCount: 3,
    markedMessageIds: [1, 3, 10],
  });
  assert.equal(updates.length, 1);

  const unrelated = await fetch(`${origin}/api/messages/5/read-thread`, {
    method: 'POST',
    headers: { 'x-test-user': 'resident' },
  });
  assert.equal(unrelated.status, 403);
  assert.equal(updates.length, 1, 'denied requests do not mark any recipients read');
});

test('administrator retains individual message detail access without reading other participants’ private replies', async () => {
  const response = await fetch(`${origin}/api/messages/5`, { headers: { 'x-test-user': 'admin' } });
  assert.equal(response.status, 200);
  const detail: any = await response.json();
  assert.equal(detail.id, 5);
  assert.equal(detail.content, 'PRIVATE SIBLING REPLY');
  assert.equal(JSON.stringify(detail).includes('PRIVATE NESTED REPLY'), false);
});
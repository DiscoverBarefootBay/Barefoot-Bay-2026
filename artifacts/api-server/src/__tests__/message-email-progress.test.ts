import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import express from "express";
import { createServer, type Server } from "node:http";
import * as schema from "../../../../lib/db/src/schema/index";

process.env.NODE_ENV = "test";
let queries: { sql: string; args: any[] }[] = [];
let queryImpl: (sql: string, args: any[]) => any;
let selections: any[][] = [];
let providerImpl: () => Promise<boolean>;
let providerCalls: any[][] = [];
async function query(sql: string, args: any[] = []) {
  queries.push({ sql, args });
  return queryImpl(sql, args);
}
mock.module("@workspace/db", { namedExports: { ...schema } });
mock.module("../db.ts", { namedExports: {
  pool: { query, connect: async () => ({ query, release() {} }) },
  db: { select: () => ({ from: () => ({ where: async () => selections.shift() || [] }) }) },
}});
mock.module("../sendgrid-service.ts", { namedExports: {
  canReceiveNotificationEmail: (p: any) => p.emailNotificationsEnabled !== false,
  sendMessageEmail: async (...args: any[]) => { providerCalls.push(args); return providerImpl(); },
}});
mock.module("../object-storage-service.ts", { namedExports: {
  objectStorageService: { getFile: async () => Buffer.from("attachment stub"), uploadFile: async () => "stored" },
}});
mock.module("../lib/logger.ts", { namedExports: { logger: { warn() {}, error() {} } } });
const { selectMailboxes, reserveMessageSend, processMessageEmailQueue, listSendProgress, dismissSendProgress, enqueueMessageEmail } = await import("../message-email-progress");

beforeEach(() => {
  queries = []; selections = []; providerCalls = [];
  queryImpl = () => ({ rows: [], rowCount: 0 });
  providerImpl = async () => true;
});

test("opt-outs, invalid addresses, case/whitespace dedup, sender copy share one mailbox", () => {
  const result = selectMailboxes([
    { email: " Shared@example.com " }, { email: "shared@EXAMPLE.com" },
    { username: "sender@example.com" }, { email: "optout@example.com", emailNotificationsEnabled: false },
    { email: "bad" },
  ]);
  assert.deepEqual(result, { addresses: ["shared@example.com", "sender@example.com"], skipped: 3 });
  assert.deepEqual(selectMailboxes([{ email: "x@example.com", emailNotificationsEnabled: false }]), { addresses: [], skipped: 1 });
});

function response() {
  const res: any = { statusCode: 200, locals: {}, body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; } };
  return res;
}

test("idempotency rejects missing keys before any write", async () => {
  const res = response();
  await reserveMessageSend({ get: () => undefined } as any, res, () => assert.fail("must not create"));
  assert.equal(res.statusCode, 400);
  assert.equal(queries.length, 0);
});

test("idempotency replays saved response scoped by authenticated sender", async () => {
  const req: any = { get: () => "1234567890123456", path: "/", body: { subject: "test", content: "Test" }, user: { id: 42 } };
  let fingerprint: string;
  queryImpl = (sql, args) => {
    if (sql.startsWith("INSERT")) { fingerprint = args[3]; return { rowCount: 0 }; }
    return { rows: [{ fingerprint, response_code: 201, response: { message: { id: 99 } } }] };
  };
  const res = response();
  await reserveMessageSend(req, res, () => assert.fail("must not create duplicate"));
  assert.equal(res.body.message.id, 99);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(queries[1].args, [42, "1234567890123456"]);
});

test("idempotency refuses changed payload and uncertain unfinished requests", async () => {
  for (const changed of [true, false]) {
    let fingerprint: string;
    queryImpl = (sql, args) => {
      if (sql.startsWith("INSERT")) { fingerprint = args[3]; return { rowCount: 0 }; }
      return { rows: [{ id: "original", fingerprint: changed ? "different" : fingerprint }] };
    };
    const res = response();
    await reserveMessageSend({ get: () => "1234567890123456", path: "/", body: { content: "Test" }, user: { id: 1 } } as any, res, () => assert.fail());
    assert.equal(res.statusCode, 409);
  }
});

function queueAttempt() {
  queryImpl = (sql) => {
    if (sql.includes("RETURNING *")) return { rows: [{ id: "attempt", request_id: "request", address: "test@example.com", recipient_ids: [1] }] };
    if (sql.startsWith("SELECT * FROM message_send")) return { rows: [{ message_id: 3, sender_id: 4 }] };
    if (sql.includes("FROM users WHERE")) return { rows: [{ emailNotificationsEnabled: true }] };
    return { rows: [] };
  };
  selections = [[{ id: 3, subject: "Subject", content: "Body" }],
    [{ id: 4, fullName: "Sender", email: "sender@example.com" }],
    [{ storedFilename: "safe.txt", filename: "test.txt", contentType: "text/plain" }]];
}

test("worker records actual acceptance and includes attachments without storing bytes in SQL", async () => {
  queueAttempt();
  await processMessageEmailQueue();
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0][9], { throwOnUncertain: true });
  assert.equal(providerCalls[0][5][0].content, Buffer.from("attachment stub").toString("base64"));
  assert.ok(queries.some(q => q.args[1] === "accepted"));
  assert.ok(queries.some(q => q.sql.includes("FOR UPDATE SKIP LOCKED")));
});

test("provider rejection is failed; thrown/uncertain outcome is unknown, never retried", async () => {
  for (const expected of ["failed", "unknown"]) {
    queueAttempt();
    providerImpl = async () => { if (expected === "unknown") throw new Error("timeout"); return false; };
    await processMessageEmailQueue();
    assert.ok(queries.some(q => q.args[1] === expected));
  }
  assert.ok(queries.every(q => !q.sql.includes("SET state='queued'")));
});

test("long-running provider call cannot be claimed twice within this worker", async () => {
  queueAttempt();
  let release!: (result: boolean) => void;
  providerImpl = () => new Promise(resolve => { release = resolve; });
  const first = processMessageEmailQueue();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await processMessageEmailQueue();
  assert.equal(providerCalls.length, 1);
  release(true);
  await first;
});

test("progress query scopes by sender and only projects counts, not addresses", async () => {
  await listSendProgress(88);
  assert.deepEqual(queries[0].args, [88]);
  assert.ok(!queries[0].sql.includes("a.address"));
  assert.ok(queries[0].sql.includes("WHERE r.sender_id=$1"));
  assert.ok(queries[0].sql.includes("r.dismissed_at IS NULL"));
  assert.ok(queries[0].sql.includes("r.created_at > now()-interval '24 hours'"));
  assert.ok(queries[0].sql.includes("GROUP BY r.id"));
});

test("dismissing progress only sets the display timestamp and is sender-scoped and age-limited", async () => {
  queryImpl = () => ({ rows: [], rowCount: 1 });
  assert.equal(await dismissSendProgress(88, "request-id"), true);
  assert.equal(queries[0].sql.startsWith("UPDATE message_send_requests SET dismissed_at="), true);
  assert.match(queries[0].sql, /WHERE id=\$1 AND sender_id=\$2/);
  assert.match(queries[0].sql, /created_at > now\(\)-interval '24 hours'/);
  assert.deepEqual(queries[0].args, ["request-id", 88]);
  assert.doesNotMatch(queries[0].sql, /\bDELETE\b|state\s*=/i);
  queryImpl = () => ({ rows: [], rowCount: 0 });
  assert.equal(await dismissSendProgress(99, "another-sender-request"), false);
});

test("send-progress dismissal route requires authentication and an admin who owns the request", async () => {
  const requestId = "00000000-0000-4000-8000-000000000001";
  const { default: chatRouter } = await import("../routes/chat");
  const app = express();
  app.use((req: any, _res, next) => {
    const identity = req.header("x-test-identity");
    req.isAuthenticated = () => identity !== "anonymous";
    if (identity === "admin-sender") req.user = { id: 42, role: "admin" };
    if (identity === "other-admin") req.user = { id: 43, role: "admin" };
    if (identity === "member") req.user = { id: 44, role: "registered" };
    next();
  });
  app.use("/api", chatRouter);
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    queryImpl = (_sql, args) => ({ rows: [], rowCount: args[1] === 42 ? 1 : 0 });

    const anonymous = await fetch(`${origin}/api/messages/send-progress/${requestId}`, {
      method: "DELETE", headers: { "x-test-identity": "anonymous" },
    });
    assert.equal(anonymous.status, 401);
    assert.equal(queries.length, 0);

    const member = await fetch(`${origin}/api/messages/send-progress/${requestId}`, {
      method: "DELETE", headers: { "x-test-identity": "member" },
    });
    assert.equal(member.status, 403);
    assert.equal(queries.length, 0);

    const otherAdmin = await fetch(`${origin}/api/messages/send-progress/${requestId}`, {
      method: "DELETE", headers: { "x-test-identity": "other-admin" },
    });
    assert.equal(otherAdmin.status, 404);
    assert.deepEqual(queries[0].args, [requestId, 43]);
    assert.match(queries[0].sql, /sender_id=\$2/);

    const ownerAdmin = await fetch(`${origin}/api/messages/send-progress/${requestId}`, {
      method: "DELETE", headers: { "x-test-identity": "admin-sender" },
    });
    assert.equal(ownerAdmin.status, 204);
    assert.deepEqual(queries[1].args, [requestId, 42]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("no eligible recipients persists a terminal zero-send job and no provider calls", async () => {
  selections = [[], [{ recipientId: 1 }], [
    { email: "recipient@example.com", emailNotificationsEnabled: false },
    { email: "sender@example.com", emailNotificationsEnabled: false },
  ]];
  await enqueueMessageEmail("request", 3, 4);
  assert.ok(queries.some(q => q.args[1] === "complete" && q.args[2] === 2));
  assert.ok(queries.some(q => q.sql === "COMMIT"));
  assert.equal(providerCalls.length, 0);
});

test("new opt-out at worker time skips a queued recipient", async () => {
  queueAttempt();
  const previous = queryImpl;
  queryImpl = (sql, args) => sql.includes("FROM users WHERE")
    ? { rows: [{ emailNotificationsEnabled: false }] } : previous(sql, args);
  await processMessageEmailQueue();
  assert.equal(providerCalls.length, 0);
  assert.ok(queries.some(q => q.args[1] === "skipped"));
});

test("an unrelated opted-in account sharing a mailbox cannot override targeted opt-out", async () => {
  queueAttempt();
  const previous = queryImpl;
  queryImpl = (sql, args) => {
    if (!sql.includes("FROM users WHERE")) return previous(sql, args);
    const accounts = [
      { id: 1, emailNotificationsEnabled: false },
      { id: 999, emailNotificationsEnabled: true },
    ];
    assert.match(sql, /id = ANY\(\$2::integer\[\]\)/);
    assert.deepEqual(args[1], [1]);
    return { rows: accounts.filter(account => args[1].includes(account.id)) };
  };
  await processMessageEmailQueue();
  assert.equal(providerCalls.length, 0);
  assert.ok(queries.some(q => q.args[1] === "skipped"));
});

test("enqueue snapshots only intended account IDs for a shared mailbox", async () => {
  selections = [[], [{ recipientId: 1 }], [
    { id: 1, email: "shared@example.com" }, { id: 4, email: "shared@example.com" },
  ]];
  await enqueueMessageEmail("request", 3, 4);
  const inserts = queries.filter(q => q.sql.startsWith("INSERT INTO message_email_attempts"));
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].args[3], [1, 4]);
});

test("missing attachment prevents queue creation rather than silently omitting it", async () => {
  selections = [[]];
  await assert.rejects(enqueueMessageEmail("request", 3, 4, 1), /attachment could not be saved/);
  assert.equal(providerCalls.length, 0);
  assert.equal(queries.length, 0);
});

test("queue write error rolls back and records email setup failure", async () => {
  selections = [[], [{ recipientId: 1 }], [{ email: "recipient@example.com" }]];
  queryImpl = sql => {
    if (sql.startsWith("INSERT INTO message_email_attempts")) throw new Error("stub insert failure");
    return { rows: [] };
  };
  await assert.rejects(enqueueMessageEmail("request", 3, 4), /stub insert failure/);
  assert.ok(queries.some(q => q.sql === "ROLLBACK"));
  assert.ok(queries.some(q => q.sql.includes("state='email_setup_failed'")));
});
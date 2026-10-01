import { test } from "node:test";
import assert from "node:assert/strict";
import { appendThreadReply, normalizeConversationResponse, refreshedSelection, sortConversations, threadActivityDate } from "../components/chat/thread-state";

const question = { id: 1, createdAt: "2026-09-15T00:20:00Z", content: "Candidate question", replies: [] as any[] };
const resident = { id: 2, createdAt: "2026-09-30T13:01:00Z", inReplyTo: 1, content: "Original candidate response", attachments: [{ id: "doc", filename: "response.pdf" }] };
const adminReply = { id: 3, createdAt: "2026-09-30T14:05:00Z", inReplyTo: 1, content: "Admin reply" };

test("candidate response survives optimistic reply, refresh, reopen and rehydration", () => {
  const before = { ...question, replies: [resident] };
  const optimistic = appendThreadReply(before, adminReply);
  assert.deepEqual(optimistic.replies.map(r => r.id), [2, 3]);
  assert.equal(optimistic.replies[0].content, resident.content);
  assert.deepEqual(optimistic.replies[0].attachments, resident.attachments);
  const refreshed = normalizeConversationResponse(JSON.parse(JSON.stringify([optimistic])));
  assert.deepEqual(refreshedSelection(refreshed, before), refreshed[0]);
  assert.deepEqual(refreshedSelection(refreshed, optimistic)?.replies?.map(r => r.id), [2, 3]);
  assert.equal(question.createdAt, "2026-09-15T00:20:00Z");
});

test("replayed server reply is deduplicated, not appended twice", () => {
  const thread = appendThreadReply({ ...question, replies: [resident] }, adminReply);
  assert.deepEqual(appendThreadReply(thread, adminReply).replies.map(r => r.id), [2, 3]);
});

test("latest visible reply orders conversation above newer roots without altering original date", () => {
  const thread = { ...question, replies: [resident, adminReply] };
  const other = { id: 4, createdAt: "2026-09-29T20:58:00Z", replies: [] };
  assert.deepEqual(sortConversations([other, thread]).map(r => r.id), [1, 4]);
  assert.equal(threadActivityDate(thread)?.toISOString(), adminReply.createdAt.replace("Z", ".000Z"));
  assert.equal(thread.createdAt, question.createdAt);
});

test("nested activity and visible orphan roots remain discoverable", () => {
  const orphan = { ...resident, replies: [adminReply] };
  assert.deepEqual(normalizeConversationResponse([orphan]).map(r => r.id), [2]);
  assert.equal(refreshedSelection([{ ...question, replies: [resident, adminReply] }], orphan)?.id, 1);
  assert.equal(threadActivityDate({ ...question, replies: [{ ...resident, replies: [adminReply] }] })?.getTime(), new Date(adminReply.createdAt).getTime());
});

test("selection is refreshed by identity or removed, never retains stale history", () => {
  const fresh = { ...question, replies: [resident, adminReply] };
  assert.equal(refreshedSelection([fresh], question), fresh);
  assert.equal(refreshedSelection([], question), null);
  assert.equal(refreshedSelection([fresh], null), null);
});

test("malformed responses throw instead of resetting history to empty", () => {
  assert.throws(() => normalizeConversationResponse({ success: false }));
  assert.throws(() => normalizeConversationResponse([{ id: 1, replies: "invalid" }]));
  assert.deepEqual(normalizeConversationResponse([]), []);
});
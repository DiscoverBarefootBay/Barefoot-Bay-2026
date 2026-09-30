import assert from "node:assert/strict";
import test from "node:test";
import { isRecentSend, millisecondsUntilNextExpiry, SEND_PROGRESS_WINDOW_MS } from "../components/chat/recent-send-progress";

const now = Date.parse("2026-09-30T12:00:00.000Z");
const createdAt = (milliseconds: number) => new Date(now - milliseconds).toISOString();

test("only submissions younger than 24 hours appear, including while sending", () => {
  assert.equal(isRecentSend(createdAt(SEND_PROGRESS_WINDOW_MS - 1), now), true);
  assert.equal(isRecentSend(createdAt(SEND_PROGRESS_WINDOW_MS), now), false);
  assert.equal(isRecentSend(createdAt(SEND_PROGRESS_WINDOW_MS + 1), now), false);
  assert.equal(isRecentSend(createdAt(0), now), true);
  assert.equal(isRecentSend(new Date(now + 1).toISOString(), now), false);
  assert.equal(isRecentSend("not a date", now), false);
});

test("open pages schedule the next expiry at the earliest visible cutoff", () => {
  const jobs = [
    { createdAt: createdAt(SEND_PROGRESS_WINDOW_MS + 1) },
    { createdAt: createdAt(SEND_PROGRESS_WINDOW_MS - 250) },
    { createdAt: createdAt(SEND_PROGRESS_WINDOW_MS - 1200) },
  ];
  assert.equal(millisecondsUntilNextExpiry(jobs, now), 250);
  assert.equal(millisecondsUntilNextExpiry(jobs, now + 250), 950);
  assert.equal(millisecondsUntilNextExpiry(jobs, now + 1200), null);
});
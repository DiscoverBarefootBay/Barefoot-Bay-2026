import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  fetchAdminMessages,
  filterAdminMessages,
  type AdminMessage,
} from "../lib/admin-messages";

const messages: AdminMessage[] = [
  {
    id: 1,
    subject: "Beach cleanup",
    content: "Meet Saturday",
    senderId: 2,
    messageType: "user",
    inReplyTo: null,
    deletedAt: null,
    deletedBySender: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sender: {
      id: 2,
      username: "bay-member",
      fullName: "Bay Member",
      email: "malgatitx@gmail.com",
      role: "registered",
    },
    recipients: [],
    attachments: [],
  },
  {
    id: 2,
    subject: "Sender account removed",
    content: "Historical message",
    senderId: 3,
    messageType: "user",
    inReplyTo: null,
    deletedAt: null,
    deletedBySender: false,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    sender: null,
    recipients: [],
    attachments: [],
  },
];

describe("admin messages client helpers", () => {
  it("searches subjects and nullable sender details without excluding any email address", () => {
    assert.deepEqual(filterAdminMessages(messages, "  MALGATITX@GMAIL.COM "), [messages[0]]);
    assert.deepEqual(filterAdminMessages(messages, "removed"), [messages[1]]);
    assert.deepEqual(filterAdminMessages(messages, ""), messages);
  });

  it("retains the independent server total even when only a limited/search-filtered list is returned", async () => {
    let requestInit: RequestInit | undefined;
    const result = await fetchAdminMessages(async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ success: true, data: messages.slice(0, 1), total: 4200 }));
    });
    assert.equal(requestInit?.credentials, "include");
    assert.equal(result.messages.length, 1);
    assert.equal(result.total, 4200);
    assert.equal(filterAdminMessages(result.messages, "nothing").length, 0);
    assert.equal(result.total, 4200);
  });

  it("surfaces load failures so the page can show an error and retry instead of an empty state", async () => {
    await assert.rejects(
      fetchAdminMessages(async () => new Response(
        JSON.stringify({ success: false, message: "Messages temporarily unavailable" }),
        { status: 500 },
      )),
      /Messages temporarily unavailable/,
    );
  });

  it("keeps load errors, previous-data labels, retries, and selection refresh wired to the page", async () => {
    const page = await readFile(new URL("../pages/admin/admin-messages.tsx", import.meta.url), "utf8");
    assert.match(page, /status-message-load-error/);
    assert.match(page, /button-retry-message-load/);
    assert.match(page, /Showing previously loaded data/);
    assert.match(page, /button-retry-message-refresh/);
    assert.match(page, /All Messages \{hasLoadedMessages \? `\(\$\{totalMessages\}\)`/);
    assert.match(page, /loading \? "\(loading\.\.\.\)" : "\(unavailable\)"/);
    assert.match(page, /setSelectedMessage\(\(current\) =>\s*current \? result\.messages\.find/);
    assert.doesNotMatch(page, /malgatitx@gmail\.com/);
    assert.match(page, /status-empty-messages/);
  });
});
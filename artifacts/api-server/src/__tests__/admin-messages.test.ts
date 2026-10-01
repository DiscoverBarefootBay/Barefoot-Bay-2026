import assert from "node:assert/strict";
import { once } from "node:events";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import {
  buildAdminMessageDetails,
  createAdminMessagesRouter,
  deleteAdminMessageSafely,
  type AdminMessagesService,
} from "../routes/admin-messages-router";
import { isAdmin } from "../auth-helpers";

const message = {
  id: 41,
  senderId: 7,
  subject: "Hello",
  content: "A message",
  senderUsername: null,
  senderFullName: null,
  senderEmail: null,
  senderRole: null,
};

async function withApi(
  role: string,
  service: AdminMessagesService,
  run: (origin: string) => Promise<void>,
) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).isAuthenticated = () => true;
    req.user = { id: 7, role } as any;
    next();
  });
  const requireAuth: RequestHandler = (_req, _res, next) => next();
  app.use("/api/admin/messages", createAdminMessagesRouter(service, {
    requireAuth,
    requireAdmin: isAdmin,
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

describe("admin message API", () => {
  it("returns inferred recipient details for legacy messages with no recipient rows", () => {
    const [result] = buildAdminMessageDetails([message], [], []);
    assert.equal(result.hasInferredRecipients, true);
    assert.deepEqual(result.recipients, [{
      id: null,
      username: "admin-group",
      fullName: "All Administrators",
      email: null,
      role: "admin",
      readAt: null,
      status: "inferred",
    }]);
    assert.deepEqual(result.sender, {
      id: 7,
      username: null,
      fullName: null,
      email: null,
      role: null,
    });
  });

  it("preserves the server's total independently of the limited response rows", async () => {
    const service: AdminMessagesService = {
      async list() {
        return { messages: [{ id: 41 }], total: 1200 };
      },
      async delete() { return false; },
    };
    await withApi("admin", service, async (origin) => {
      const response = await fetch(`${origin}/api/admin/messages`);
      const result = await response.json() as any;
      assert.equal(response.status, 200);
      assert.equal(result.total, 1200);
      assert.deepEqual(result.data, [{ id: 41 }]);
    });
  });

  it("rejects a non-admin before querying messages or deleting anything", async () => {
    let serviceCalled = false;
    const service: AdminMessagesService = {
      async list() { serviceCalled = true; return { messages: [], total: 0 }; },
      async delete() { serviceCalled = true; return true; },
    };
    await withApi("registered", service, async (origin) => {
      const response = await fetch(`${origin}/api/admin/messages`);
      assert.equal(response.status, 403);
      const deleteResponse = await fetch(`${origin}/api/admin/messages/41`, { method: "DELETE" });
      assert.equal(deleteResponse.status, 403);
      assert.equal(serviceCalled, false);
    });
  });

  it("returns an explicit retryable API error when listing fails", async () => {
    const service: AdminMessagesService = {
      async list() { throw new Error("database unavailable"); },
      async delete() { return false; },
    };
    await withApi("admin", service, async (origin) => {
      const response = await fetch(`${origin}/api/admin/messages`);
      const result = await response.json() as any;
      assert.equal(response.status, 500);
      assert.equal(result.success, false);
      assert.match(result.message, /Failed to fetch messages/);
    });
  });

  it("checks legal hold before deleting any attachments or recipients", async () => {
    const deletes: string[] = [];
    const heldError = Object.assign(new Error("Held message"), { code: "LEGAL_HOLD" });
    const service: AdminMessagesService = {
      async list() { return { messages: [], total: 0 }; },
      async delete(id) {
        return deleteAdminMessageSafely(id, {
          async exists() { return true; },
          async assertDeletable() { throw heldError; },
          async deleteAttachments() { deletes.push("attachments"); },
          async deleteRecipients() { deletes.push("recipients"); },
          async deleteMessage() { deletes.push("message"); return true; },
        });
      },
    };
    await withApi("admin", service, async (origin) => {
      const response = await fetch(`${origin}/api/admin/messages/41`, { method: "DELETE" });
      const result = await response.json() as any;
      assert.equal(response.status, 423);
      assert.equal(result.error, "legal_hold");
      assert.deepEqual(deletes, []);
    });
  });
});
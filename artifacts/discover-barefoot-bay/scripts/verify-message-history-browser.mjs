import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

class DevToolsClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }

      for (const listener of this.listeners.get(message.method) ?? []) {
        Promise.resolve(listener(message.params)).catch((error) => {
          console.error(`DevTools listener failed for ${message.method}:`, error);
        });
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitFor(client, expression, timeout = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(client, expression)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function clickText(client, text, tag = "button") {
  const clicked = await evaluate(
    client,
    `(() => {
      const wanted = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll(${JSON.stringify(tag)})]
        .find((node) => node.textContent.trim() === wanted &&
          node.getBoundingClientRect().width > 0 &&
          node.getBoundingClientRect().height > 0);
      if (!element) return false;
      element.scrollIntoView({ block: "center" });
      element.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Visible ${tag} not found with exact text: ${text}`);
}

async function clickSelector(client, selector) {
  const clicked = await evaluate(
    client,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.scrollIntoView({ block: "center" });
      if (!element.getBoundingClientRect().width || !element.getBoundingClientRect().height) {
        return false;
      }
      element.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Visible element not found: ${selector}`);
}

async function clickSubject(client, subject) {
  await clickText(client, subject, "h3");
}

async function fillTextarea(client, selector, value) {
  const updated = await evaluate(
    client,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value",
      ).set;
      setter.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return element.value === ${JSON.stringify(value)};
    })()`,
  );
  if (!updated) throw new Error(`Could not fill textarea: ${selector}`);
}

async function captureScreenshot(client, filePath) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(filePath, Buffer.from(screenshot.data, "base64"));
}

function makeFixtures() {
  const now = Date.now();
  const iso = (offset) => new Date(now + offset).toISOString();
  const residentReply = {
    id: 102,
    senderId: 42,
    recipientId: 999,
    senderName: "Synthetic Resident",
    recipientName: "Synthetic Admin",
    subject: "Question about the community pool",
    content: "Original resident response: the gate code still does not work.",
    timestamp: iso(-2 * 60 * 60 * 1000),
    createdAt: iso(-2 * 60 * 60 * 1000),
    read: true,
    inReplyTo: 101,
    attachments: [{
      id: "resident-attachment-1",
      filename: "resident-response.txt",
      url: "/uploads/attachments/resident-response.txt",
      contentType: "text/plain",
    }],
    replies: [],
  };
  const earlierAdminReply = {
    id: 103,
    senderId: 999,
    recipientId: 42,
    senderName: "Synthetic Admin",
    recipientName: "Synthetic Resident",
    subject: "Question about the community pool",
    content: "Existing admin reply: we are checking the pool gate.",
    timestamp: iso(-4 * 60 * 1000),
    createdAt: iso(-4 * 60 * 1000),
    read: true,
    inReplyTo: 101,
    attachments: [],
    replies: [],
  };
  const root = {
    id: 101,
    senderId: 42,
    recipientId: 999,
    senderName: "Synthetic Resident",
    recipientName: "Synthetic Admin",
    subject: "Question about the community pool",
    content: "Question: can someone help with the pool gate?",
    timestamp: iso(-3 * 24 * 60 * 60 * 1000),
    createdAt: iso(-3 * 24 * 60 * 60 * 1000),
    read: true,
    threadRoot: true,
    attachments: [],
    replies: [residentReply, earlierAdminReply],
  };
  const otherRoot = {
    id: 201,
    senderId: 43,
    recipientId: 999,
    senderName: "Synthetic Neighbor",
    recipientName: "Synthetic Admin",
    subject: "Question about the boardwalk lights",
    content: "Could the boardwalk lights be checked?",
    timestamp: iso(-24 * 60 * 60 * 1000),
    createdAt: iso(-24 * 60 * 60 * 1000),
    read: true,
    threadRoot: true,
    attachments: [],
    replies: [{
      id: 202,
      senderId: 999,
      recipientId: 43,
      senderName: "Synthetic Admin",
      recipientName: "Synthetic Neighbor",
      subject: "Question about the boardwalk lights",
      content: "Boardwalk thread activity marker.",
      timestamp: iso(-2 * 60 * 1000),
      createdAt: iso(-2 * 60 * 1000),
      read: true,
      inReplyTo: 201,
      attachments: [],
      replies: [],
    }],
  };

  const adminMessages = [
    {
      id: 801,
      subject: "Resident sender is searchable",
      content: "Admin-list resident fixture",
      senderId: 42,
      messageType: "direct",
      inReplyTo: null,
      deletedAt: null,
      deletedBySender: false,
      createdAt: iso(-60_000),
      updatedAt: iso(-60_000),
      sender: {
        id: 42,
        username: "resident-search-needle",
        fullName: "Synthetic Resident",
        email: "resident-search-needle@example.test",
        role: "registered",
      },
      recipients: [],
      attachments: [],
    },
    {
      id: 802,
      subject: "Message with sender details unavailable",
      content: "Null sender fixture must remain visible.",
      senderId: 0,
      messageType: "direct",
      inReplyTo: null,
      deletedAt: null,
      deletedBySender: false,
      createdAt: iso(-120_000),
      updatedAt: iso(-120_000),
      sender: null,
      recipients: [],
      attachments: [],
    },
    {
      id: 803,
      subject: "Admin sender fixture",
      content: "A third loaded row keeps search and total counts distinct.",
      senderId: 999,
      messageType: "direct",
      inReplyTo: null,
      deletedAt: null,
      deletedBySender: false,
      createdAt: iso(-180_000),
      updatedAt: iso(-180_000),
      sender: {
        id: 999,
        username: "synthetic-admin",
        fullName: "Synthetic Admin",
        email: "synthetic-admin@example.test",
        role: "admin",
      },
      recipients: [],
      attachments: [],
    },
  ];

  return {
    // Return the initial server page in latest-activity order; the timestamps
    // intentionally differ from root message creation times.
    messages: [otherRoot, root],
    adminMessages,
    adminMessageTotal: 42,
    nextMessageId: 301,
  };
}

function makeConsentStatus() {
  const publishedAt = new Date().toISOString();
  const policies = ["terms", "privacy", "dmca"].map((key, index) => ({
    key,
    versionId: index + 1,
    title: `Synthetic ${key} policy`,
    url: `/${key}`,
    publishedAt,
    contentHtml: "<p>Synthetic browser-only policy fixture.</p>",
    changeNotes: null,
  }));
  return { policies, outstanding: [], requiresAcceptance: false };
}

const results = [];
const check = (condition, description) => {
  if (condition) {
    console.log(`PASS ${description}`);
    results.push({ ok: true, description });
  } else {
    console.error(`FAIL ${description}`);
    results.push({ ok: false, description });
  }
};

async function main() {
  const urlArgument = process.argv.slice(2).find((argument) => argument !== "--");
  const baseUrl = urlArgument ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://127.0.0.1");
  const appUrl = new URL(baseUrl);
  const port = 9_300 + (process.pid % 500);
  const profileDirectory = `/tmp/bb-message-history-browser-${process.pid}`;
  const screenshotPrefix = `/tmp/bb-message-history-browser-${process.pid}`;
  const chromium = spawn(
    process.env.CHROMIUM_PATH ?? "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromiumLog = "";
  chromium.stderr.on("data", (chunk) => {
    chromiumLog += chunk.toString();
  });

  let client;
  let authRole = "registered";
  let fixture = makeFixtures();
  let adminMessagesCalls = 0;
  let messageListGets = 0;
  const apiRequests = [];
  const unexpectedApiRequests = [];
  const fallbackApiReads = [];
  const interceptionErrors = [];

  const jsonResponse = (requestId, status, value) =>
    client.send("Fetch.fulfillRequest", {
      requestId,
      responseCode: status,
      responseHeaders: [
        { name: "Content-Type", value: "application/json; charset=utf-8" },
        { name: "Cache-Control", value: "no-store" },
      ],
      body: Buffer.from(JSON.stringify(value)).toString("base64"),
    });

  const resetConversationFixture = () => {
    fixture = makeFixtures();
    messageListGets = 0;
  };

  const pageUrl = (path, query) => {
    const url = new URL(path, appUrl);
    url.search = query;
    return url.href;
  };

  const navigate = async (path, query) => {
    await client.send("Page.navigate", { url: pageUrl(path, query) });
  };

  const setViewport = async (mobile) => {
    if (mobile) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await client.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      });
    } else {
      await client.send("Emulation.clearDeviceMetricsOverride");
      await client.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
  };

  try {
    let page;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const pages = await response.json();
        page = pages.find((candidate) => candidate.type === "page");
        if (page) break;
      } catch {
        // Chromium is still starting.
      }
      await sleep(250);
    }
    if (!page) throw new Error(`Chromium did not start:\n${chromiumLog}`);

    client = new DevToolsClient(page.webSocketDebuggerUrl);
    await client.connect();
    client.on("Fetch.requestPaused", async ({ requestId, request }) => {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) {
        await client.send("Fetch.continueRequest", { requestId });
        return;
      }

      const pathname = url.pathname.replace(/\/+$/, "");
      apiRequests.push({
        method: request.method,
        path: pathname,
        postData: request.postData ?? "",
      });

      try {
        if (pathname === "/api/user" && request.method === "GET") {
          const isAdmin = authRole === "admin";
          await jsonResponse(requestId, 200, {
            id: isAdmin ? 999 : 42,
            username: isAdmin ? "synthetic-admin" : "synthetic-resident",
            email: isAdmin ? "synthetic-admin@example.test" : "synthetic-resident@example.test",
            fullName: isAdmin ? "Synthetic Admin" : "Synthetic Resident",
            role: isAdmin ? "admin" : "registered",
            isApproved: true,
          });
          return;
        }

        if (pathname === "/api/feature-flags" && request.method === "GET") {
          await jsonResponse(requestId, 200, []);
          return;
        }

        if (pathname === "/api/legal/consent" && request.method === "GET") {
          await jsonResponse(requestId, 200, makeConsentStatus());
          return;
        }

        if (pathname === "/api/legal/policies" && request.method === "GET") {
          await jsonResponse(requestId, 200, makeConsentStatus().policies);
          return;
        }

        if (pathname.startsWith("/api/analytics/track/") &&
            ["POST", "GET"].includes(request.method)) {
          await jsonResponse(requestId, 200, { success: true, synthetic: true });
          return;
        }

        if (pathname === "/api/messages" && request.method === "GET") {
          messageListGets += 1;
          const activityTime = (message) => Math.max(
            new Date(message.timestamp || message.createdAt || "").getTime() || 0,
            ...(message.replies ?? []).map((reply) =>
              new Date(reply.timestamp || reply.createdAt || "").getTime() || 0),
          );
          await jsonResponse(requestId, 200, [...fixture.messages].sort(
            (left, right) => activityTime(right) - activityTime(left) || right.id - left.id,
          ));
          return;
        }

        if (pathname === "/api/chat/recipients" && request.method === "GET") {
          await jsonResponse(requestId, 200, [
            { id: "admin", name: "Synthetic Admin" },
            { id: "42", name: "Synthetic Resident" },
          ]);
          return;
        }

        if (pathname === "/api/messages/send-progress" && request.method === "GET") {
          await jsonResponse(requestId, 200, { jobs: [] });
          return;
        }

        const replyMatch = pathname.match(/^\/api\/messages\/(\d+)\/reply$/);
        if (replyMatch && request.method === "POST") {
          const rootId = Number(replyMatch[1]);
          const root = fixture.messages.find((message) => message.id === rootId);
          if (!root) {
            await jsonResponse(requestId, 404, { error: "Synthetic thread not found." });
            return;
          }
          const body = request.postData ?? "";
          const contentMatch = body.match(/name="content"\r\n\r\n([^\r]*)/);
          const content = contentMatch?.[1] ?? "Synthetic admin reply from the browser regression.";
          const replyTime = new Date().toISOString();
          const reply = {
            id: fixture.nextMessageId++,
            senderId: authRole === "admin" ? 999 : 42,
            recipientId: root.senderId,
            senderName: authRole === "admin" ? "Synthetic Admin" : "Synthetic Resident",
            recipientName: root.senderName,
            subject: root.subject,
            content,
            timestamp: replyTime,
            createdAt: replyTime,
            read: true,
            inReplyTo: root.id,
            attachments: [],
            replies: [],
          };
          root.replies.push(reply);
          await jsonResponse(requestId, 200, { message: reply });
          return;
        }

        if (pathname === "/api/admin/messages" && request.method === "GET") {
          adminMessagesCalls += 1;
          if (adminMessagesCalls === 1) {
            await jsonResponse(requestId, 503, {
              success: false,
              message: "Synthetic temporary admin-message load failure.",
            });
          } else {
            await jsonResponse(requestId, 200, {
              success: true,
              data: fixture.adminMessages,
              total: fixture.adminMessageTotal,
            });
          }
          return;
        }

        if (request.method === "GET" || request.method === "HEAD") {
          fallbackApiReads.push(`${request.method} ${pathname}`);
          await jsonResponse(requestId, 200, []);
        } else {
          unexpectedApiRequests.push(`${request.method} ${pathname}`);
          await jsonResponse(requestId, 409, {
            error: `Blocked by synthetic browser API fixture: ${request.method} ${pathname}`,
          });
        }
      } catch (error) {
        interceptionErrors.push(`${request.method} ${pathname}: ${error.message}`);
        try {
          await jsonResponse(requestId, 500, { error: "Synthetic API interception failed." });
        } catch {
          // The request may already have been completed by the failed response.
        }
      }
    });

    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Fetch.enable", {
        patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }],
      }),
    ]);

    const runConversationFlow = async (mobile) => {
      const label = mobile ? "390px phone" : "desktop";
      await setViewport(mobile);
      resetConversationFixture();
      authRole = "registered";
      await navigate("/messages", `synthetic-user-fixture=${label.replaceAll(" ", "-")}`);
      try {
        await waitFor(
          client,
          `document.querySelector('meta[name="username"]')?.content === "synthetic-resident" &&
           [...document.querySelectorAll(".divide-y h3")].some((h) =>
             h.textContent.trim() === "Question about the community pool")`,
        );
        check(
          await evaluate(client, `document.querySelector('meta[name="username"]')?.content`) ===
            "synthetic-resident",
          `${label}: signed-in resident fixture was used`,
        );
      } catch (error) {
        const diagnostics = await evaluate(
          client,
          `({
            url: location.href,
            title: document.title,
            username: document.querySelector('meta[name="username"]')?.content ?? null,
            text: document.body?.innerText?.slice(0, 900) ?? "",
          })`,
        ).catch(() => ({}));
        check(false, `${label}: resident fixture loaded chat (${error.message}); ${JSON.stringify(diagnostics)}`);
        return;
      }

      resetConversationFixture();
      authRole = "admin";
      await navigate("/messages", `synthetic-admin-fixture=${label.replaceAll(" ", "-")}`);
      try {
        await waitFor(
          client,
          `document.querySelector('meta[name="username"]')?.content === "synthetic-admin" &&
           [...document.querySelectorAll(".divide-y h3")].some((h) =>
             h.textContent.trim() === "Question about the community pool")`,
        );
      } catch (error) {
        check(false, `${label}: admin fixture loaded threaded messages (${error.message})`);
        return;
      }

      check(
        await evaluate(client, `document.querySelector('meta[name="username"]')?.content`) ===
          "synthetic-admin",
        `${label}: signed-in admin fixture was used for the reply flow`,
      );
      let subjects = await evaluate(
        client,
        `([...document.querySelectorAll(".divide-y h3")]).map((h) => h.textContent.trim())`,
      );
      check(
        subjects[0] === "Question about the boardwalk lights" &&
          subjects[1] === "Question about the community pool",
        `${label}: conversations sort by latest visible activity, not root sent date`,
      );
      check(
        subjects.length === 2 &&
          !subjects.includes("Original resident response: the gate code still does not work.") &&
          !subjects.includes("Existing admin reply: we are checking the pool gate."),
        `${label}: replies are grouped under their conversation roots without duplicate list rows`,
      );

      await clickSubject(client, "Question about the community pool");
      try {
        await waitFor(
          client,
          `document.querySelector("div.p-6.relative")?.innerText.includes(
            "Original resident response: the gate code still does not work.")`,
          5_000,
        );
      } catch (error) {
        const diagnostics = await evaluate(
          client,
          `({
            url: location.href,
            title: document.title,
            headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.innerText),
            text: document.body?.innerText?.slice(0, 1_800) ?? "",
            detailClasses: [...document.querySelectorAll("h2")].map((h) =>
              h.parentElement?.parentElement?.parentElement?.className ?? ""),
          })`,
        );
        await captureScreenshot(
          client,
          `${screenshotPrefix}-${mobile ? "phone" : "desktop"}-detail-debug.png`,
        );
        check(false, `${label}: selected conversation renders its original response (${error.message}); ${JSON.stringify(diagnostics)}`);
        return;
      }
      const originalThreadText = await evaluate(
        client,
        `document.querySelector("div.p-6.relative")?.innerText ?? ""`,
      );
      check(
        originalThreadText.includes("Question: can someone help with the pool gate?") &&
          originalThreadText.includes("Original resident response: the gate code still does not work.") &&
          originalThreadText.includes("Existing admin reply: we are checking the pool gate.") &&
          originalThreadText.includes("resident-response.txt"),
        `${label}: initial root, resident response, existing admin reply, and attachment render`,
      );

      await clickText(client, "resident-response.txt", "span");
      try {
        await waitFor(
          client,
          `Boolean(document.querySelector('a[href*="resident-response.txt"]'))`,
        );
        const attachmentLink = await evaluate(
          client,
          `document.querySelector('a[href*="resident-response.txt"]')?.getAttribute("href")`,
        );
        check(
          attachmentLink?.includes("/api/attachments/resident-response.txt"),
          `${label}: original resident attachment link is retained`,
        );
      } catch (error) {
        check(false, `${label}: original resident attachment opens a link (${error.message})`);
      }
      await clickSelector(client, "div.fixed.inset-0 button");

      await clickText(client, "Reply");
      await waitFor(client, `Boolean(document.querySelector('textarea[placeholder="Type your reply..."]'))`);
      const adminReplyText = "New synthetic admin reply must remain in this thread.";
      await fillTextarea(client, 'textarea[placeholder="Type your reply..."]', adminReplyText);
      const getsBeforeReply = messageListGets;
      await clickText(client, "Send Reply");
      try {
        await waitFor(
          client,
          `document.querySelector("div.p-6.relative")?.innerText.includes(
            "Your reply has been sent successfully!")`,
        );
      } catch {
        // The success notice is transient; the thread and API mutation are checked below.
      }
      const postReplyThread = await evaluate(
        client,
        `document.querySelector("div.p-6.relative")?.innerText ?? ""`,
      );
      check(
        apiRequests.some((request) =>
          request.method === "POST" && request.path === "/api/messages/101/reply"),
        `${label}: reply was submitted only to the intercepted synthetic API`,
      );
      const submittedReply = apiRequests.find((request) =>
        request.method === "POST" && request.path === "/api/messages/101/reply");
      check(
        Boolean(submittedReply?.postData.includes("inReplyTo") &&
          submittedReply.postData.includes("101") &&
          submittedReply.postData.includes("sendEmail") &&
          /sendEmail[\s\S]{0,120}false/.test(submittedReply.postData)),
        `${label}: intercepted reply targets the original thread with email sending disabled`,
      );
      check(
        postReplyThread.includes(adminReplyText),
        `${label}: submitted admin reply is visible immediately`,
      );

      try {
        const startedAt = Date.now();
        while (messageListGets <= getsBeforeReply && Date.now() - startedAt < 5_000) {
          await sleep(100);
        }
        if (messageListGets <= getsBeforeReply) throw new Error("No message-list refresh request observed.");
        check(true, `${label}: successful background message refresh ran after sending`);
      } catch {
        check(false, `${label}: successful background message refresh ran after sending`);
      }

      // Add an independent server-side reply, then focus the tab. This confirms
      // that the focus refresh reconciles the selected thread from the API.
      const root = fixture.messages.find((message) => message.id === 101);
      const focusTime = new Date(Date.now() + 30_000).toISOString();
      root.replies.push({
        id: 290,
        senderId: 999,
        recipientId: 42,
        senderName: "Synthetic Admin",
        recipientName: "Synthetic Resident",
        subject: root.subject,
        content: "Synthetic reply added before the background focus refresh.",
        timestamp: focusTime,
        createdAt: focusTime,
        read: true,
        inReplyTo: 101,
        attachments: [],
        replies: [],
      });
      const getsBeforeFocus = messageListGets;
      await evaluate(client, "window.dispatchEvent(new Event('focus'))");
      try {
        const startedAt = Date.now();
        let refreshed = false;
        while (Date.now() - startedAt < 7_000) {
          if (messageListGets > getsBeforeFocus) {
            refreshed = await evaluate(
              client,
              `document.querySelector("div.p-6.relative")?.innerText.includes(
                "Synthetic reply added before the background focus refresh.")`,
            );
            if (refreshed) break;
          }
          await sleep(150);
        }
        if (!refreshed) throw new Error("Focus refresh did not reconcile the selected thread.");
        check(true, `${label}: focus refresh updates the selected thread from synthetic API data`);
      } catch {
        check(false, `${label}: focus refresh updates the selected thread from synthetic API data`);
      }

      const refreshedThreadText = await evaluate(
        client,
        `document.querySelector("div.p-6.relative")?.innerText ?? ""`,
      );
      check(
        refreshedThreadText.includes("Original resident response: the gate code still does not work.") &&
          refreshedThreadText.includes("Existing admin reply: we are checking the pool gate.") &&
          refreshedThreadText.includes(adminReplyText) &&
          refreshedThreadText.includes("Synthetic reply added before the background focus refresh.") &&
          refreshedThreadText.includes("resident-response.txt"),
        `${label}: resident response, attachment, old admin reply, and new replies survive background refresh`,
      );

      await captureScreenshot(client, `${screenshotPrefix}-${mobile ? "phone" : "desktop"}-thread.png`);
      if (mobile) await clickText(client, "Back to messages");
      else await clickText(client, "Back", "span");
      try {
        await waitFor(
          client,
          `document.querySelectorAll(".divide-y h3").length === 2`,
        );
      } catch {
        // Keep the remaining assertions useful if the list itself did not settle.
      }
      subjects = await evaluate(
        client,
        `([...document.querySelectorAll(".divide-y h3")]).map((h) => h.textContent.trim())`,
      );
      check(
        subjects[0] === "Question about the community pool" &&
          subjects[1] === "Question about the boardwalk lights",
        `${label}: conversation with latest new reply moves to the top of the list`,
      );
      check(
        subjects.length === 2 && new Set(subjects).size === subjects.length,
        `${label}: refreshed list contains each root exactly once and no reply duplicates`,
      );

      await clickSubject(client, "Question about the community pool");
      try {
        await waitFor(
          client,
          `document.querySelector("div.p-6.relative")?.innerText.includes(${JSON.stringify(adminReplyText)})`,
        );
      } catch {
        // Record the subsequent assertion as a clear failure rather than aborting.
      }
      let reopenedText = await evaluate(
        client,
        `document.querySelector("div.p-6.relative")?.innerText ?? ""`,
      );
      check(
        reopenedText.includes("Original resident response: the gate code still does not work.") &&
          reopenedText.includes("Existing admin reply: we are checking the pool gate.") &&
          reopenedText.includes(adminReplyText) &&
          reopenedText.includes("resident-response.txt"),
        `${label}: reopening the conversation preserves original response, attachment, and new admin reply`,
      );

      await navigate("/messages", `synthetic-admin-reload=${label.replaceAll(" ", "-")}`);
      try {
        await waitFor(
          client,
          `document.querySelector('meta[name="username"]')?.content === "synthetic-admin" &&
           [...document.querySelectorAll(".divide-y h3")].some((h) =>
             h.textContent.trim() === "Question about the community pool")`,
        );
      } catch (error) {
        check(false, `${label}: reload returns the synthetic conversation list (${error.message})`);
        return;
      }
      await clickSubject(client, "Question about the community pool");
      try {
        await waitFor(
          client,
          `document.querySelector("div.p-6.relative")?.innerText.includes(${JSON.stringify(adminReplyText)})`,
        );
      } catch {
        // Assertions below capture the missing history.
      }
      reopenedText = await evaluate(
        client,
        `document.querySelector("div.p-6.relative")?.innerText ?? ""`,
      );
      check(
        reopenedText.includes("Original resident response: the gate code still does not work.") &&
          reopenedText.includes("Existing admin reply: we are checking the pool gate.") &&
          reopenedText.includes(adminReplyText) &&
          reopenedText.includes("Synthetic reply added before the background focus refresh.") &&
          reopenedText.includes("resident-response.txt"),
        `${label}: reload and reopen preserve all fixture and submitted thread history`,
      );
      await clickText(client, "resident-response.txt", "span");
      try {
        await waitFor(
          client,
          `Boolean(document.querySelector('a[href*="/api/attachments/resident-response.txt"]'))`,
          3_000,
        );
      } catch {
        // The assertion below reports a missing attachment action.
      }
      const reloadLinkExists = await evaluate(
        client,
        `Boolean(document.querySelector('a[href*="/api/attachments/resident-response.txt"]'))`,
      );
      check(
        reloadLinkExists,
        `${label}: attachment link remains available after reload and reopen`,
      );
      await captureScreenshot(client, `${screenshotPrefix}-${mobile ? "phone" : "desktop"}-reloaded.png`);
    };

    const runAdminRetryFlow = async (mobile) => {
      const label = mobile ? "390px phone" : "desktop";
      await setViewport(mobile);
      authRole = "admin";
      adminMessagesCalls = 0;
      await navigate("/admin/messages", `synthetic-admin-load-failure=${label.replaceAll(" ", "-")}`);
      try {
        await waitFor(
          client,
          `Boolean(document.querySelector('[data-testid="status-message-load-error"]'))`,
        );
      } catch (error) {
        const diagnostics = await evaluate(
          client,
          `({
            url: location.href,
            title: document.title,
            username: document.querySelector('meta[name="username"]')?.content ?? null,
            text: document.body?.innerText?.slice(0, 900) ?? "",
          })`,
        ).catch(() => ({}));
        check(false, `${label}: initial admin messages API failure renders recoverable error (${error.message}); ${JSON.stringify(diagnostics)}`);
        return;
      }
      const initialAdminState = await evaluate(
        client,
        `({
          retry: Boolean(document.querySelector('[data-testid="button-retry-message-load"]')),
          title: [...document.querySelectorAll("h1,h2")].map((el) => el.innerText).join(" "),
          text: document.body.innerText,
        })`,
      );
      check(
        initialAdminState.retry,
        `${label}: admin message-load failure provides a Retry control`,
      );
      check(
        !/All Messages\s*\(0\)/.test(initialAdminState.text),
        `${label}: admin load failure does not present the page as All Messages (0)`,
      );

      await clickSelector(client, '[data-testid="button-retry-message-load"]');
      try {
        await waitFor(
          client,
          `document.querySelector('[data-testid="text-message-count"]')?.innerText.includes(
            "Showing 3 matching of 3 loaded messages")`,
        );
      } catch (error) {
        const diagnostics = await evaluate(
          client,
          `({
            text: document.body?.innerText?.slice(0, 1_800) ?? "",
            calls: [...document.querySelectorAll("[data-testid]")].map((el) =>
              [el.getAttribute("data-testid"), el.innerText]),
          })`,
        );
        check(false, `${label}: retry loads the synthetic admin-message list (${error.message}); calls=${adminMessagesCalls}; state=${JSON.stringify(diagnostics)}`);
        return;
      }

      const loadedText = await evaluate(client, "document.body.innerText");
      check(
        loadedText.includes("Synthetic Resident") &&
          loadedText.includes("Unknown sender") &&
          loadedText.includes("Synthetic Admin"),
        `${label}: retry includes resident, unavailable, and admin sender records`,
      );
      check(
        loadedText.includes("All Messages (42)") &&
          loadedText.includes("Showing 3 matching of 3 loaded messages; 42 total messages"),
        `${label}: loaded count and total count are distinct`,
      );

      // The admin page uses an input, not a textarea; set it using a native setter
      // so React's controlled search state is updated through its real event path.
      await evaluate(
        client,
        `(() => {
          const input = document.querySelector("input[data-testid='input-search-messages']");
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, "resident-search-needle");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`,
      );
      try {
        await waitFor(
          client,
          `document.querySelector('[data-testid="text-message-count"]')?.innerText.includes(
            "Showing 1 matching of 3 loaded messages; 42 total messages")`,
        );
        check(
          true,
          `${label}: search count is one match while loaded and server totals remain three and 42`,
        );
      } catch {
        const countText = await evaluate(
          client,
          `document.querySelector('[data-testid="text-message-count"]')?.innerText ?? ""`,
        );
        check(
          false,
          `${label}: search count is one match while loaded and server totals remain three and 42 (got "${countText}")`,
        );
      }
      await captureScreenshot(
        client,
        `${screenshotPrefix}-${mobile ? "phone" : "desktop"}-admin-messages.png`,
      );
    };

    for (const mobile of [false, true]) {
      try {
        await runConversationFlow(mobile);
      } catch (error) {
        check(false, `${mobile ? "390px phone" : "desktop"}: conversation scenario completed (${error.message})`);
      }
      try {
        await runAdminRetryFlow(mobile);
      } catch (error) {
        check(false, `${mobile ? "390px phone" : "desktop"}: admin retry scenario completed (${error.message})`);
      }
    }

    check(
      unexpectedApiRequests.length === 0,
      unexpectedApiRequests.length
        ? `no unrecognized API writes occurred; blocked writes: ${unexpectedApiRequests.join(", ")}`
        : "all application API write requests were either synthetic fixture writes or blocked before reaching the dev API",
    );
    check(
      interceptionErrors.length === 0,
      interceptionErrors.length
        ? `synthetic API interception completed without errors: ${interceptionErrors.join("; ")}`
        : "synthetic API interception completed without errors",
    );
    check(
      apiRequests.some((request) =>
        request.method === "POST" && request.path === "/api/messages/101/reply"),
      "all reply writes were intercepted before reaching the dev API",
    );
    const writes = apiRequests.filter((request) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method));
    console.log(`Synthetic API requests intercepted: ${apiRequests.length}; writes blocked/stubbed: ${writes.length}`);
    console.log(`Read-only API paths answered with generic synthetic empty data: ${new Set(fallbackApiReads).size}`);
    console.log(`Screenshots saved under ${screenshotPrefix}-*.png`);
  } finally {
    client?.close();
    const chromiumExited = new Promise((resolve) => {
      chromium.once("exit", resolve);
    });
    chromium.kill("SIGTERM");
    await Promise.race([chromiumExited, sleep(3_000)]);
    if (chromium.exitCode === null) {
      chromium.kill("SIGKILL");
      await Promise.race([chromiumExited, sleep(1_000)]);
    }
    await rm(profileDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }

  const failures = results.filter((result) => !result.ok);
  console.log(`\nBrowser regression checks: ${results.length - failures.length} passed, ${failures.length} failed.`);
  if (failures.length) {
    for (const failure of failures) console.error(`FAILED: ${failure.description}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
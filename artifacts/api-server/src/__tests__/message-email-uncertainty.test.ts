import assert from "node:assert/strict";
import { mock, test } from "node:test";

let transport: () => Promise<any> = async () => [{ statusCode: 202 }];
let calls = 0;
mock.module("@sendgrid/mail", { defaultExport: {
  setApiKey() {},
  send: async () => { calls++; return transport(); },
}});
mock.module("../lib/sendgrid-credentials.ts", { namedExports: {
  getSendGridApiKey: async () => "stub-test-credential",
}});
mock.module("../forsale-email-config.ts", { namedExports: {
  loadForSaleEmailConfig: async () => ({}), renderTemplate: () => "", htmlToText: () => "",
}});
mock.module("../unsubscribe-token.ts", { namedExports: {
  getUnsubscribeTokenForEmail: async () => null,
  tokenizeUnsubscribeLinks: (text: string) => text,
  unsubscribeHeaders: () => ({}),
}});
const { sendMessageEmail } = await import("../sendgrid-service");
const send = (throwOnUncertain = true) => sendMessageEmail(
  "stub@example.invalid", "Stub subject", "Stub body", "Stub sender", "sender@example.invalid",
  undefined, undefined, false, undefined, { throwOnUncertain });

test("real sendMessageEmail propagates sgMail transport uncertainty only when opted in", async () => {
  calls = 0;
  const reset = Object.assign(new Error("connection reset after submission"), { code: "ECONNRESET" });
  transport = async () => { throw reset; };
  await assert.rejects(send(), error => error === reset);
  assert.equal(await send(false), false, "legacy boolean behavior is preserved");
  assert.equal(calls, 2);
});

test("explicit sgMail 4xx rejection remains failed; 5xx remains uncertain", async () => {
  // Matches SendGrid ResponseError shape: code is numeric, response has body/headers.
  transport = async () => { throw Object.assign(new Error("rejected"), { code: 400, response: { body: { errors: [] } } }); };
  assert.equal(await send(), false);
  transport = async () => { throw Object.assign(new Error("upstream unavailable"), { code: 503 }); };
  await assert.rejects(send(), /upstream unavailable/);
});

test("actual sgMail acceptance resolves true in durable mode", async () => {
  transport = async () => [{ statusCode: 202 }];
  assert.equal(await send(), true);
});
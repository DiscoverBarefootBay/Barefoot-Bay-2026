import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// This suite guards the fire-and-forget welcome email in POST /api/register.
// A welcome-email failure (returns false OR rejects) must never break
// registration, and the email must be sent exactly once per successful signup.
//
// Requires Node's experimental module mocking (enabled in the test script via
// --experimental-test-module-mocks) so we can stub the heavy module singletons
// (db, storage, sendgrid, etc.) that the real registration route imports.

// Mutable hooks the mocked modules delegate to. Each test overrides these so the
// mock.module bindings (fixed at registration time) can change behavior per test.
let welcomeImpl: (email: string, fullName?: string | null) => Promise<boolean>;
let welcomeCalls: Array<{ email: string; fullName?: string | null }>;
let createdUsers: any[];
let existingUsername: any;
let existingEmail: any;
let initializedReadStates: number[];

let nextUserId = 1;

// Avoid the real DATABASE_URL requirement in ./db.
delete process.env.RECAPTCHA_SECRET_KEY;
process.env.NODE_ENV = 'test';

mock.module('../db.ts', {
  namedExports: {
    pool: {},
    db: {},
  },
});

mock.module('../performance.ts', {
  namedExports: {
    applyPerformanceOptimizations: () => {},
  },
});

mock.module('../bot-detection.ts', {
  namedExports: {
    isSuspiciousUsername: () => false,
    sendBotDetectionAlertEmail: async () => true,
  },
});

mock.module('../sendgrid-service.ts', {
  namedExports: {
    FROM_EMAIL: 'test@example.com',
    sendEmail: async () => true,
    sendWelcomeEmail: (email: string, fullName?: string | null) => {
      welcomeCalls.push({ email, fullName });
      return welcomeImpl(email, fullName);
    },
  },
});

mock.module('../storage.ts', {
  namedExports: {
    storage: {
      getUserByUsernameCaseInsensitive: async () => existingUsername,
      getUserByEmailCaseInsensitive: async () => existingEmail,
      createUser: async (insertUser: any) => {
        const user = { id: nextUserId++, ...insertUser };
        createdUsers.push(user);
        return user;
      },
      getUser: async (id: number) => createdUsers.find((u) => u.id === id),
      markAllContentAsReadForNewUser: async (id: number) => {
        assert.ok(createdUsers.some(u => u.id === id), 'read state initializes only after account/consent helper resolves');
        initializedReadStates.push(id);
      },
      initializeVendorPageVisitsForNewUser: async () => {},
      createFormSubmission: async () => ({ id: 1 }),
    },
  },
});

// Keep real strict input validation/error mapping; mock only the transactional
// account+consent persistence boundary. Database atomicity is covered separately
// by legal-policy.test.ts, and this email suite must not persist accounts.
const legalPolicy = await import('../legal-policy');
const currentAcceptances = [
  { key: 'terms', versionId: 101, accepted: true },
  { key: 'privacy', versionId: 102, accepted: true },
  { key: 'dmca', versionId: 103, accepted: true },
];
mock.module('../legal-policy.ts', {
  namedExports: {
    ...legalPolicy,
    registerWithConsent: async (insertUser: any, input: unknown) => {
      const acceptances = legalPolicy.acceptanceSchema.parse(input);
      if (acceptances.length !== 3) throw new legalPolicy.LegalError(400, 'INVALID_POLICY_ACCEPTANCE', 'Accept all three policies');
      for (const acceptance of acceptances) {
        if (!currentAcceptances.some(p => p.key === acceptance.key && p.versionId === acceptance.versionId)) {
          throw new legalPolicy.LegalError(409, 'POLICY_VERSION_CHANGED', 'Review current versions');
        }
      }
      const user = { id: nextUserId++, ...insertUser };
      createdUsers.push(user);
      return user;
    },
  },
});

let server: Server;
let baseUrl: string;

before(async () => {
  const { default: express } = await import('express');
  const { default: session } = await import('express-session');
  const { setupAuth } = await import('../auth');

  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
  setupAuth(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

beforeEach(() => {
  welcomeImpl = async () => true;
  welcomeCalls = [];
  createdUsers = [];
  existingUsername = undefined;
  existingEmail = undefined;
  initializedReadStates = [];
});

function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    username: `newuser${nextUserId}`,
    password: 'Sup3rSecret!',
    email: `newuser${nextUserId}@example.com`,
    fullName: 'New User',
    acceptedTerms: true,
    legalAcceptances: currentAcceptances.map(p => ({ ...p })),
    recaptchaToken: 'test-token',
    ...overrides,
  };
}

async function postRegister(body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Allow fire-and-forget .then/.catch microtasks to settle after the response.
function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 20));
}

describe('POST /api/register welcome email', () => {
  it('still succeeds (201, user created, logged in) when the welcome email returns false', async () => {
    welcomeImpl = async () => false;

    const res = await postRegister(registerBody());
    assert.equal(res.status, 201);

    const user = (await res.json()) as { id: number; username: string };
    assert.ok(user.id, 'response should include the created user id');
    assert.equal(createdUsers.length, 1, 'user should have been created');
    assert.deepEqual(initializedReadStates, [user.id], 'existing content is initialized as read after signup');

    // Logged in: passport sets a session cookie on successful req.login.
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && /connect\.sid=/.test(setCookie), 'session cookie should be set');

    await flushMicrotasks();
  });

  it('still succeeds (201, user created, logged in) when the welcome email rejects', async () => {
    welcomeImpl = async () => {
      throw new Error('SendGrid blew up');
    };

    const res = await postRegister(registerBody());
    assert.equal(res.status, 201);

    const user = (await res.json()) as { id: number };
    assert.ok(user.id, 'response should include the created user id');
    assert.equal(createdUsers.length, 1, 'user should have been created');
    assert.deepEqual(initializedReadStates, [user.id], 'read initialization survives welcome-email failure');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && /connect\.sid=/.test(setCookie), 'session cookie should be set');

    await flushMicrotasks();
  });

  it('sends the welcome email exactly once per successful registration', async () => {
    const body = registerBody();
    const res = await postRegister(body);
    assert.equal(res.status, 201);

    await flushMicrotasks();

    assert.equal(welcomeCalls.length, 1, 'welcome email should be sent exactly once');
    assert.equal(welcomeCalls[0].email, body.email);
    assert.equal(welcomeCalls[0].fullName, body.fullName);
  });

  it('does not send a welcome email when registration fails validation', async () => {
    const res = await postRegister(registerBody({
      legalAcceptances: currentAcceptances.map(p => ({ ...p, accepted: p.key !== 'dmca' })),
    }));
    assert.equal(res.status, 400);

    await flushMicrotasks();

    assert.equal(welcomeCalls.length, 0, 'no welcome email when registration is rejected');
    assert.equal(createdUsers.length, 0, 'no user created when registration is rejected');
    assert.deepEqual(initializedReadStates, [], 'no read initialization for a rejected signup');
  });
  it('does not initialize read state or send email for stale legal versions', async () => {
    const res = await postRegister(registerBody({
      legalAcceptances: currentAcceptances.map(p => ({ ...p, versionId: p.versionId + 1 })),
    }));
    assert.equal(res.status, 409);
    await flushMicrotasks();
    assert.equal(welcomeCalls.length, 0);
    assert.equal(createdUsers.length, 0);
    assert.deepEqual(initializedReadStates, []);
  });
});

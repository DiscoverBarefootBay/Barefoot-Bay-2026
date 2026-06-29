import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression test for the analytics double-session bug.
 *
 * Bug: when the middleware created a session it set the cookie only on the
 * response. trackPageView() -> getOrCreateSession() then read req.cookies,
 * found nothing, and created a SECOND session. The page view landed on the
 * duplicate while the first session kept pages_viewed = 0 — inflating session
 * and visitor counts and halving the page-views-per-session ratio.
 *
 * Fix: after startSession() the middleware also mutates req.cookies so the
 * freshly created session is reused within the same request. These tests lock
 * that behaviour in, plus session reuse and bot skipping.
 */

const calls = {
  startSession: 0,
  // [cookieValueSeenAtCallTime] for each trackPageView invocation
  trackPageView: [] as Array<string | undefined>,
};
const NEW_SESSION_ID = 'session-created-by-startSession';

mock.module('../services/analytics-service', {
  namedExports: {
    analyticsService: {
      async startSession() {
        calls.startSession++;
        return NEW_SESSION_ID;
      },
      async trackPageView(req: any) {
        // Record what getOrCreateSession() would read at the moment the page
        // view is recorded. If the fix is present this is the new session id;
        // if it regresses this is undefined and a phantom session is created.
        calls.trackPageView.push(req?.cookies?.['analytics_session_id']);
      },
    },
  },
});

const { analyticsMiddleware } = await import('../analytics-service');

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function makeContext(cookies: Record<string, string> | undefined, userAgent = HUMAN_UA) {
  const res: any = {
    _cookies: [] as Array<[string, string, any]>,
    cookie(name: string, value: string, opts: any) {
      this._cookies.push([name, value, opts]);
    },
  };
  let nextCalled = 0;
  const req: any = {
    path: '/calendar',
    headers: { 'user-agent': userAgent },
    query: {},
    cookies,
    ip: '203.0.113.7',
    isAuthenticated: () => false,
  };
  const next = () => {
    nextCalled++;
  };
  return { req, res, next, getNextCalled: () => nextCalled };
}

describe('analyticsMiddleware session handling', () => {
  beforeEach(() => {
    calls.startSession = 0;
    calls.trackPageView = [];
  });

  it('creates exactly one session and reuses it for the page view (no phantom)', async () => {
    const { req, res, next, getNextCalled } = makeContext(undefined);

    await analyticsMiddleware(req, res, next);

    assert.equal(calls.startSession, 1, 'startSession should be called once');
    assert.equal(calls.trackPageView.length, 1, 'trackPageView should be called once');
    // The core regression assertion: the page view sees the just-created session
    // on req.cookies, so getOrCreateSession() reuses it instead of creating a 2nd.
    assert.equal(
      calls.trackPageView[0],
      NEW_SESSION_ID,
      'page view must reuse the session created this request (otherwise a phantom session is made)',
    );
    assert.equal(req.cookies?.['analytics_session_id'], NEW_SESSION_ID);
    assert.equal(res._cookies.length, 1, 'session cookie should be set on the response');
    assert.equal(res._cookies[0][1], NEW_SESSION_ID);
    assert.equal(getNextCalled(), 1, 'next() must always be called');
  });

  it('reuses an existing session cookie without creating a new session', async () => {
    const existing = 'pre-existing-session';
    const { req, res, next, getNextCalled } = makeContext({ analytics_session_id: existing });

    await analyticsMiddleware(req, res, next);

    assert.equal(calls.startSession, 0, 'must not start a new session when one exists');
    assert.equal(calls.trackPageView.length, 1);
    assert.equal(calls.trackPageView[0], existing, 'page view should use the existing session');
    assert.equal(res._cookies.length, 0, 'should not reset the cookie');
    assert.equal(getNextCalled(), 1);
  });

  it('skips recording for known bots but still continues the request', async () => {
    const { req, res, next, getNextCalled } = makeContext(undefined, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

    await analyticsMiddleware(req, res, next);

    assert.equal(calls.startSession, 0, 'bots must not create sessions');
    assert.equal(calls.trackPageView.length, 0, 'bots must not record page views');
    assert.equal(getNextCalled(), 1, 'next() must still be called for bots');
  });
});

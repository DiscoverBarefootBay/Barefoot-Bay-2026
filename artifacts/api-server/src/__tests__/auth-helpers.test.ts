import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';

import { checkIsAdmin, isAdmin } from '../auth-helpers';

type AuthState = {
  isAuthenticated?: boolean;
  user?: { role?: string; isAdmin?: boolean } | null;
};

function fakeReq(state: AuthState): Request {
  return {
    isAuthenticated: state.isAuthenticated === undefined
      ? undefined
      : () => !!state.isAuthenticated,
    user: state.user ?? undefined,
  } as unknown as Request;
}

function fakeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

describe('checkIsAdmin', () => {
  it('returns false when there is no isAuthenticated function on the request', () => {
    const req = { user: { role: 'admin' } } as unknown as Request;
    assert.equal(checkIsAdmin(req), false);
  });

  it('returns false when there is no user on the request', () => {
    const req = fakeReq({ isAuthenticated: true, user: null });
    assert.equal(checkIsAdmin(req), false);
  });

  it('returns false when the user is not authenticated', () => {
    const req = fakeReq({ isAuthenticated: false, user: { role: 'admin' } });
    assert.equal(checkIsAdmin(req), false);
  });

  it('returns true when authenticated and role is admin', () => {
    const req = fakeReq({ isAuthenticated: true, user: { role: 'admin' } });
    assert.equal(checkIsAdmin(req), true);
  });

  it('returns true when authenticated and isAdmin flag is true', () => {
    const req = fakeReq({ isAuthenticated: true, user: { role: 'registered', isAdmin: true } });
    assert.equal(checkIsAdmin(req), true);
  });

  it('returns false for an authenticated non-admin user', () => {
    const req = fakeReq({ isAuthenticated: true, user: { role: 'registered' } });
    assert.equal(checkIsAdmin(req), false);
  });
});

describe('isAdmin middleware', () => {
  it('calls next() when the user is an admin and does not send a response', () => {
    const req = fakeReq({ isAuthenticated: true, user: { role: 'admin' } });
    const res = fakeRes();
    const next = mock.fn<NextFunction>();
    isAdmin(req, res, next as unknown as NextFunction);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(res.body, undefined);
    assert.equal(res.statusCode, 200);
  });

  it('responds 403 and does not call next() when the user is not an admin', () => {
    const req = fakeReq({ isAuthenticated: true, user: { role: 'registered' } });
    const res = fakeRes();
    const next = mock.fn<NextFunction>();
    isAdmin(req, res, next as unknown as NextFunction);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      success: false,
      error: 'Access denied. Admin privileges required.',
    });
  });

  it('responds 403 for an anonymous request', () => {
    const req = { isAuthenticated: () => false } as unknown as Request;
    const res = fakeRes();
    const next = mock.fn<NextFunction>();
    isAdmin(req, res, next as unknown as NextFunction);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(res.statusCode, 403);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, comparePasswords, generateResetToken } from '../auth';

describe('hashPassword + comparePasswords', () => {
  it('produces a salted hash in the "hex.hex" format', async () => {
    const hashed = await hashPassword('correct horse battery staple');
    const parts = hashed.split('.');
    assert.equal(parts.length, 2, 'hashed password should have hash.salt format');
    assert.match(parts[0], /^[0-9a-f]+$/);
    assert.match(parts[1], /^[0-9a-f]+$/);
    // 64-byte hash + 16-byte salt → 128 + 32 hex chars
    assert.equal(parts[0].length, 128);
    assert.equal(parts[1].length, 32);
  });

  it('produces a different hash each time even for the same password (random salt)', async () => {
    const a = await hashPassword('hunter2');
    const b = await hashPassword('hunter2');
    assert.notEqual(a, b);
  });

  it('comparePasswords returns true for the correct password', async () => {
    const hashed = await hashPassword('hunter2');
    assert.equal(await comparePasswords('hunter2', hashed), true);
  });

  it('comparePasswords returns false for the wrong password', async () => {
    const hashed = await hashPassword('hunter2');
    assert.equal(await comparePasswords('not-hunter2', hashed), false);
  });
});

describe('generateResetToken', () => {
  it('returns a 64-character hex string (32 random bytes)', () => {
    const t = generateResetToken();
    assert.equal(t.length, 64);
    assert.match(t, /^[0-9a-f]+$/);
  });

  it('produces a different value on each call', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    assert.notEqual(a, b);
  });
});

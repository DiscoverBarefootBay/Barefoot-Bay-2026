import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  tokenizeUnsubscribeLinks,
  unsubscribeHeaders,
  buildUnsubscribeUrl,
  UNSUBSCRIBE_SCOPE,
} from '../unsubscribe-token';

describe('unsubscribe tokens', () => {
  it('round-trips a valid token', () => {
    const token = generateUnsubscribeToken(42);
    const verified = verifyUnsubscribeToken(token);
    assert.deepEqual(verified, { userId: 42, scope: UNSUBSCRIBE_SCOPE });
  });

  it('rejects tampered tokens', () => {
    const token = generateUnsubscribeToken(42);
    // Flip a character in the signature
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA');
    assert.equal(verifyUnsubscribeToken(tampered), null);
  });

  it('rejects a payload swapped to another user id', () => {
    const token = generateUnsubscribeToken(42);
    const sig = token.slice(token.lastIndexOf('.') + 1);
    const forgedPayload = Buffer.from(`999.${UNSUBSCRIBE_SCOPE}.${Date.now()}`).toString('base64url');
    assert.equal(verifyUnsubscribeToken(`${forgedPayload}.${sig}`), null);
  });

  it('rejects garbage inputs', () => {
    assert.equal(verifyUnsubscribeToken(null), null);
    assert.equal(verifyUnsubscribeToken(''), null);
    assert.equal(verifyUnsubscribeToken('abc'), null);
    assert.equal(verifyUnsubscribeToken('a.b.c'), null);
    assert.equal(verifyUnsubscribeToken('x'.repeat(600)), null);
  });

  it('tokenizes bare /unsubscribe links in html and text', () => {
    const token = 'tok123';
    const html = '<a href="https://barefootbay.com/unsubscribe">Unsubscribe</a>';
    assert.equal(
      tokenizeUnsubscribeLinks(html, token),
      '<a href="https://barefootbay.com/unsubscribe?token=tok123">Unsubscribe</a>',
    );
    const text = 'To stop, visit: https://barefootbay.com/unsubscribe\nBye';
    assert.ok(tokenizeUnsubscribeLinks(text, token).includes('/unsubscribe?token=tok123'));
  });

  it('leaves already-tokenized links alone', () => {
    const html = 'href="https://x.com/unsubscribe?token=abc"';
    assert.equal(tokenizeUnsubscribeLinks(html, 'zzz'), html);
  });

  it('builds RFC 8058 headers', () => {
    const headers = unsubscribeHeaders('https://barefootbay.com/', 'tok');
    assert.equal(headers['List-Unsubscribe'], '<https://barefootbay.com/api/unsubscribe?token=tok>');
    assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.equal(buildUnsubscribeUrl('https://barefootbay.com', 'tok'), 'https://barefootbay.com/unsubscribe?token=tok');
  });
});

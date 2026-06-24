import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  dedupeRecipientsByEmail,
  groupNotifiedUsersByEmail,
} from '../sendgrid-service';

describe('dedupeRecipientsByEmail', () => {
  it('keeps only the first record per case-insensitive email and skips blanks', () => {
    const input = [
      { username: 'a', email: 'shared@x.com' },
      { username: 'b', email: 'SHARED@x.com' },
      { username: 'c', email: '   shared@x.com   ' },
      { username: 'd', email: 'other@x.com' },
      { username: 'e', email: '' },
      { username: 'f', email: null as string | null },
      { username: 'g', email: undefined as string | undefined },
    ];
    const out = dedupeRecipientsByEmail(input);
    assert.deepEqual(
      out.map(r => r.username),
      ['a', 'd'],
    );
  });

  it('returns an empty array when given an empty array', () => {
    assert.deepEqual(dedupeRecipientsByEmail([]), []);
  });
});

describe('groupNotifiedUsersByEmail', () => {
  it('groups shared mailboxes and lists additional usernames', () => {
    const out = groupNotifiedUsersByEmail([
      { username: 'spouseA', email: 'shared@x.com' },
      { username: 'spouseB', email: 'SHARED@x.com' },
      { username: 'spouseA', email: 'shared@x.com' }, // duplicate primary username
      { username: 'solo', email: 'solo@x.com' },
    ]);
    assert.equal(out.length, 2);
    const shared = out.find(u => u.email.toLowerCase() === 'shared@x.com')!;
    assert.equal(shared.username, 'spouseA');
    assert.deepEqual(shared.additionalUsernames, ['spouseB']);
    const solo = out.find(u => u.email === 'solo@x.com')!;
    assert.deepEqual(solo.additionalUsernames, []);
  });

  it('skips entries with missing/blank emails', () => {
    const out = groupNotifiedUsersByEmail([
      { username: 'a', email: '' },
      { username: 'b', email: null },
      { username: 'c', email: undefined },
      { username: 'd', email: 'd@x.com' },
    ]);
    assert.deepEqual(
      out.map(u => u.username),
      ['d'],
    );
  });

  it('treats whitespace-trimmed usernames consistently and does not duplicate them', () => {
    const out = groupNotifiedUsersByEmail([
      { username: 'a', email: 'x@x.com' },
      { username: 'a', email: 'x@x.com' },
      { username: '   ', email: 'x@x.com' },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].username, 'a');
    assert.deepEqual(out[0].additionalUsernames, []);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isSuspiciousUsername } from '../bot-detection';

describe('isSuspiciousUsername', () => {
  it('flags all-caps long full names', () => {
    assert.equal(isSuspiciousUsername('user1', 'QPBLGFMJWZKEGIBMRM'), true);
  });

  it('flags long random-case strings (high upper/lower transitions)', () => {
    // "neFgJTvNeRmgMJxoKTl" has 5+ case transitions and is long enough
    assert.equal(isSuspiciousUsername('neFgJTvNeRmgMJxoKTl', 'Real Name'), true);
  });

  it('flags long strings with very low vowel ratio + long consonant cluster', () => {
    assert.equal(isSuspiciousUsername('xkcdfghjklmnpqrst', 'Real Name'), true);
  });

  it('does NOT flag a normal human full name', () => {
    assert.equal(isSuspiciousUsername('john_doe', 'John Doe'), false);
  });

  it('does NOT flag a normal username with a birth-year number', () => {
    // "michaelanthony25" has letters+numbers but no other bot signals
    assert.equal(isSuspiciousUsername('michaelanthony25', 'Michael Anthony'), false);
  });

  it('does NOT flag short strings', () => {
    assert.equal(isSuspiciousUsername('bob', 'Bob'), false);
    assert.equal(isSuspiciousUsername('JANE', 'JANE'), false); // not 10+ caps
  });

  it('does NOT flag a long full name with proper spacing and vowels', () => {
    assert.equal(
      isSuspiciousUsername('catherinesmith', 'Catherine Marie Smith Johnson'),
      false,
    );
  });
});

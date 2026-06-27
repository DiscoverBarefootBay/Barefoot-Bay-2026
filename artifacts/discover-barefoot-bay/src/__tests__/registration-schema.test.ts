import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { insertUserSchema, insertListingSchema } from '../../shared/schema';
import { zodV4Resolver } from '../lib/zod-v4-resolver';

/**
 * Regression guard for the dead-button registration bug.
 *
 * Registration broke in production because the shared zod v4 schema threw on
 * submit (a zod v3/v4 mismatch) before any request was sent — the button did
 * nothing and no error was shown. These tests exercise the real
 * `insertUserSchema`, `insertListingSchema`, and the `zodV4Resolver` path that
 * the auth and listing forms rely on, asserting that validation NEVER throws —
 * it must always return a result (success) or issues (failure).
 */

const validUser = {
  username: 'jane_doe',
  password: 'securepassword123',
  email: 'jane@example.com',
  fullName: 'Jane Doe',
  acceptedTerms: true,
};

const validListing = {
  listingType: 'Classified' as const,
  title: 'Comfy couch for sale',
  contactInfo: {
    name: 'Jane Doe',
    phone: '(555) 555-5555',
    email: 'jane@example.com',
  },
};

// react-hook-form resolver options stub (only the fields the resolver touches).
const resolverOptions = {
  fields: {},
  shouldUseNativeValidation: false,
} as never;

describe('insertUserSchema', () => {
  it('parses a valid registration payload without throwing', () => {
    const result = insertUserSchema.safeParse(validUser);
    assert.equal(result.success, true);
  });

  it('returns a phoneNumber issue for an invalid phone (no throw)', () => {
    const result = insertUserSchema.safeParse({
      ...validUser,
      phoneNumber: '12345',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      assert.ok(
        paths.includes('phoneNumber'),
        `expected a phoneNumber issue, got: ${paths.join(', ')}`,
      );
    }
  });

  it('returns issues for missing required fields (no throw)', () => {
    const result = insertUserSchema.safeParse({});
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
    }
  });
});

describe('insertListingSchema', () => {
  it('parses a valid listing payload without throwing', () => {
    const result = insertListingSchema.safeParse(validListing);
    assert.equal(result.success, true);
  });

  it('returns a contactInfo.phone issue for an invalid phone (no throw)', () => {
    const result = insertListingSchema.safeParse({
      ...validListing,
      contactInfo: { ...validListing.contactInfo, phone: 'not-a-phone' },
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      assert.ok(
        paths.includes('contactInfo.phone'),
        `expected a contactInfo.phone issue, got: ${paths.join(', ')}`,
      );
    }
  });

  it('returns issues for missing required fields (no throw)', () => {
    const result = insertListingSchema.safeParse({});
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
    }
  });
});

describe('zodV4Resolver (the path the forms actually use)', () => {
  it('resolves a valid user payload with no errors and parsed values', async () => {
    const resolve = zodV4Resolver(insertUserSchema);
    const { values, errors } = await resolve(validUser, undefined, resolverOptions);
    assert.deepEqual(errors, {});
    assert.equal((values as { username?: string }).username, 'jane_doe');
  });

  it('surfaces an invalid phone as a field error instead of throwing', async () => {
    const resolve = zodV4Resolver(insertUserSchema);
    const { errors } = await resolve(
      { ...validUser, phoneNumber: '12345' },
      undefined,
      resolverOptions,
    );
    assert.ok(
      'phoneNumber' in (errors as Record<string, unknown>),
      'expected a phoneNumber field error',
    );
  });

  it('surfaces missing required user fields as errors instead of throwing', async () => {
    const resolve = zodV4Resolver(insertUserSchema);
    const { values, errors } = await resolve({}, undefined, resolverOptions);
    assert.deepEqual(values, {});
    assert.ok(Object.keys(errors as Record<string, unknown>).length > 0);
  });

  it('surfaces an invalid listing phone as a nested field error instead of throwing', async () => {
    const resolve = zodV4Resolver(insertListingSchema);
    const { errors } = await resolve(
      {
        ...validListing,
        contactInfo: { ...validListing.contactInfo, phone: 'not-a-phone' },
      },
      undefined,
      resolverOptions,
    );
    const contactInfo = (errors as { contactInfo?: { phone?: unknown } }).contactInfo;
    assert.ok(contactInfo && contactInfo.phone, 'expected a contactInfo.phone field error');
  });
});

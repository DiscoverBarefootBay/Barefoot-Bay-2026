import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ObjectStorageService,
  ObjectStorageUploadError,
} from '../object-storage-service';

type UploadFromBytesResult = { ok: true } | { ok: false; error: { message: string } };

type ExistsResult =
  | { ok: true; value: boolean }
  | { ok: false; error: { message: string } };

type ExistsArgs = { key: string; bucket?: string };

function makeMockClient(opts: {
  upload?: () => Promise<UploadFromBytesResult>;
  exists?: (args: ExistsArgs) => Promise<ExistsResult>;
  existsCalls?: ExistsArgs[];
}) {
  const upload = opts.upload ?? (async () => ({ ok: true } as UploadFromBytesResult));
  const exists =
    opts.exists ?? (async () => ({ ok: true, value: true } as ExistsResult));
  return {
    uploadFromBytes: async () => upload(),
    uploadFromFilename: async () => upload(),
    exists: async (key: string, options?: { bucketName?: string }) => {
      const args = { key, bucket: options?.bucketName };
      opts.existsCalls?.push(args);
      return exists(args);
    },
  } as unknown as ConstructorParameters<typeof ObjectStorageService>[0];
}

describe('ObjectStorageService.uploadData', () => {
  it('throws ObjectStorageUploadError when given empty data', async () => {
    const svc = new ObjectStorageService(makeMockClient({}));
    await assert.rejects(
      () => svc.uploadData(Buffer.alloc(0), 'calendar', 'x.png', 'image/png'),
      (err: unknown) => {
        assert.ok(err instanceof ObjectStorageUploadError);
        assert.match((err as Error).message, /Empty buffer/);
        return true;
      },
    );
  });

  it('throws ObjectStorageUploadError when given null data', async () => {
    const svc = new ObjectStorageService(makeMockClient({}));
    await assert.rejects(
      // @ts-expect-error testing runtime null guard
      () => svc.uploadData(null, 'calendar', 'x.png', 'image/png'),
      (err: unknown) => {
        assert.ok(err instanceof ObjectStorageUploadError);
        assert.match((err as Error).message, /No data provided/);
        return true;
      },
    );
  });

  it('throws ObjectStorageUploadError when the storage client always fails', async () => {
    const svc = new ObjectStorageService(
      makeMockClient({
        upload: async () => ({
          ok: false,
          error: { message: 'simulated network error' },
        }),
      }),
    );
    await assert.rejects(
      () =>
        svc.uploadData(
          Buffer.from('hello'),
          'general',
          'x.png',
          'image/png',
        ),
      (err: unknown) => {
        assert.ok(err instanceof ObjectStorageUploadError);
        assert.match((err as Error).message, /simulated network error/);
        return true;
      },
    );
  });

  it('returns a real Object Storage URL on success — never a placeholder', async () => {
    const svc = new ObjectStorageService(makeMockClient({}));
    const url = await svc.uploadData(
      Buffer.from('hello'),
      'general',
      'happy.png',
      'image/png',
    );
    assert.ok(
      url.startsWith('https://object-storage.replit.app/'),
      `expected object storage URL, got ${url}`,
    );
    assert.doesNotMatch(url, /storage-proxy/);
    assert.doesNotMatch(url, /default-/);
  });

  it('passes the explicit bucket through to the existence probe (bucket-aware verification)', async () => {
    const existsCalls: ExistsArgs[] = [];
    const svc = new ObjectStorageService(
      makeMockClient({
        existsCalls,
        exists: async ({ bucket }) =>
          bucket === 'AVATARS'
            ? ({ ok: true, value: true } as ExistsResult)
            : ({ ok: true, value: false } as ExistsResult),
      }),
    );
    const url = await svc.uploadData(
      Buffer.from('avatar-bytes'),
      'avatar',
      'user-1.png',
      'image/png',
      'AVATARS',
    );
    assert.ok(url.startsWith('https://object-storage.replit.app/AVATARS/'));
    assert.equal(existsCalls.length, 1);
    assert.equal(existsCalls[0].bucket, 'AVATARS');
    assert.equal(existsCalls[0].key, 'avatar/user-1.png');
  });

  it('throws ObjectStorageUploadError when post-upload verification cannot find the object', async () => {
    const svc = new ObjectStorageService(
      makeMockClient({
        // upload reports success...
        upload: async () => ({ ok: true } as UploadFromBytesResult),
        // ...but the existence probe says the object isn't there.
        exists: async () => ({ ok: true, value: false } as ExistsResult),
      }),
    );
    await assert.rejects(
      () =>
        svc.uploadData(
          Buffer.from('hello'),
          'general',
          'ghost.png',
          'image/png',
        ),
      (err: unknown) => {
        assert.ok(err instanceof ObjectStorageUploadError);
        assert.match((err as Error).message, /post-upload verification/);
        return true;
      },
    );
  });
});

describe('ObjectStorageService.uploadFile', () => {
  it('throws ObjectStorageUploadError when the file is missing on disk', async () => {
    const svc = new ObjectStorageService(makeMockClient({}));
    const missing = path.join(os.tmpdir(), `does-not-exist-${Date.now()}.bin`);
    await assert.rejects(
      () => svc.uploadFile(missing, 'calendar'),
      (err: unknown) => {
        assert.ok(err instanceof ObjectStorageUploadError);
        return true;
      },
    );
  });

  it('throws ObjectStorageUploadError when the storage client always fails', async () => {
    const tmp = path.join(os.tmpdir(), `osvc-test-${Date.now()}.txt`);
    fs.writeFileSync(tmp, 'hello world');
    try {
      const svc = new ObjectStorageService(
        makeMockClient({
          upload: async () => ({
            ok: false,
            error: { message: 'boom' },
          }),
        }),
      );
      await assert.rejects(
        () => svc.uploadFile(tmp, 'general'),
        (err: unknown) => {
          assert.ok(err instanceof ObjectStorageUploadError);
          assert.match((err as Error).message, /boom|after multiple attempts/);
          return true;
        },
      );
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });
});

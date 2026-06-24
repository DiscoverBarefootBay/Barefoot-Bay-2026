import { Client } from '@replit/object-storage';

/**
 * Resolve the Object Storage bucket ID to bind the client to.
 *
 * The default `new Client()` constructor relies on a Replit sidecar
 * endpoint (`http://127.0.0.1:1106/object-storage/default-bucket`) to
 * discover the bucket. In some environments that endpoint returns
 * `{"bucketId":""}` which makes the underlying GCS client throw
 * `A bucket name is needed to use Cloud Storage` and every image
 * request 500s.
 *
 * To avoid that, prefer explicit env vars in this order:
 *   1. The bucket ID embedded in REPLIT_OBJECTSTORE_URL — this is the
 *      bucket the project has historically been writing to, so it's
 *      where existing images (avatars, banner slides, calendar media,
 *      etc.) live. Always prefer it when present.
 *   2. DEFAULT_OBJECT_STORAGE_BUCKET_ID — a fallback set by
 *      `setupObjectStorage()` for fresh provisions.
 *   3. undefined — let the SDK fall back to the sidecar (original behavior)
 */
export function getObjectStorageBucketId(): string | undefined {
  const url = process.env.REPLIT_OBJECTSTORE_URL;
  if (url) {
    const match = url.match(/\/buckets\/([^/?#]+)/);
    if (match && match[1]) return match[1];
  }

  const fromEnv = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  return undefined;
}

/**
 * Construct a Replit Object Storage client with an explicit bucket ID
 * resolved from the environment. Falls back to the SDK default if no
 * bucket ID can be resolved.
 */
export function createObjectStorageClient(): Client {
  const bucketId = getObjectStorageBucketId();
  return bucketId ? new Client({ bucketId }) : new Client();
}

import { BlobError, BlobPreconditionFailedError, get, put } from '@vercel/blob';
import { boundedText } from './http';
import { HistoryConflict, historySchema, type HistoryStore } from './history';

const PATHNAME = 'status-history/v1/production.json';

export function createBlobHistoryStore(storeId: string): HistoryStore {
  // ASVS 13.2.1, 13.3.2: private storage uses the deployment's short-lived OIDC credentials.
  // One deadline bounds all reads, conditional writes, and conflict retries for this check.
  const options = { storeId, access: 'private' as const, abortSignal: AbortSignal.timeout(4_000) };
  const store: HistoryStore = {
    async read(fresh = false) {
      const result = await get(PATHNAME, { ...options, useCache: !fresh });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.blob.etag)
        throw new Error('Invalid history response');
      const document = historySchema.parse(
        JSON.parse(await boundedText(new Response(result.stream)))
      );
      return { document, etag: result.blob.etag };
    },
    async write(document, etag) {
      try {
        await put(PATHNAME, JSON.stringify(document), {
          ...options,
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: !!etag,
          ifMatch: etag,
          // Cached reads reduce storage operations; conflicts always reload from the origin.
          cacheControlMaxAge: 300
        });
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) throw new HistoryConflict();
        // Creation races can return a generic BlobError. Confirm an existing object before retrying.
        if (!etag && error instanceof BlobError && (await store.read(true)))
          throw new HistoryConflict();
        throw error;
      }
    }
  };
  return store;
}

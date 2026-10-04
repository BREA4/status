import * as env from '$app/env/private';
import { collectSnapshot } from './collector';
import type { Snapshot } from '#lib/status.ts';
import { componentIds } from '#lib/catalog.ts';
import { recordHistory } from './history';
import { createBlobHistoryStore } from './history-store';

const CACHE_MS = 60_000;
let cached: { key: string; snapshot: Snapshot } | undefined;
const pending = new Map<string, Promise<Snapshot>>();

export async function getSnapshot(
  enabledServiceIds = componentIds,
  { fresh = false } = {}
): Promise<Snapshot> {
  const key = [...enabledServiceIds].sort().join(',');
  if (
    !fresh &&
    cached?.key === key &&
    Date.now() - Date.parse(cached.snapshot.generatedAt) < CACHE_MS
  )
    return cached.snapshot;
  // Coalesce simultaneous requests so background polls do not amplify probe traffic.
  let collection = pending.get(key);
  if (!collection) {
    collection = collectSnapshot(env, fetch, enabledServiceIds)
      .then((snapshot) =>
        recordHistory(
          snapshot,
          process.env.VERCEL_ENV === 'production' && process.env.HISTORY_STORE_ID
            ? createBlobHistoryStore(process.env.HISTORY_STORE_ID)
            : undefined
        )
      )
      .then((snapshot) => {
        cached = { key, snapshot };
        return snapshot;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, collection);
  }
  return collection;
}

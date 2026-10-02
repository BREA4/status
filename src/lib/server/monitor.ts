import * as env from '$app/env/private';
import { collectSnapshot } from './collector';
import type { Snapshot } from '#lib/status.ts';

const CACHE_MS = 60_000;
let cached: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;

export async function getSnapshot(): Promise<Snapshot> {
  if (cached && Date.now() - Date.parse(cached.generatedAt) < CACHE_MS) return cached;
  // Coalesce simultaneous requests so background polls do not amplify probe traffic.
  if (!pending)
    pending = collectSnapshot(env)
      .then((result) => (cached = result))
      .finally(() => {
        pending = undefined;
      });
  return pending;
}

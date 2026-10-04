import { createClient } from '@vercel/flags-core';
import { getVercelOidcToken } from '@vercel/oidc';
import { featureDefinitions, featuresFromValues, type Features } from '#lib/features.ts';

// ASVS 13.2.1, 13.3.2: use Vercel's request-scoped OIDC credentials only on the server.
const client = createClient(process.env.FLAGS || undefined, {
  buildStep: false,
  stream: false,
  polling: { intervalMs: 60_000, initTimeoutMs: 1_000 }
});

async function readVercelFlags(): Promise<Record<string, unknown>> {
  // The deployment token can be in the request context without any process.env token.
  if (!process.env.FLAGS) await getVercelOidcToken();
  const results = await client.bulkEvaluate<boolean>(featureDefinitions);
  return Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.value]));
}

export async function getFeatures(readFlags = readVercelFlags): Promise<Features> {
  try {
    return featuresFromValues(await readFlags());
  } catch {
    // ASVS 16.5.2: provider failures use documented defaults without exposing credentials.
    return featuresFromValues();
  }
}

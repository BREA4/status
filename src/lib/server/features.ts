import { createClient } from '@vercel/flags-core';
import { getVercelOidcToken } from '@vercel/oidc';

// ASVS 13.2.1, 13.3.2: use Vercel's request-scoped OIDC credentials only on the server.
const client = createClient(process.env.FLAGS || undefined, {
  buildStep: false,
  stream: false,
  polling: { intervalMs: 60_000, initTimeoutMs: 1_000 }
});

export async function contactSupportEnabled(): Promise<boolean> {
  try {
    // The deployment token can be in the request context without any process.env token.
    if (!process.env.FLAGS) await getVercelOidcToken();
    const result = await client.evaluate<boolean>('contact-support', false);
    // ASVS 2.2.1: only the boolean true enables the card.
    return result.value === true;
  } catch {
    // ASVS 16.5.2: an unavailable flag provider keeps support hidden and the page usable.
    return false;
  }
}

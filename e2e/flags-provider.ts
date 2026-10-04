import { mock } from 'bun:test';
import { publicResponse } from '../tests/update-fixture';

// Test-process mocks only. The application has no environment or browser flag overrides.
mock.module('@vercel/flags-core', () => ({
  createClient: () => ({
    bulkEvaluate: async (definitions: { key: string }[]) =>
      Object.fromEntries(
        definitions.map(({ key }) => [
          key,
          {
            value: key === 'service-update-server' || key === 'service-amsterdam-reality'
          }
        ])
      )
  })
}));
mock.module('@vercel/oidc', () => ({ getVercelOidcToken: async () => 'test-token' }));
globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit) =>
  Promise.resolve(publicResponse(String(input), init))) as typeof fetch;

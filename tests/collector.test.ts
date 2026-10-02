import { expect, test } from 'bun:test';
import { collectSnapshot } from '../src/lib/server/collector';

const mockRequest = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): typeof fetch =>
  ((input: URL | RequestInfo, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
const html = () =>
  new Response('<html>Breach <input type="password"></html>', {
    headers: { 'Content-Type': 'text/html' }
  });

test('only public HTTP targets become operational without a feed', async () => {
  const result = await collectSnapshot(
    {},
    mockRequest(() => html())
  );
  expect(
    result.components.filter((component) => component.status === 'operational').map(({ id }) => id)
  ).toEqual(['website', 'login']);
  expect(result.components.filter((component) => component.status === 'unknown')).toHaveLength(12);
  expect(result.components.every((component) => component.history.length === 0)).toBe(true);
  expect(result.feed).toBe('unconfigured');
});
test('500 means outage while a challenge page is unverified', async () => {
  const result = await collectSnapshot(
    {},
    mockRequest((url) => new Response('', { status: url.endsWith('/password') ? 403 : 503 }))
  );
  expect(result.components[0].status).toBe('outage');
  expect(result.components[1].status).toBe('unknown');
});
test('wrong content and oversized responses cannot pass checks', async () => {
  const result = await collectSnapshot(
    {},
    mockRequest(
      (url) =>
        new Response(
          url.endsWith('/password')
            ? 'Breach password' + 'x'.repeat(512_000)
            : 'A different website'
        )
    )
  );
  expect(result.components.slice(0, 2).every(({ status }) => status === 'unknown')).toBe(true);
});
test('a valid feed supplies protocol status without exposing extra fields or credentials', async () => {
  const now = new Date().toISOString();
  const result = await collectSnapshot(
    { STATUS_FEED_URL: 'https://monitor.example/status.json', STATUS_FEED_TOKEN: 'test-secret' },
    mockRequest((url, init) => {
      expect(init?.redirect).toBe('error');
      if (!url.startsWith('https://monitor.example/')) return html();
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-secret');
      return Response.json({
        version: 1,
        generatedAt: now,
        secret: 'private',
        components: [
          {
            id: 'amsterdam-reality',
            status: 'operational',
            checkedAt: now,
            internalAddress: 'private'
          }
        ],
        incidents: []
      });
    })
  );
  expect(result.feed).toBe('connected');
  expect(result.components.find(({ id }) => id === 'amsterdam-reality')?.status).toBe(
    'operational'
  );
  expect(JSON.stringify(result)).not.toMatch(/private|test-secret|internalAddress/);
});
test('a stale feed cannot overwrite a current check or validate a protocol', async () => {
  const old = new Date(Date.now() - 600_000).toISOString();
  const result = await collectSnapshot(
    { STATUS_FEED_URL: 'https://monitor.example/status.json' },
    mockRequest((url) =>
      url.startsWith('https://monitor.example/')
        ? Response.json({
            version: 1,
            generatedAt: old,
            components: [
              { id: 'website', status: 'outage', checkedAt: old },
              { id: 'riga-tuic', status: 'operational', checkedAt: old }
            ]
          })
        : html()
    )
  );
  expect(result.feed).toBe('unavailable');
  expect(result.components[0].status).toBe('operational');
  expect(result.components.find(({ id }) => id === 'riga-tuic')?.status).toBe('unknown');
});
test('failed or invalid feeds leave HTTP monitoring working', async () => {
  for (const payload of [{}, { version: 1, components: [] }]) {
    const result = await collectSnapshot(
      { STATUS_FEED_URL: 'https://monitor.example/status.json' },
      mockRequest((url) =>
        url.startsWith('https://monitor.example/') ? Response.json(payload) : html()
      )
    );
    expect(result.feed).toBe('unavailable');
    expect(result.components[0].status).toBe('operational');
  }
});
test('rejects insecure operator URLs without making a feed request', async () => {
  let calls = 0;
  const result = await collectSnapshot(
    { STATUS_FEED_URL: 'http://monitor.example/status.json' },
    mockRequest(() => {
      calls++;
      return html();
    })
  );
  expect(calls).toBe(2);
  expect(result.feed).toBe('unavailable');
});

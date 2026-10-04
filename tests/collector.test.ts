import { expect, test } from 'bun:test';
import { collectSnapshot } from '../src/lib/server/collector';
import { appcast, archiveUrl, publicResponse } from './update-fixture';
import { componentIds } from '../src/lib/catalog';

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
  const result = await collectSnapshot({}, mockRequest(publicResponse));
  expect(
    result.components.filter((component) => component.status === 'operational').map(({ id }) => id)
  ).toEqual(['website', 'login', 'update-server', 'control-api', 'profile-delivery']);
  expect(result.components.filter((component) => component.status === 'unknown')).toHaveLength(10);
  expect(result.components.every((component) => component.history.length === 0)).toBe(true);
  expect(result.feed).toBe('unconfigured');
});

test('profile delivery uses the deployed Go readiness contract, not an HTTP success alone', async () => {
  for (const [response, status] of [
    [Response.json({ status: 'ready' }), 'operational'],
    [Response.json({ status: 'not_ready' }, { status: 503 }), 'outage'],
    [Response.json({ status: 'not_ready' }), 'unknown'],
    [new Response('<html>ready</html>'), 'unknown'],
    [Response.json({ status: 'ready' }, { status: 403 }), 'unknown'],
    [Response.json({ status: 'ready' }, { status: 429 }), 'unknown']
  ] as const) {
    let calls = 0;
    const result = await collectSnapshot(
      {},
      mockRequest((url, init) => {
        calls++;
        expect(url).toBe('https://sync.fatconfig.space/readyz');
        expect(init?.redirect).toBe('error');
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        return response;
      }),
      ['profile-delivery']
    );
    expect(calls).toBe(1);
    expect(result.components[0].status).toBe(status);
    expect(result.components[0].source).toBe('http');
    expect(result.components[0].checkedAt).not.toBeNull();
  }
});

test('control API checks the live web gateway and Go public capabilities contract', async () => {
  for (const [payload, expected] of [
    [
      { registration_enabled: true, passkey_login: true, passkey_registration: true },
      'operational'
    ],
    [
      { registration_enabled: false, passkey_login: false, passkey_registration: false },
      'operational'
    ],
    [{ status: 'ok' }, 'unknown'],
    [{ registration_enabled: 'true', passkey_login: true, passkey_registration: true }, 'unknown']
  ] as const) {
    let calls = 0;
    const result = await collectSnapshot(
      {},
      mockRequest((url, init) => {
        calls++;
        expect(url).toBe('https://brea4.space/api/v1/public/capabilities');
        expect(init?.redirect).toBe('error');
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        return Response.json(payload);
      }),
      ['control-api']
    );
    expect(calls).toBe(1);
    expect(result.components[0].status).toBe(expected);
    expect(result.components[0].source).toBe('http');
  }
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
  expect(calls).toBe(5);
  expect(result.feed).toBe('unavailable');
});

test('disabled services are neither probed nor included in observations or incidents', async () => {
  const now = new Date().toISOString();
  const calls: string[] = [];
  const result = await collectSnapshot(
    { STATUS_FEED_URL: 'https://monitor.example/status.json' },
    mockRequest((url) => {
      calls.push(url);
      expect(url).not.toContain('brea4.space');
      expect(url).not.toContain('breach-updates.vercel.app');
      return Response.json({
        version: 1,
        generatedAt: now,
        components: [
          { id: 'website', status: 'outage', checkedAt: now },
          { id: 'riga-tuic', status: 'operational', checkedAt: now }
        ],
        incidents: ['hidden', 'mixed'].map((id) => ({
          id,
          title: { en: id, ru: id },
          status: 'investigating',
          impact: 'outage',
          startedAt: now,
          updatedAt: now,
          components: id === 'hidden' ? ['website'] : ['website', 'riga-tuic'],
          updates: []
        }))
      });
    }),
    ['riga-tuic']
  );
  expect(calls).toHaveLength(1);
  expect(result.components.map(({ id }) => id)).toEqual(['riga-tuic']);
  expect(result.components[0].status).toBe('operational');
  expect(result.incidents.map(({ id, components }) => ({ id, components }))).toEqual([
    { id: 'mixed', components: ['riga-tuic'] }
  ]);
});

test('disabling every service makes no upstream requests and returns no incidents', async () => {
  const result = await collectSnapshot(
    { STATUS_FEED_URL: 'https://monitor.example/status.json' },
    mockRequest(() => {
      throw new Error('No requests expected');
    }),
    []
  );
  expect(result.components).toEqual([]);
  expect(result.incidents).toEqual([]);
});

test('update monitoring checks the appcast and archive headers without downloading archives', async () => {
  const calls: { url: string; method: string }[] = [];
  const result = await collectSnapshot(
    {},
    mockRequest((url, init) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
      return publicResponse(url, init);
    }),
    ['update-server']
  );
  expect(calls).toEqual([
    { url: 'https://breach-updates.vercel.app/appcast.xml', method: 'GET' },
    { url: archiveUrl, method: 'HEAD' }
  ]);
  expect(result.components[0].status).toBe('operational');
  expect(result.components[0].history).toEqual([]);
});

test('update monitoring reports missing releases as outages and blocked downloads as unknown', async () => {
  for (const [code, expected] of [
    [404, 'outage'],
    [503, 'outage'],
    [403, 'unknown'],
    [429, 'unknown']
  ] as const) {
    for (const failingUrl of ['https://breach-updates.vercel.app/appcast.xml', archiveUrl]) {
      const result = await collectSnapshot(
        {},
        mockRequest((url, init) =>
          url === failingUrl ? new Response(null, { status: code }) : publicResponse(url, init)
        ),
        ['update-server']
      );
      expect(result.components[0].status).toBe(expected);
    }
  }
});

test('both published release channels must have matching archive sizes', async () => {
  const stableUrl = archiveUrl.replace('beta', 'stable');
  const result = await collectSnapshot(
    {},
    mockRequest((url) => {
      if (url.endsWith('appcast.xml')) return new Response(appcast(archiveUrl, stableUrl));
      return new Response(null, {
        headers: { 'content-length': url === stableUrl ? '1' : '12345' }
      });
    }),
    ['update-server']
  );
  expect(result.components[0].status).toBe('unknown');
});

test('an archive outage remains visible when the other channel times out', async () => {
  const stableUrl = archiveUrl.replace('beta', 'stable');
  const result = await collectSnapshot(
    {},
    mockRequest((url) => {
      if (url.endsWith('appcast.xml')) return new Response(appcast(archiveUrl, stableUrl));
      if (url === archiveUrl) throw new Error('Timeout');
      return new Response(null, { status: 503 });
    }),
    ['update-server']
  );
  expect(result.components[0].status).toBe('outage');
});

test('malformed or unsafe appcasts never cause archive requests', async () => {
  const invalid = [
    '<html>Breach updates</html>',
    appcast().replace('</rss>', ''),
    '<!DOCTYPE rss [<!ENTITY file SYSTEM "file:///etc/passwd">]>' + appcast(),
    appcast('https://attacker.example/releases/Breach-0.1-beta-3-arm64.zip'),
    appcast(archiveUrl.replace('https:', 'http:')),
    appcast(archiveUrl + '?secret=token'),
    appcast('https://user:secret@breach-updates.vercel.app/releases/Breach-0.1-beta-3-arm64.zip'),
    appcast().replace('sparkle:edSignature', 'unsigned'),
    appcast().replace('length="12345"', 'length="0"'),
    appcast().replace(
      'http://www.andymatuschak.org/xml-namespaces/sparkle',
      'https://attacker.example'
    ),
    appcast() + 'x'.repeat(512_000)
  ];
  for (const xml of invalid) {
    let calls = 0;
    const result = await collectSnapshot(
      {},
      mockRequest(() => {
        calls++;
        return new Response(xml);
      }),
      ['update-server']
    );
    expect(calls).toBe(1);
    expect(result.components[0].status).toBe('unknown');
  }
  expect(componentIds).toContain('update-server');
});

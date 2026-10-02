import assert from 'node:assert/strict';

// Exercise the packaged serverless entry, not Vite's preview module loader.
const { default: handler } =
  await import('../.vercel/output/functions/index.func/.svelte-kit/vercel-tmp/index.js');
for (const locale of ['en', 'ru']) {
  const response = await handler.fetch(
    new Request('https://status.example/', {
      headers: { 'accept-language': locale, 'x-forwarded-for': '127.0.0.1' }
    })
  );
  assert.equal(response.status, 200, `Packaged SSR must render ${locale}`);
  const html = await response.text();
  assert.ok(html.includes(`lang="${locale}"`));
  assert.ok(html.includes('id="status-heading"'));
  console.log(`Packaged Vercel SSR: ${locale} passed`);
}

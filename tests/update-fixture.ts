export const feedUrl = 'https://brea4.github.io/apple-app-update-server/appcast.xml';
export const archiveUrl =
  'https://github.com/BREA4/apple-app-update-server/releases/download/0.2.1-beta-build-6/Breach-0.2.1-build-6-arm64.zip';
export const stableArchiveUrl = archiveUrl
  .replace('beta-build-6', 'release-build-5')
  .replace('Breach-0.2.1-build-6', 'Breach-0.2.1-build-5');

export function appcast(...urls: string[]) {
  return `<?xml version="1.0"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Breach updates</title>${(urls.length
    ? urls
    : [archiveUrl]
  )
    .map((url) => {
      const identity = /\/(\d+\.\d+(?:\.\d+)?)-(beta|release)-build-(\d+)\//.exec(url);
      return `<item><sparkle:version>${identity?.[3] ?? '6'}</sparkle:version>${identity?.[2] === 'release' ? '' : '<sparkle:channel>beta</sparkle:channel>'}<enclosure url="${url}" length="12345" sparkle:edSignature="${'A'.repeat(86)}==" /></item>`;
    })
    .join('')}</channel></rss>`;
}

export function publicResponse(url: string, init?: RequestInit): Response {
  if (url === 'https://brea4.space/api/v1/public/capabilities')
    return Response.json({
      registration_enabled: true,
      passkey_login: true,
      passkey_registration: true
    });
  if (url === 'https://sync.fatconfig.space/readyz') return Response.json({ status: 'ready' });
  if (url.endsWith('/appcast.xml'))
    return new Response(appcast(), { headers: { 'content-type': 'application/rss+xml' } });
  if (init?.method === 'HEAD')
    return new Response(null, { headers: { 'content-length': '12345' } });
  return new Response('<html>Breach <input type="password"></html>', {
    headers: { 'content-type': 'text/html' }
  });
}

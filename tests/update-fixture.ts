export const archiveUrl = 'https://breach-updates.vercel.app/releases/Breach-0.1-beta-3-arm64.zip';

export function appcast(...urls: string[]) {
  return `<?xml version="1.0"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Breach updates</title>${(urls.length
    ? urls
    : [archiveUrl]
  )
    .map(
      (url) =>
        `<item><sparkle:version>3</sparkle:version><enclosure url="${url}" length="12345" sparkle:edSignature="${'A'.repeat(86)}==" /></item>`
    )
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

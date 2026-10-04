import { SaxesParser, type SaxesTagNS } from 'saxes';
import type { Status } from '#lib/status.ts';
import { boundedText } from './http';

const origin = 'https://breach-updates.vercel.app';
const sparkleNamespace = 'http://www.andymatuschak.org/xml-namespaces/sparkle';
interface Release {
  url: string;
  length: number;
}

function releasesFromAppcast(xml: string): Release[] {
  const releases: Release[] = [];
  const path: string[] = [];
  let enclosure: Release | undefined;
  const parser = new SaxesParser({ xmlns: true });
  // ASVS 1.5.1: reject DTDs; this parser never fetches or expands external entities.
  parser.on('doctype', () => {
    throw new Error('DTD not allowed');
  });
  parser.on('opentag', (tag: SaxesTagNS) => {
    const attribute = (name: string, uri = '') =>
      Object.values(tag.attributes).find((attr) => attr.local === name && attr.uri === uri)?.value;
    if (path.length === 0 && (tag.local !== 'rss' || tag.uri || attribute('version') !== '2.0'))
      throw new Error('Not an RSS appcast');
    path.push(tag.uri ? `{${tag.uri}}${tag.local}` : tag.local);
    if (path.join('/') === 'rss/channel/item') enclosure = undefined;
    if (path.join('/') !== 'rss/channel/item/enclosure') return;
    if (enclosure) throw new Error('Duplicate enclosure');
    const url = attribute('url') ?? '';
    const length = Number(attribute('length'));
    const signature = attribute('edSignature', sparkleNamespace) ?? '';
    // ASVS 13.2.4, 2.2.1: feed content can select only this publisher's archive paths.
    const parsed = new URL(url);
    if (
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !/^\/releases\/Breach-\d+\.\d+(?:\.\d+)?-(stable|beta)-\d+-arm64\.zip$/.test(
        parsed.pathname
      ) ||
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signature)
    )
      throw new Error('Invalid release enclosure');
    enclosure = { url: parsed.href, length };
  });
  parser.on('closetag', () => {
    if (path.join('/') === 'rss/channel/item') {
      if (!enclosure || releases.length >= 2) throw new Error('Invalid release list');
      releases.push(enclosure);
    }
    path.pop();
  });
  parser.write(xml).close();
  if (releases.length === 0 || new Set(releases.map(({ url }) => url)).size !== releases.length)
    throw new Error('Missing or duplicate releases');
  return releases;
}

export async function checkUpdateServer(request: typeof fetch): Promise<Status> {
  // ASVS 12.3.1, 13.2.6: HTTPS only, with a single deadline for the feed and archives.
  const signal = AbortSignal.timeout(8_000);
  const options: RequestInit = {
    redirect: 'error',
    signal,
    cache: 'no-store',
    headers: { 'User-Agent': 'Breach-Status/1.0', Accept: 'application/rss+xml, application/xml' }
  };
  const response = await request(`${origin}/appcast.xml`, options);
  if (!response.ok) {
    await response.body?.cancel();
    return response.status === 403 || response.status === 429 ? 'unknown' : 'outage';
  }
  const releases = releasesFromAppcast(await boundedText(response));
  // HEAD checks every published channel without transferring the ZIP archives.
  const statuses = await Promise.all(
    releases.map(async (release): Promise<Status> => {
      try {
        const download = await request(release.url, {
          ...options,
          method: 'HEAD',
          headers: { 'User-Agent': 'Breach-Status/1.0', Accept: 'application/octet-stream' }
        });
        await download.body?.cancel();
        if (download.status === 403 || download.status === 429) return 'unknown';
        if (!download.ok) return 'outage';
        return Number(download.headers.get('content-length')) === release.length
          ? 'operational'
          : 'unknown';
      } catch {
        // Preserve an observed outage on one channel even if the other request fails.
        return 'unknown';
      }
    })
  );
  return statuses.includes('outage')
    ? 'outage'
    : statuses.includes('unknown')
      ? 'unknown'
      : 'operational';
}

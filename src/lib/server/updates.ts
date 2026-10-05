import { SaxesParser, type SaxesTagNS } from 'saxes';
import type { Status } from '#lib/status.ts';
import { boundedText } from './http';

export const updateFeedUrl = 'https://brea4.github.io/apple-app-update-server/appcast.xml';
const sparkleNamespace = 'http://www.andymatuschak.org/xml-namespaces/sparkle';
interface Release {
  url: string;
  length: number;
  build: number;
  channel: 'stable' | 'beta';
}

function releasesFromAppcast(xml: string): Release[] {
  const releases: Release[] = [];
  const path: string[] = [];
  let enclosure: Release | undefined;
  let version = '';
  let channel = '';
  let hasVersion = false;
  let hasChannel = false;
  const versionPath = `rss/channel/item/{${sparkleNamespace}}version`;
  const channelPath = `rss/channel/item/{${sparkleNamespace}}channel`;
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
    if (path.join('/') === 'rss/channel/item') {
      enclosure = undefined;
      version = channel = '';
      hasVersion = hasChannel = false;
    }
    if (path.join('/') === versionPath) {
      if (hasVersion) throw new Error('Duplicate build');
      hasVersion = true;
    }
    if (path.join('/') === channelPath) {
      if (hasChannel) throw new Error('Duplicate channel');
      hasChannel = true;
    }
    if (path.join('/') !== 'rss/channel/item/enclosure') return;
    if (enclosure) throw new Error('Duplicate enclosure');
    const url = attribute('url') ?? '';
    const length = Number(attribute('length'));
    const signature = attribute('edSignature', sparkleNamespace) ?? '';
    // ASVS 13.2.4, 2.2.1: feed content can select only this publisher's archive paths.
    const parsed = new URL(url);
    const identity =
      /^\/BREA4\/apple-app-update-server\/releases\/download\/(\d+\.\d+(?:\.\d+)?)-(beta|release)-build-([1-9]\d*)\/Breach-\1-build-\3-arm64\.zip$/.exec(
        parsed.pathname
      );
    const build = Number(identity?.[3]);
    if (
      parsed.origin !== 'https://github.com' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !identity ||
      !Number.isSafeInteger(build) ||
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signature)
    )
      throw new Error('Invalid release enclosure');
    enclosure = {
      url: parsed.href,
      length,
      build,
      channel: identity[2] === 'beta' ? 'beta' : 'stable'
    };
  });
  parser.on('text', (text) => {
    if (path.join('/') === versionPath) version += text;
    if (path.join('/') === channelPath) channel += text;
  });
  parser.on('closetag', () => {
    if (path.join('/') === 'rss/channel/item') {
      // The publisher retains 100 recent builds and, if needed, one older stable build.
      if (
        !enclosure ||
        releases.length >= 101 ||
        version.trim() !== String(enclosure.build) ||
        (enclosure.channel === 'beta' ? channel.trim() !== 'beta' : hasChannel)
      )
        throw new Error('Invalid release list');
      releases.push(enclosure);
    }
    path.pop();
  });
  parser.write(xml).close();
  if (releases.length === 0 || new Set(releases.map(({ url }) => url)).size !== releases.length)
    throw new Error('Missing or duplicate releases');
  const latest = new Map<Release['channel'], Release>();
  for (const release of releases) {
    if (release.build > (latest.get(release.channel)?.build ?? 0))
      latest.set(release.channel, release);
  }
  return [...latest.values()];
}

async function archiveHeaders(
  url: string,
  options: RequestInit,
  request: typeof fetch
): Promise<Response> {
  // ASVS 15.3.2, 13.2.4: manually follow only GitHub's HTTPS release-asset redirects.
  for (let redirects = 0; redirects <= 2; redirects++) {
    const response = await request(url, { ...options, method: 'HEAD', redirect: 'manual' });
    await response.body?.cancel();
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || location.length > 8192 || redirects === 2)
      throw new Error('Invalid asset redirect');
    const next = new URL(location, url);
    if (
      next.protocol !== 'https:' ||
      !['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(
        next.host
      ) ||
      next.username ||
      next.password ||
      next.hash
    )
      throw new Error('Unexpected asset host');
    url = next.href;
  }
  throw new Error('Too many asset redirects');
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
  const response = await request(updateFeedUrl, options);
  if (!response.ok) {
    await response.body?.cancel();
    return response.status === 403 || response.status === 429 ? 'unknown' : 'outage';
  }
  // ASVS 2.2.1: allow the publisher's 900 KB feed budget plus Sparkle's signing comments.
  const releases = releasesFromAppcast(await boundedText(response, 1_000_000));
  // HEAD checks the newest build in each channel without transferring ZIP archives.
  const statuses = await Promise.all(
    releases.map(async (release): Promise<Status> => {
      try {
        const download = await archiveHeaders(
          release.url,
          {
            ...options,
            headers: { 'User-Agent': 'Breach-Status/1.0', Accept: 'application/octet-stream' }
          },
          request
        );
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

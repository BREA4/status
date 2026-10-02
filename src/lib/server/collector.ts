import {
  emptySnapshot,
  feedSchema,
  isFresh,
  type ComponentStatus,
  type Snapshot
} from '#lib/status.ts';
import incidentData from '../../data/incidents.json';
import { incidentSchema } from '#lib/status.ts';

const targets = [
  { id: 'website', url: 'https://brea4.space/', marker: 'Breach' },
  { id: 'login', url: 'https://brea4.space/login/password', marker: 'password' }
];

async function boundedText(response: Response, maxBytes = 512_000): Promise<string> {
  // ASVS 2.2.1: enforce response limits while streaming, not after allocating the body.
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Response limit exceeded');
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    await reader.cancel();
  }
}

async function probe(
  target: (typeof targets)[number],
  request: typeof fetch
): Promise<ComponentStatus> {
  const start = performance.now();
  const base: ComponentStatus = {
    id: target.id,
    status: 'unknown',
    checkedAt: new Date().toISOString(),
    latency: null,
    source: 'http',
    history: []
  };
  try {
    // ASVS 1.2.2: fixed, HTTPS targets; redirects cannot send probes elsewhere.
    const response = await request(target.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'Breach-Status/1.0', Accept: 'text/html' },
      cache: 'no-store'
    });
    base.latency = Math.round(performance.now() - start);
    if (response.status === 429 || response.status === 403) {
      await response.body?.cancel();
      return base;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { ...base, status: 'outage' };
    }
    const body = await boundedText(response);
    return {
      ...base,
      status: body.toLowerCase().includes(target.marker.toLowerCase())
        ? base.latency > 3000
          ? 'degraded'
          : 'operational'
        : 'unknown'
    };
  } catch {
    // ASVS 16.5.1: expose no upstream body, exception, address, or credential.
    return { ...base, status: 'unknown' };
  }
}

export interface MonitorConfig {
  STATUS_FEED_URL?: string;
  STATUS_FEED_TOKEN?: string;
}
export async function collectSnapshot(
  env: MonitorConfig = {},
  request: typeof fetch = fetch
): Promise<Snapshot> {
  const snapshot = emptySnapshot();
  const observations = await Promise.all(targets.map((target) => probe(target, request)));
  for (const observation of observations)
    snapshot.components[snapshot.components.findIndex(({ id }) => id === observation.id)] =
      observation;
  const localIncidents = incidentSchema.array().parse(incidentData);
  snapshot.incidents = localIncidents;
  if (env.STATUS_FEED_URL) {
    try {
      // The URL is operator configuration, never a request parameter. Only HTTPS,
      // no credentials in URLs, no redirects, bounded fetch and strict schema.
      const url = new URL(env.STATUS_FEED_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash)
        throw new Error('Invalid feed URL');
      const response = await request(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(env.STATUS_FEED_TOKEN ? { Authorization: `Bearer ${env.STATUS_FEED_TOKEN}` } : {})
        }
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Feed unavailable');
      }
      // ASVS 2.2.1, 2.2.2: validate on the server and strip fields outside the public contract.
      const feed = feedSchema.parse(JSON.parse(await boundedText(response)));
      const feedFresh = isFresh(feed.generatedAt);
      snapshot.feed = feedFresh ? 'connected' : 'unavailable';
      for (const component of feed.components) {
        const current = snapshot.components.find((item) => item.id === component.id)!;
        current.history = component.history.filter(
          (day) => day.date <= new Date().toISOString().slice(0, 10)
        );
        // An old feed never overwrites a current website probe with a stale status.
        if (feedFresh && isFresh(component.checkedAt))
          Object.assign(current, {
            status: component.status,
            checkedAt: component.checkedAt,
            source: 'feed',
            latency: null
          });
      }
      snapshot.incidents = [
        ...new Map(
          [...localIncidents, ...feed.incidents].map((incident) => [incident.id, incident])
        ).values()
      ];
    } catch {
      snapshot.feed = 'unavailable';
    }
  }
  snapshot.incidents.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  snapshot.generatedAt = new Date().toISOString();
  return snapshot;
}

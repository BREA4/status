import {
  emptySnapshot,
  feedSchema,
  isFresh,
  type ComponentStatus,
  type Snapshot
} from '#lib/status.ts';
import incidentData from '../../data/incidents.json';
import { incidentSchema } from '#lib/status.ts';
import { componentIds } from '#lib/catalog.ts';
import { boundedText } from './http';
import { checkUpdateServer } from './updates';
import { z } from 'zod';

const readinessSchema = z.object({ status: z.literal('ready') });
const capabilitiesSchema = z.object({
  registration_enabled: z.boolean(),
  passkey_login: z.boolean(),
  passkey_registration: z.boolean()
});

const targets = [
  { id: 'website', url: 'https://brea4.space/', marker: 'Breach' },
  { id: 'login', url: 'https://brea4.space/login/password', marker: 'password' },
  { id: 'update-server', url: 'https://breach-updates.vercel.app/appcast.xml', marker: '' },
  { id: 'control-api', url: 'https://brea4.space/api/v1/public/capabilities', marker: '' },
  { id: 'profile-delivery', url: 'https://sync.fatconfig.space/readyz', marker: '' }
];

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
    if (target.id === 'update-server') {
      const status = await checkUpdateServer(request);
      base.latency = Math.round(performance.now() - start);
      return {
        ...base,
        status: status === 'operational' && base.latency > 3000 ? 'degraded' : status
      };
    }
    // ASVS 1.2.2: fixed, HTTPS targets; redirects cannot send probes elsewhere.
    const response = await request(target.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'User-Agent': 'Breach-Status/1.0',
        Accept: ['profile-delivery', 'control-api'].includes(target.id)
          ? 'application/json'
          : 'text/html'
      },
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
    if (target.id === 'profile-delivery' || target.id === 'control-api') {
      // ASVS 13.2.4, 2.2.1: fixed public endpoints and validated deployed Go contracts.
      // BREA4/vpn-backend PR #2, httpapi/server.go and httpapi/account_registration.go.
      const isJson =
        response.headers.get('content-type')?.split(';')[0].trim() === 'application/json';
      const schema = target.id === 'profile-delivery' ? readinessSchema : capabilitiesSchema;
      const ready = isJson && schema.safeParse(JSON.parse(body)).success;
      return {
        ...base,
        status: ready ? (base.latency > 3000 ? 'degraded' : 'operational') : 'unknown'
      };
    }
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
  request: typeof fetch = fetch,
  enabledServiceIds: string[] = componentIds
): Promise<Snapshot> {
  const snapshot = emptySnapshot();
  const enabled = new Set(enabledServiceIds);
  snapshot.components = snapshot.components.filter(({ id }) => enabled.has(id));
  const observations = await Promise.all(
    targets.filter(({ id }) => enabled.has(id)).map((target) => probe(target, request))
  );
  for (const observation of observations)
    snapshot.components[snapshot.components.findIndex(({ id }) => id === observation.id)] =
      observation;
  const localIncidents = incidentSchema.array().parse(incidentData);
  snapshot.incidents = localIncidents;
  if (env.STATUS_FEED_URL && snapshot.components.length > 0) {
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
        const current = snapshot.components.find((item) => item.id === component.id);
        if (!current) continue;
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
  snapshot.incidents = snapshot.incidents.flatMap((incident) => {
    if (snapshot.components.length === 0) return [];
    if (incident.components.length === 0) return [incident];
    const components = incident.components.filter((id) => enabled.has(id));
    return components.length ? [{ ...incident, components }] : [];
  });
  snapshot.incidents.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  snapshot.generatedAt = new Date().toISOString();
  return snapshot;
}

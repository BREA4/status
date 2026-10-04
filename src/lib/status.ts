import { z } from 'zod';
import { componentIds } from './catalog';

export const FRESHNESS_MS = 5 * 60 * 1000;
export const statusSchema = z.enum([
  'operational',
  'degraded',
  'partial_outage',
  'outage',
  'maintenance',
  'unknown'
]);
export type Status = z.infer<typeof statusSchema>;
export type SummaryStatus = Status | 'incomplete';
const localized = z.object({ en: z.string().min(1).max(2000), ru: z.string().min(1).max(2000) });
const timestamp = z.iso.datetime({ offset: true });
export const dailySchema = z.object({
  date: z.iso.date(),
  status: statusSchema,
  uptime: z.number().min(0).max(100).nullable()
});
export const incidentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  title: localized,
  status: z.enum([
    'investigating',
    'identified',
    'monitoring',
    'resolved',
    'scheduled',
    'maintenance'
  ]),
  impact: statusSchema,
  startedAt: timestamp,
  updatedAt: timestamp,
  components: z.array(z.string().refine((id) => componentIds.includes(id))).max(50),
  updates: z.array(z.object({ at: timestamp, message: localized })).max(100)
});
export type Incident = z.infer<typeof incidentSchema>;
export type Daily = z.infer<typeof dailySchema>;
export const feedSchema = z.object({
  version: z.literal(1),
  generatedAt: timestamp,
  components: z
    .array(
      z.object({
        id: z.string().refine((id) => componentIds.includes(id)),
        status: statusSchema,
        checkedAt: timestamp,
        history: z
          .array(dailySchema)
          .max(90)
          .default([])
          .refine(
            (days) => new Set(days.map((day) => day.date)).size === days.length,
            'Duplicate history day'
          )
      })
    )
    .max(100)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      'Duplicate component'
    ),
  incidents: z.array(incidentSchema).max(100).default([])
});
export interface ComponentStatus {
  id: string;
  status: Status;
  checkedAt: string | null;
  latency: number | null;
  source: 'http' | 'feed' | 'none';
  history: Daily[];
}
export interface Snapshot {
  generatedAt: string;
  historyRecording?: 'recorded' | 'unconfigured' | 'unavailable';
  components: ComponentStatus[];
  incidents: Incident[];
  feed: 'connected' | 'unconfigured' | 'unavailable';
}

export function isFresh(checkedAt: string | null, now = Date.now()): boolean {
  if (!checkedAt) return false;
  const age = now - Date.parse(checkedAt);
  return Number.isFinite(age) && age >= -60_000 && age <= FRESHNESS_MS;
}
export function currentStatus(
  component: ComponentStatus,
  now = Date.now(),
  incidents: Incident[] = []
): Status {
  const observations: Status[] = [isFresh(component.checkedAt, now) ? component.status : 'unknown'];
  for (const incident of incidents) {
    if (
      incident.components.includes(component.id) &&
      !['resolved', 'scheduled'].includes(incident.status) &&
      Date.parse(incident.startedAt) <= now
    )
      observations.push(incident.impact);
  }
  return aggregate(observations);
}
export function aggregate(statuses: Status[]): Status {
  for (const status of [
    'outage',
    'partial_outage',
    'degraded',
    'maintenance',
    'unknown'
  ] as const) {
    if (statuses.includes(status)) return status;
  }
  return statuses.length ? 'operational' : 'unknown';
}
export function summarize(statuses: Status[]): SummaryStatus {
  const status = aggregate(statuses);
  return status === 'unknown' && statuses.some((status) => status !== 'unknown')
    ? 'incomplete'
    : status;
}
export function dailyHistory(history: Daily[], now = Date.now()): Daily[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const midnight = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 90 }, (_, i) => {
    const date = new Date(midnight - (89 - i) * 86_400_000).toISOString().slice(0, 10);
    return history.find((day) => day.date === date) ?? { date, status: 'unknown', uptime: null };
  });
}
export function dailyUptime(day: Daily): number | null {
  if (day.uptime !== null) return day.uptime;
  if (day.status === 'unknown') return null;
  // Successful but slow checks still count as available. Other known states count as unavailable.
  return day.status === 'operational' || day.status === 'degraded' ? 100 : 0;
}
export function historyUptime(history: Daily[], now = Date.now()): number | null {
  const percentages = dailyHistory(history, now)
    .map(dailyUptime)
    .filter((uptime): uptime is number => uptime !== null);
  return percentages.length
    ? percentages.reduce((total, uptime) => total + uptime, 0) / percentages.length
    : null;
}
export function emptySnapshot(now = Date.now()): Snapshot {
  return {
    generatedAt: new Date(now).toISOString(),
    feed: 'unconfigured',
    incidents: [],
    components: componentIds.map((id) => ({
      id,
      status: 'unknown',
      checkedAt: null,
      latency: null,
      source: 'none',
      history: []
    }))
  };
}

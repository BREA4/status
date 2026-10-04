import { z } from 'zod';
import { componentIds } from '#lib/catalog.ts';
import {
  aggregate,
  currentStatus,
  dailySchema,
  isFresh,
  type Daily,
  type Snapshot
} from '#lib/status.ts';

// ASVS 2.2.1: validate durable data as strictly as the operator's observation feed.
export const historySchema = z.object({
  version: z.literal(1),
  components: z
    .array(
      z.object({
        id: z.string().refine((id) => componentIds.includes(id)),
        history: z
          .array(dailySchema)
          .max(90)
          .refine(
            (days) => new Set(days.map(({ date }) => date)).size === days.length,
            'Duplicate history day'
          )
      })
    )
    .max(componentIds.length)
    .refine(
      (components) => new Set(components.map(({ id }) => id)).size === components.length,
      'Duplicate component'
    )
});
export type HistoryDocument = z.infer<typeof historySchema>;
export interface HistoryStore {
  read(fresh?: boolean): Promise<{ document: HistoryDocument; etag: string } | null>;
  write(document: HistoryDocument, etag?: string): Promise<void>;
}
export class HistoryConflict extends Error {}

function mergeHistory(document: HistoryDocument, snapshot: Snapshot): HistoryDocument {
  const now = Date.parse(snapshot.generatedAt);
  const today = new Date(now).toISOString().slice(0, 10);
  const firstDay = new Date(Date.parse(`${today}T00:00:00Z`) - 89 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const histories = new Map<string, Map<string, Daily>>();
  function add(id: string, day: Daily) {
    if (day.date < firstDay || day.date > today) return;
    let history = histories.get(id);
    if (!history) {
      history = new Map();
      histories.set(id, history);
    }
    const previous = history.get(day.date);
    history.set(
      day.date,
      previous
        ? {
            date: day.date,
            status: aggregate([previous.status, day.status]),
            uptime: day.uptime ?? previous.uptime
          }
        : { ...day }
    );
  }
  for (const component of document.components) {
    for (const day of component.history) add(component.id, day);
  }
  for (const component of snapshot.components) {
    for (const day of component.history) add(component.id, day);
    if (component.source === 'none' || !isFresh(component.checkedAt, now)) continue;
    add(component.id, {
      date: new Date(component.checkedAt!).toISOString().slice(0, 10),
      status: currentStatus(component, now, snapshot.incidents),
      // A point-in-time observation cannot establish a day's uptime percentage.
      uptime: null
    });
  }
  return {
    version: 1,
    components: componentIds
      .filter((id) => histories.has(id))
      .map((id) => ({
        id,
        history: [...histories.get(id)!.values()].sort((a, b) => a.date.localeCompare(b.date))
      }))
  };
}

function attachHistory(
  snapshot: Snapshot,
  document: HistoryDocument,
  historyRecording: Snapshot['historyRecording']
): Snapshot {
  const histories = new Map(document.components.map(({ id, history }) => [id, history]));
  return {
    ...snapshot,
    historyRecording,
    // Retain disabled services in storage, but never reintroduce them into public output.
    components: snapshot.components.map((component) => ({
      ...component,
      history: histories.get(component.id) ?? component.history
    }))
  };
}

export async function recordHistory(snapshot: Snapshot, store?: HistoryStore): Promise<Snapshot> {
  if (!store) return { ...snapshot, historyRecording: 'unconfigured' };
  let stored: Awaited<ReturnType<HistoryStore['read']>> = null;
  try {
    stored = await store.read();
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = stored?.document ?? { version: 1, components: [] };
      const next = mergeHistory(previous, snapshot);
      if (JSON.stringify(next) === JSON.stringify(previous))
        return attachHistory(snapshot, next, 'recorded');
      try {
        // ASVS 15.4.1: conditional writes prevent concurrent function instances losing data.
        await store.write(next, stored?.etag);
        return attachHistory(snapshot, next, 'recorded');
      } catch (error) {
        if (!(error instanceof HistoryConflict) || attempt === 2) throw error;
        stored = await store.read(true);
      }
    }
  } catch {
    // ASVS 16.5.2: storage failures preserve live status and never claim unsaved observations.
    return stored
      ? attachHistory(snapshot, stored.document, 'unavailable')
      : { ...snapshot, historyRecording: 'unavailable' };
  }
  return { ...snapshot, historyRecording: 'unavailable' };
}

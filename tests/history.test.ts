import { expect, test } from 'bun:test';
import { emptySnapshot, type Snapshot, type Status } from '../src/lib/status';
import {
  HistoryConflict,
  historySchema,
  recordHistory,
  type HistoryDocument,
  type HistoryStore
} from '../src/lib/server/history';

const now = Date.parse('2026-10-04T10:00:00Z');
function observation(id = 'update-server', status: Status = 'operational', at = now): Snapshot {
  const snapshot = emptySnapshot(at);
  snapshot.components = snapshot.components.filter((component) => component.id === id);
  Object.assign(snapshot.components[0], {
    status,
    checkedAt: new Date(at).toISOString(),
    source: 'http'
  });
  return snapshot;
}

class MemoryStore implements HistoryStore {
  document: HistoryDocument | null = null;
  revision = 0;
  writes = 0;
  freshReads = 0;
  async read(fresh = false) {
    if (fresh) this.freshReads++;
    return this.document
      ? { document: structuredClone(this.document), etag: String(this.revision) }
      : null;
  }
  async write(document: HistoryDocument, etag?: string) {
    if (etag !== (this.document ? String(this.revision) : undefined)) throw new HistoryConflict();
    this.document = structuredClone(document);
    this.revision++;
    this.writes++;
  }
}

test('recorded checks survive a new recorder and a new UTC day without inventing uptime', async () => {
  const storage = new MemoryStore();
  await recordHistory(observation(), storage);
  const nextInstance: HistoryStore = {
    read: (fresh) => storage.read(fresh),
    write: (document, etag) => storage.write(document, etag)
  };
  const result = await recordHistory(
    observation('update-server', 'operational', now + 86_400_000),
    nextInstance
  );
  expect(result.historyRecording).toBe('recorded');
  expect(result.components[0].history).toEqual([
    { date: '2026-10-04', status: 'operational', uptime: null },
    { date: '2026-10-05', status: 'operational', uptime: null }
  ]);
});

test('stores the worst observation of the UTC day and avoids writes for unchanged summaries', async () => {
  const store = new MemoryStore();
  await recordHistory(observation(), store);
  await recordHistory(observation('update-server', 'outage', now + 60_000), store);
  const recovery = await recordHistory(
    observation('update-server', 'operational', now + 120_000),
    store
  );
  expect(recovery.components[0].status).toBe('operational');
  expect(recovery.components[0].history[0].status).toBe('outage');
  expect(store.writes).toBe(2);
});

test('a day with a known check stays filled despite inconclusive checks', async () => {
  for (const status of [
    'operational',
    'degraded',
    'partial_outage',
    'outage',
    'maintenance'
  ] as const) {
    for (const statuses of [
      ['unknown', status],
      [status, 'unknown']
    ] as const) {
      const store = new MemoryStore();
      await recordHistory(observation('website', statuses[0]), store);
      const result = await recordHistory(observation('website', statuses[1], now + 60_000), store);
      expect(result.components[0].history).toEqual([{ date: '2026-10-04', status, uptime: null }]);
      expect(result.components[0].status).toBe(statuses[1]);
      expect(store.writes).toBe(statuses[0] === 'unknown' ? 2 : 1);
    }
  }
});

test('a day with only inconclusive checks remains unknown', async () => {
  const store = new MemoryStore();
  await recordHistory(observation('website', 'unknown'), store);
  const result = await recordHistory(observation('website', 'unknown', now + 60_000), store);
  expect(result.components[0].history).toEqual([
    { date: '2026-10-04', status: 'unknown', uptime: null }
  ]);
  expect(store.writes).toBe(1);
});

test('simultaneous first writes preserve observations from both function instances', async () => {
  const store = new MemoryStore();
  await Promise.all([
    recordHistory(observation('website', 'outage'), store),
    recordHistory(observation('update-server', 'operational'), store)
  ]);
  expect(store.document?.components.map(({ id }) => id)).toEqual(['website', 'update-server']);
  expect(store.document?.components[0].history[0].status).toBe('outage');
  expect(store.freshReads).toBe(1);
});

test('a stale cached read cannot erase a concurrent outage', async () => {
  const store = new MemoryStore();
  await recordHistory(observation(), store);
  const stale = await store.read();
  await recordHistory(observation('update-server', 'outage'), store);
  const result = await recordHistory(observation('website'), {
    read: (fresh) => (fresh ? store.read(true) : Promise.resolve(stale)),
    write: (document, etag) => store.write(document, etag)
  });
  expect(result.components.map(({ id }) => id)).toEqual(['website']);
  expect(
    store.document?.components.find(({ id }) => id === 'update-server')?.history[0].status
  ).toBe('outage');
});

test('retains exactly the last 90 UTC dates and drops future feed dates', async () => {
  const store = new MemoryStore();
  for (let day = 0; day < 91; day++) {
    await recordHistory(observation('website', 'operational', now + day * 86_400_000), store);
  }
  const history = store.document!.components[0].history;
  expect(history).toHaveLength(90);
  expect(history[0].date).toBe('2026-10-05');
  expect(history[89].date).toBe('2027-01-02');
  const snapshot = observation('website');
  snapshot.components[0].history = [{ date: '2026-10-05', status: 'operational', uptime: 100 }];
  const result = await recordHistory(snapshot, new MemoryStore());
  expect(result.components[0].history.map(({ date }) => date)).toEqual(['2026-10-04']);
});

test('uses the observation UTC date across timezone offsets and midnight', async () => {
  const snapshot = observation();
  snapshot.generatedAt = '2026-10-04T00:00:30Z';
  snapshot.components[0].checkedAt = '2026-10-04T02:59:59+03:00';
  const result = await recordHistory(snapshot, new MemoryStore());
  expect(result.components[0].history[0].date).toBe('2026-10-03');
});

test('does not create history for unobserved or stale services and keeps disabled services hidden', async () => {
  const store = new MemoryStore();
  await recordHistory(observation('website'), store);
  const snapshot = emptySnapshot(now);
  snapshot.components = snapshot.components.filter(({ id }) =>
    ['account', 'update-server'].includes(id)
  );
  Object.assign(snapshot.components[1], {
    status: 'operational',
    source: 'http',
    checkedAt: new Date(now - 600_000).toISOString()
  });
  const result = await recordHistory(snapshot, store);
  expect(result.components.map(({ id }) => id)).toEqual(['account', 'update-server']);
  expect(result.components.every(({ history }) => history.length === 0)).toBe(true);
  expect(store.writes).toBe(1);
});

test('preserves measured feed history if the feed later becomes unavailable', async () => {
  const store = new MemoryStore();
  const snapshot = observation();
  snapshot.components[0].history = [{ date: '2026-10-03', status: 'degraded', uptime: 99.2 }];
  await recordHistory(snapshot, store);
  const result = await recordHistory(observation(), store);
  expect(result.components[0].history[0]).toEqual({
    date: '2026-10-03',
    status: 'degraded',
    uptime: 99.2
  });
});

test('includes active incident impact in daily summaries', async () => {
  const snapshot = observation();
  snapshot.incidents = [
    {
      id: 'incident',
      title: { en: 'Incident', ru: 'Сбой' },
      status: 'investigating',
      impact: 'outage',
      startedAt: new Date(now - 1000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      components: ['update-server'],
      updates: []
    }
  ];
  const result = await recordHistory(snapshot, new MemoryStore());
  expect(result.components[0].history[0].status).toBe('outage');
});

test('storage failures and exhausted conflicts leave live status working without claiming a saved check', async () => {
  for (const error of [new Error('private storage details'), new HistoryConflict()]) {
    let writes = 0;
    const result = await recordHistory(observation(), {
      read: async () => null,
      write: async () => {
        writes++;
        throw error;
      }
    });
    expect(result.historyRecording).toBe('unavailable');
    expect(result.components[0].status).toBe('operational');
    expect(result.components[0].history).toEqual([]);
    expect(writes).toBe(error instanceof HistoryConflict ? 3 : 1);
    expect(JSON.stringify(result)).not.toContain('private storage details');
  }
  expect((await recordHistory(observation())).historyRecording).toBe('unconfigured');
});

test('rejects corrupt storage, unknown components and duplicate dates before merging', () => {
  const component = {
    id: 'website',
    history: [{ date: '2026-10-04', status: 'operational', uptime: null }]
  };
  expect(historySchema.safeParse({ version: 1, components: [component] }).success).toBe(true);
  expect(
    historySchema.safeParse({ version: 1, components: [{ ...component, id: 'private-host' }] })
      .success
  ).toBe(false);
  expect(historySchema.safeParse({ version: 1, components: [component, component] }).success).toBe(
    false
  );
  expect(
    historySchema.safeParse({
      version: 1,
      components: [{ ...component, history: [...component.history, ...component.history] }]
    }).success
  ).toBe(false);
});

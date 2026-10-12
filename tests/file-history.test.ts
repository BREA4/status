import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileHistoryStore } from '../src/lib/server/file-history-store';
import { HistoryConflict, recordHistory } from '../src/lib/server/history';
import { emptySnapshot, type Status } from '../src/lib/status';

test('disk history survives a new collector, recovery, an inconclusive check, and midnight', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'status-history-'));
  const path = join(directory, 'history.json');
  try {
    let at = Date.parse('2026-10-12T23:55:00Z');
    async function collect(status: Status) {
      const snapshot = emptySnapshot(at);
      snapshot.components = snapshot.components.filter(({ id }) => id === 'website');
      Object.assign(snapshot.components[0], {
        status,
        checkedAt: snapshot.generatedAt,
        source: 'http'
      });
      return recordHistory(snapshot, createFileHistoryStore(path));
    }
    await collect('outage');
    const stale = await createFileHistoryStore(path).read();
    at += 60_000;
    await collect('operational');
    await collect('unknown');
    at += 5 * 60_000;
    const result = await collect('operational');
    expect(result.components[0].history).toEqual([
      { date: '2026-10-12', status: 'outage', uptime: null },
      { date: '2026-10-13', status: 'operational', uptime: null }
    ]);
    expect(createFileHistoryStore(path).write(stale!.document, stale!.etag)).rejects.toBeInstanceOf(
      HistoryConflict
    );
    const saved = readFileSync(path, 'utf8');
    writeFileSync(path, '{broken');
    expect(createFileHistoryStore(path).read()).rejects.toThrow();
    expect(readFileSync(path, 'utf8')).toBe('{broken');
    expect(saved).toContain('outage');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

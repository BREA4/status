import { describe, expect, test } from 'bun:test';
import { detectLocale, messages } from '../src/lib/i18n';
import {
  aggregate,
  currentStatus,
  dailyHistory,
  dailyUptime,
  emptySnapshot,
  feedSchema,
  isFresh,
  historyUptime,
  summarize,
  type Incident,
  type Daily
} from '../src/lib/status';

const now = Date.parse('2026-10-02T09:00:00Z');
describe('language detection', () => {
  test('uses language preference weights and regional tags', () => {
    expect(detectLocale(undefined, 'de-DE,ru-RU;q=0.9,en;q=0.7')).toBe('ru');
    expect(detectLocale(undefined, 'ru;q=0.3,en-GB;q=0.9')).toBe('en');
  });
  test('keeps the saved choice and falls back to English', () => {
    expect(detectLocale('en', 'ru-RU')).toBe('en');
    expect(detectLocale('invalid', 'fr-FR')).toBe('en');
    expect(detectLocale(undefined, 'ru;q=0,en;q=0.5')).toBe('en');
    expect(detectLocale(undefined, 'ru;q=NaN')).toBe('en');
  });
  test('Russian copy uses е consistently', () => {
    expect(JSON.stringify(messages.ru)).not.toMatch(/[\u0451\u0401]/);
  });
});
describe('availability', () => {
  test('mixed coverage is incomplete in both group and global summaries', () => {
    expect(summarize(['operational', 'operational', 'unknown', 'unknown'])).toBe('incomplete');
    expect(summarize(['operational', 'unknown'])).toBe('incomplete');
    expect(summarize(['unknown', 'unknown'])).toBe('unknown');
    expect(summarize([])).toBe('unknown');
    expect(summarize(['operational', 'operational'])).toBe('operational');
  });
  test('known failures take precedence over incomplete coverage', () => {
    expect(summarize(['unknown', 'degraded'])).toBe('degraded');
    expect(summarize(['unknown', 'outage'])).toBe('outage');
    expect(summarize(['unknown', 'maintenance'])).toBe('maintenance');
  });
  test('an unknown component prevents an all-operational claim', () => {
    expect(aggregate(['operational', 'unknown'])).toBe('unknown');
    expect(aggregate([])).toBe('unknown');
    expect(aggregate(['operational', 'operational'])).toBe('operational');
  });
  test('known incidents remain visible even with incomplete monitoring', () => {
    expect(aggregate(['unknown', 'degraded', 'outage'])).toBe('outage');
    expect(aggregate(['unknown', 'maintenance'])).toBe('maintenance');
  });
  test('expires data after five minutes and rejects future timestamps', () => {
    expect(isFresh('2026-10-02T08:55:00Z', now)).toBe(true);
    expect(isFresh('2026-10-02T08:54:59Z', now)).toBe(false);
    expect(isFresh('2026-10-02T09:02:00Z', now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
    const component = {
      ...emptySnapshot(now).components[0],
      status: 'operational' as const,
      checkedAt: '2026-10-02T08:00:00Z'
    };
    expect(currentStatus(component, now)).toBe('unknown');
  });
  test('an active report overrides a passing check until resolved', () => {
    const component = {
      ...emptySnapshot(now).components[0],
      status: 'operational' as const,
      checkedAt: new Date(now).toISOString()
    };
    const incident: Incident = {
      id: 'incident',
      title: { en: 'Incident', ru: 'Сбой' },
      status: 'investigating',
      impact: 'outage',
      startedAt: new Date(now - 1000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      components: ['website'],
      updates: []
    };
    expect(currentStatus(component, now, [incident])).toBe('outage');
    expect(currentStatus(component, now, [{ ...incident, status: 'resolved' }])).toBe(
      'operational'
    );
  });
  test('never invents historical uptime', () => {
    const days = dailyHistory([{ date: '2026-10-01', status: 'degraded', uptime: 99.2 }], now);
    expect(days).toHaveLength(90);
    expect(days[88].uptime).toBe(99.2);
    expect(days[89]).toEqual({ date: '2026-10-02', status: 'unknown', uptime: null });
    expect(days.filter((day) => day.uptime !== null)).toHaveLength(1);
  });
  test('calculates availability over recorded days before 90 days are available', () => {
    const healthy: Daily = { date: '2026-10-02', status: 'operational', uptime: null };
    expect(historyUptime([healthy], now)).toBe(100);
    expect(
      historyUptime(
        [
          healthy,
          { date: '2026-10-01', status: 'degraded', uptime: null },
          { date: '2026-09-30', status: 'outage', uptime: null },
          { date: '2026-09-29', status: 'unknown', uptime: null }
        ],
        now
      )
    ).toBeCloseTo((2 / 3) * 100);
    expect(historyUptime([{ ...healthy, status: 'outage' }], now)).toBe(0);
    expect(historyUptime([{ ...healthy, status: 'unknown' }], now)).toBeNull();
    expect(historyUptime([], now)).toBeNull();
  });
  test('preserves measured daily percentages and excludes days outside the history window', () => {
    const healthy: Daily = { date: '2026-10-02', status: 'operational', uptime: null };
    expect(
      historyUptime(
        [
          healthy,
          { date: '2026-10-01', status: 'partial_outage', uptime: 99.98 },
          { date: '2026-07-04', status: 'outage', uptime: 0 },
          { date: '2026-10-03', status: 'outage', uptime: 0 }
        ],
        now
      )
    ).toBeCloseTo(99.99);
    expect(dailyUptime({ ...healthy, uptime: 0 })).toBe(0);
    expect(dailyUptime({ ...healthy, status: 'maintenance' })).toBe(0);
    expect(dailyUptime({ ...healthy, status: 'partial_outage' })).toBe(0);
    const fullHistory = dailyHistory([], now).map((day, index) => ({
      ...day,
      status: index === 0 ? ('outage' as const) : ('operational' as const)
    }));
    expect(historyUptime(fullHistory, now)).toBeCloseTo((89 / 90) * 100);
  });
  test('rejects invalid feed components and duplicate observations', () => {
    const component = {
      id: 'website',
      status: 'operational',
      checkedAt: new Date(now).toISOString()
    };
    const feed = { version: 1, generatedAt: new Date(now).toISOString(), components: [component] };
    expect(feedSchema.safeParse(feed).success).toBe(true);
    expect(feedSchema.safeParse({ ...feed, components: [component, component] }).success).toBe(
      false
    );
    expect(
      feedSchema.safeParse({ ...feed, components: [{ ...component, id: 'secret-host' }] }).success
    ).toBe(false);
  });
});

import { describe, expect, test } from 'bun:test';
import { detectLocale, messages } from '../src/lib/i18n';
import {
  aggregate,
  currentStatus,
  dailyHistory,
  emptySnapshot,
  feedSchema,
  isFresh,
  type Incident
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

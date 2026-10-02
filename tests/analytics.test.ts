import { expect, test } from 'bun:test';
import { sanitizePageview } from '../src/lib/analytics';

test('analytics removes query parameters and fragments from page views', () => {
  expect(
    sanitizePageview({
      type: 'pageview',
      url: 'https://status.example/?token=private&utm_source=email#secret'
    })
  ).toEqual({ type: 'pageview', url: 'https://status.example/' });
});

test('analytics preserves page paths and excludes custom events', () => {
  expect(sanitizePageview({ type: 'pageview', url: 'https://status.example/history' })).toEqual({
    type: 'pageview',
    url: 'https://status.example/history'
  });
  expect(sanitizePageview({ type: 'event', url: 'https://status.example/' })).toBeNull();
});

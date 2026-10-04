import { expect, test } from 'bun:test';
import { authorizedCron } from '../src/lib/server/cron';

test('cron rejects missing, malformed and wrong credentials, including equal-length tokens', () => {
  expect(authorizedCron(null, 'secret')).toBe(false);
  expect(authorizedCron('Bearer secret', undefined)).toBe(false);
  expect(authorizedCron('secret', 'secret')).toBe(false);
  expect(authorizedCron('Bearer wrong!', 'secret')).toBe(false);
  expect(authorizedCron('Bearer secret extra', 'secret')).toBe(false);
  expect(authorizedCron('Bearer secret', 'secret')).toBe(true);
});

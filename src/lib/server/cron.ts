import { timingSafeEqual } from 'node:crypto';

export function authorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  // ASVS 8.3.1: authorize scheduled writes on the server before making any probes.
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

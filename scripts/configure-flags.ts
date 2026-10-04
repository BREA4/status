import { spawnSync } from 'node:child_process';
import { featureDefinitions } from '../src/lib/features';

function vercel(args: string[]): string {
  // ASVS 1.2.5: pass fixed CLI arguments without a shell or credential interpolation.
  const result = spawnSync('vercel', ['flags', ...args, '--project', 'breach-status'], {
    encoding: 'utf8',
    timeout: 30_000
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.error?.message || 'Vercel command failed');
  return result.stdout;
}

const existing = JSON.parse(vercel(['list', '--json'])) as {
  flags: { slug: string }[];
  pagination: { next: string | null };
};
if (existing.pagination.next)
  throw new Error('Paginated flag list; inspect remaining flags before configuring');
const slugs = new Set(existing.flags.map(({ slug }) => slug));
for (const flag of featureDefinitions) {
  if (slugs.has(flag.key)) {
    console.info(`${flag.key}: existing settings preserved`);
    continue;
  }
  vercel(['create', flag.key, '--kind', 'boolean', '--description', flag.description]);
  for (const environment of ['development', 'preview', 'production'])
    vercel(['set', flag.key, '--environment', environment, '--variant', String(flag.defaultValue)]);
  console.info(`${flag.key}: created, ${flag.defaultValue ? 'on' : 'off'} in all environments`);
}

import { json } from '@sveltejs/kit';
import { getSnapshot } from '#lib/server/monitor.ts';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals }) => {
  return json(await getSnapshot(locals.features.enabledServiceIds), {
    headers: { 'Cache-Control': 'private, no-store' }
  });
};

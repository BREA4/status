import { getSnapshot } from '#lib/server/monitor.ts';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => ({
  locale: locals.locale,
  snapshot: await getSnapshot()
});

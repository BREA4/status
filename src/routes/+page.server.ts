import { getSnapshot } from '#lib/server/monitor.ts';
import { contactSupportEnabled } from '#lib/server/features.ts';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => {
  const [snapshot, supportEnabled] = await Promise.all([getSnapshot(), contactSupportEnabled()]);
  return { locale: locals.locale, snapshot, supportEnabled };
};

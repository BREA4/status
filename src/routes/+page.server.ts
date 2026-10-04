import { getSnapshot } from '#lib/server/monitor.ts';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => {
  const snapshot = await getSnapshot(locals.features.enabledServiceIds);
  return {
    locale: locals.locale,
    snapshot,
    supportEnabled: locals.features.supportEnabled,
    themeEnabled: locals.features.themeEnabled
  };
};

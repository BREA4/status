import { readPublishedSnapshot } from '#lib/server/published.ts';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => {
  const snapshot = readPublishedSnapshot(locals.features.enabledServiceIds);
  return {
    locale: locals.locale,
    snapshot,
    supportEnabled: locals.features.supportEnabled,
    themeEnabled: locals.features.themeEnabled
  };
};

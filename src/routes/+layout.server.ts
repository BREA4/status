import { VERCEL_ENV } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
  analyticsEnabled: VERCEL_ENV === 'production'
});

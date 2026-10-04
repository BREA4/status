import type { Handle } from '@sveltejs/kit/hooks';
import { detectLocale } from '#lib/i18n.ts';
import { getFeatures } from '#lib/server/features.ts';
import { featuresFromValues } from '#lib/features.ts';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.locale = detectLocale(
    event.cookies.get('breach-locale'),
    event.request.headers.get('accept-language') ?? ''
  );
  event.locals.features =
    event.url.pathname === '/' || event.url.pathname === '/api/status'
      ? await getFeatures()
      : featuresFromValues();
  const themeEnabled = event.locals.features.themeEnabled;
  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%lang%', event.locals.locale)
        .replace('%theme%', themeEnabled ? 'system' : 'light')
        .replace('%theme-selector%', themeEnabled ? 'enabled' : 'disabled')
        .replace('%color-scheme%', themeEnabled ? 'light dark' : 'light')
        .replace('%dark-theme-color%', themeEnabled ? '#101613' : '#f8f9f5')
  });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'DENY');
  if (event.url.pathname === '/') response.headers.set('Cache-Control', 'private, no-store');
  return response;
};

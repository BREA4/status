import type { Handle } from '@sveltejs/kit/hooks';
import { detectLocale } from '#lib/i18n.ts';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.locale = detectLocale(
    event.cookies.get('breach-locale'),
    event.request.headers.get('accept-language') ?? ''
  );
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
  });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'DENY');
  if (event.url.pathname === '/') response.headers.set('Cache-Control', 'private, no-store');
  return response;
};

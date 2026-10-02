import type { BeforeSend } from '@vercel/analytics';

export const sanitizePageview: BeforeSend = (event) => {
  if (event.type !== 'pageview') return null;
  const url = new URL(event.url);
  // ASVS 14.2.3: exclude query strings and fragments from analytics page URLs.
  url.search = '';
  url.hash = '';
  return { ...event, url: url.href };
};

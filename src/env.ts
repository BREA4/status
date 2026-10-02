import { defineEnvVars } from '@sveltejs/kit/env';
export const variables = defineEnvVars({
  VERCEL_ENV: {
    schema: (value) => value ?? 'development',
    description: 'Vercel deployment environment; analytics runs only in production'
  },
  STATUS_FEED_URL: {
    schema: (value) => value ?? '',
    description: 'Optional HTTPS monitoring feed'
  },
  STATUS_FEED_TOKEN: {
    schema: (value) => value ?? '',
    description: 'Optional server-only feed token'
  }
});

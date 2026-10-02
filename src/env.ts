import { defineEnvVars } from '@sveltejs/kit/env';
export const variables = defineEnvVars({
  STATUS_FEED_URL: {
    schema: (value) => value ?? '',
    description: 'Optional HTTPS monitoring feed'
  },
  STATUS_FEED_TOKEN: {
    schema: (value) => value ?? '',
    description: 'Optional server-only feed token'
  }
});

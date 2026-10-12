import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const basePath = process.env.BASE_PATH || '';
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/')))
  throw new Error('BASE_PATH must start with / and have no trailing slash');

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
      paths: { base: basePath as '' | `/${string}` },
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'base-uri': ['self'],
          'object-src': ['none']
        }
      }
    })
  ]
});

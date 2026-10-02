<script lang="ts">
  import { onMount } from 'svelte';
  import { inject } from '@vercel/analytics';
  import { sanitizePageview } from '#lib/analytics.ts';
  import type { LayoutData } from './$types';
  import '@fontsource-variable/outfit';
  import '@fontsource-variable/golos-text';
  import '../app.css';

  export let data: LayoutData;

  onMount(() => {
    if (data.analyticsEnabled) {
      // The generic SDK supports SvelteKit 3 without the removed $app/stores API.
      inject({ mode: 'production', beforeSend: sanitizePageview });
    }
  });
</script>

<slot />

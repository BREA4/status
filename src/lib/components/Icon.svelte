<script lang="ts">
  export let name:
    | 'arrow'
    | 'chevron'
    | 'refresh'
    | 'globe'
    | 'external'
    | 'check'
    | 'clock'
    | 'plus'
    | 'signal'
    | 'sun'
    | 'monitor'
    | 'moon'
    | 'rss' = 'arrow';
  export let size = 18;
  const paths = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    chevron: 'm9 5 7 7-7 7',
    refresh: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c4 5 4 13 0 18-4-5-4-13 0-18Z',
    external: 'M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
    check: 'm5 12 4 4L19 6',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    plus: 'M12 5v14M5 12h14',
    signal: 'M4 17v3M9 12v8M14 7v13M19 3v17',
    sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    monitor:
      'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM12 17v4m-4 0h8',
    moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
    rss: 'M4 4a16 16 0 0 1 16 16M4 10a10 10 0 0 1 10 10M4 19h.01'
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name]} /></svg
>

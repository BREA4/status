<script lang="ts">
  import { onMount } from 'svelte';
  import { messages, type Locale } from '#lib/i18n.ts';
  import PreferenceDropdown from './PreferenceDropdown.svelte';

  export let locale: Locale;
  type Theme = 'light' | 'system' | 'dark';
  const choices = [
    { theme: 'light', icon: 'sun' },
    { theme: 'system', icon: 'monitor' },
    { theme: 'dark', icon: 'moon' }
  ] as const;
  let preference: Theme = 'system';
  let ready = false;
  $: t = messages[locale];
  $: options = choices.map(({ theme, icon }) => ({ value: theme, label: t.theme[theme], icon }));
  $: icon = choices.find(({ theme }) => theme === preference)!.icon;

  function normalize(value: string | null | undefined): Theme {
    return value === 'light' || value === 'dark' ? value : 'system';
  }

  function updateBrowserChrome() {
    const background = getComputedStyle(document.documentElement).backgroundColor;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = background;
    });
    document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')!.content =
      preference === 'system' ? 'light dark' : preference;
  }

  function apply(next: Theme) {
    preference = next;
    document.documentElement.dataset.theme = next;
    updateBrowserChrome();
  }

  function choose(next: Theme) {
    apply(next);
    try {
      if (next === 'system') localStorage.removeItem('breach-theme');
      else localStorage.setItem('breach-theme', next);
    } catch {
      // The switch still works for this visit if storage is blocked.
    }
  }

  onMount(() => {
    apply(normalize(document.documentElement.dataset.theme));
    ready = true;
    const deviceTheme = matchMedia('(prefers-color-scheme: dark)');
    const sync = (event: StorageEvent) => {
      if (event.key === 'breach-theme' || event.key === null) apply(normalize(event.newValue));
    };
    deviceTheme.addEventListener('change', updateBrowserChrome);
    window.addEventListener('storage', sync);
    return () => {
      deviceTheme.removeEventListener('change', updateBrowserChrome);
      window.removeEventListener('storage', sync);
    };
  });
</script>

<PreferenceDropdown
  id="theme-selector"
  label={t.appearance}
  value={preference}
  display={t.themeShort[preference]}
  {icon}
  {options}
  {ready}
  compact
  onChange={(next) => choose(normalize(next))}
/>

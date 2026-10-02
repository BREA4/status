<script lang="ts">
  import { onMount } from 'svelte';
  import { groups } from '#lib/catalog.ts';
  import { messages, type Locale } from '#lib/i18n.ts';
  import { aggregate, currentStatus, isFresh, type Snapshot, type Status } from '#lib/status.ts';
  import Icon from '#lib/components/Icon.svelte';
  import ServiceGroup from '#lib/components/ServiceGroup.svelte';
  import ThemeSwitcher from '#lib/components/ThemeSwitcher.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  let locale: Locale = data.locale;
  let snapshot: Snapshot = data.snapshot;
  let now = Date.parse(data.snapshot.generatedAt);
  let filter: 'all' | 'website' | 'network' = 'all';
  let opened = new Set(['web']);
  let refreshing = false;
  let refreshError = false;
  let incidentPage = 0;
  let root: HTMLElement;
  let mounted = false;
  let refreshMotion = () => {};
  const pageSize = 3;
  const legend: Status[] = ['operational', 'degraded', 'outage', 'maintenance', 'unknown'];
  $: t = messages[locale];
  $: statuses = snapshot.components.map((component) =>
    currentStatus(component, now, snapshot.incidents)
  );
  $: reportedStatuses = statuses.filter((status) => status !== 'unknown');
  $: overall = aggregate(reportedStatuses);
  $: reporting = reportedStatuses.length;
  $: headlineStatus =
    overall === 'operational' && reporting < statuses.length
      ? ('monitored_operational' as const)
      : overall;
  $: visibleGroups = groups.filter((group) => filter === 'all' || group.category === filter);
  $: allExpanded = visibleGroups.every((group) => opened.has(group.id));
  $: totalPages = Math.max(1, Math.ceil(snapshot.incidents.length / pageSize));
  $: incidentPage = Math.min(incidentPage, totalPages - 1);
  $: incidents = snapshot.incidents.slice(incidentPage * pageSize, (incidentPage + 1) * pageSize);
  $: stale = !isFresh(snapshot.generatedAt, now);

  function setLocale(next: Locale) {
    locale = next;
    document.documentElement.lang = next;
    document.cookie = `breach-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function toggleGroup(id: string) {
    const next = new Set(opened);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    opened = next;
    requestAnimationFrame(refreshMotion);
  }
  function toggleAll() {
    opened = allExpanded ? new Set() : new Set(visibleGroups.map(({ id }) => id));
    requestAnimationFrame(refreshMotion);
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const response = await fetch('/api/status', {
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Unavailable');
      const result = (await response.json()) as Snapshot;
      if (
        !Array.isArray(result.components) ||
        !result.generatedAt ||
        !Array.isArray(result.incidents)
      )
        throw new Error('Invalid response');
      snapshot = result;
      refreshError = false;
    } catch {
      refreshError = true;
    } finally {
      now = Date.now();
      refreshing = false;
      requestAnimationFrame(refreshMotion);
    }
  }
  function dateTime(value: string, language: Locale, client: boolean) {
    return new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...(client ? {} : { timeZone: 'UTC' })
    }).format(new Date(value));
  }
  onMount(() => {
    mounted = true;
    now = Date.now();
    let destroyed = false;
    let destroyMotion = () => {};
    // Motion is optional and browser-only; it must never prevent server rendering.
    void import('#lib/motion.ts')
      .then(({ mountMotion }) => {
        if (destroyed) return;
        const motion = mountMotion(root);
        refreshMotion = motion.refresh;
        destroyMotion = motion.destroy;
      })
      .catch(() => {
        /* The page stays fully usable if the motion chunk fails. */
      });
    const timer = setInterval(() => {
      now = Date.now();
      if (!document.hidden) void refresh();
    }, 60_000);
    const clock = setInterval(() => {
      now = Date.now();
    }, 15_000);
    const visibility = () => {
      if (!document.hidden) {
        now = Date.now();
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visibility);
      destroyed = true;
      destroyMotion();
    };
  });
</script>

<svelte:head>
  <title>{t.statusPage} · Breach</title>
  <meta name="description" content={t.intro} />
  <meta property="og:title" content={`${t.statusPage} · Breach`} />
  <meta property="og:description" content={t.intro} />
</svelte:head>

<main class="page overflow-x-hidden w-full max-w-full" bind:this={root}>
  <a class="skip-link" href="#services">{t.skip}</a>
  <header class="site-header shell">
    <a class="brand" href="/" aria-label="Breach"
      ><img src="/favicon.svg" alt="" width="35" height="35" /><span
        >breach<span class="brand-period">.</span></span
      ></a
    >
    <span class="header-divider"></span><span class="header-label">{t.statusPage}</span>
    <nav class="header-actions" aria-label={t.preferences}>
      <ThemeSwitcher {locale} />
      <div class="language-switch" role="group" aria-label={t.language}>
        <button
          class:active={locale === 'en'}
          disabled={!mounted}
          aria-pressed={locale === 'en'}
          onclick={() => setLocale('en')}>EN</button
        ><button
          class:active={locale === 'ru'}
          disabled={!mounted}
          aria-pressed={locale === 'ru'}
          onclick={() => setLocale('ru')}>RU</button
        >
      </div>
      <a class="back-link" href="https://brea4.space">{t.back}<Icon name="external" size={13} /></a>
    </nav>
  </header>

  <section class="hero shell" aria-labelledby="status-heading">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="live-dot" class:inactive={reporting === 0}></span>{t.networkStatus}
      </div>
      <h1 class="max-w-6xl" id="status-heading" aria-live="polite" aria-atomic="true">
        {t.headline[headlineStatus]}
      </h1>
      <p class="hero-description">{t.intro}</p>
      <div class="hero-links">
        <a href="#services" class="button button-dark"
          >{t.services}<Icon name="arrow" size={16} /></a
        ><a href="#incidents" class="text-link">{t.incidents}<span>↗</span></a>
      </div>
    </div>
    <div class="signal-art" aria-hidden="true">
      <div class="signal-orbit orbit-outer"></div>
      <div class="signal-orbit orbit-mid"></div>
      <div class="signal-orbit orbit-inner"></div>
      <div class="signal-axis axis-x"></div>
      <div class="signal-axis axis-y"></div>
      <div class="signal-center">
        <svg viewBox="0 0 100 60"><path d="M0 30h27l8-15 12 32 12-39 11 22h30" /></svg>
      </div>
      <span class="orbital-node node-one"></span><span class="orbital-node node-two"></span><span
        class="orbital-node node-three"
      ></span>
    </div>
  </section>

  <div class="shell">
    <div class="update-strip">
      <div class="update-info">
        <Icon name="clock" size={15} /><span
          >{t.checked}<time datetime={snapshot.generatedAt}
            >{dateTime(snapshot.generatedAt, locale, mounted)}</time
          ></span
        >
      </div>
      <div class="update-actions">
        <span class="auto-refresh">{t.autoRefresh}</span><button
          class="refresh-button"
          class:spinning={refreshing}
          onclick={refresh}
          disabled={!mounted || refreshing}
          aria-label={refreshing ? t.refreshing : t.refresh}
          title={t.refresh}><Icon name="refresh" size={16} /></button
        >
      </div>
    </div>
    <div class="refresh-announcement sr-only" aria-live="polite">
      {refreshing ? t.refreshing : refreshError ? t.offline : ''}
    </div>
    {#if stale || refreshError}<p class="notice" role="status">
        {stale ? t.stale : t.offline}
      </p>{/if}
  </div>

  <section id="services" class="services-layout shell" aria-labelledby="services-heading">
    <aside class="services-aside">
      <h2 id="services-heading">{t.overview}</h2>
      <p>{t.serviceIntro}</p>
      <div class="coverage">
        <span class="coverage-number">{reporting}<span>/{statuses.length}</span></span><span
          >{t.coverageSuffix}</span
        >
        <div class="coverage-track">
          <span style={`width:${(reporting / statuses.length) * 100}%`}></span>
        </div>
      </div>
      <div class="legend" aria-label={t.legend}>
        {#each legend as status}<span
            ><span class="status-dot {status}"></span>{t.status[status]}</span
          >{/each}
      </div>
    </aside>
    <div class="services-main">
      <div class="service-toolbar">
        <div class="filters" aria-label={t.services}>
          {#each ['all', 'website', 'network'] as category}<button
              class:active={filter === category}
              disabled={!mounted}
              aria-pressed={filter === category}
              onclick={() => {
                filter = category as typeof filter;
                requestAnimationFrame(refreshMotion);
              }}>{t[category as 'all' | 'website' | 'network']}</button
            >{/each}
        </div>
        <button class="expand-all" onclick={toggleAll} disabled={!mounted}
          >{allExpanded ? t.collapse : t.expand}<Icon name="plus" size={14} /></button
        >
      </div>
      <div class="service-list grid-flow-dense">
        {#each visibleGroups as group (group.id)}<ServiceGroup
            {group}
            {snapshot}
            {locale}
            {now}
            ready={mounted}
            open={opened.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />{/each}
      </div>
    </div>
  </section>

  <section id="incidents" class="incidents-section shell" aria-labelledby="incidents-heading">
    <div class="section-heading">
      <div>
        <h2 id="incidents-heading">{t.incidents}</h2>
        <p>{t.incidentIntro}</p>
      </div>
      <span class="inline-signal" aria-hidden="true"
        ><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span
      >
    </div>
    {#if incidents.length === 0}
      <div class="empty-incidents">
        <div class="empty-icon"><Icon name="clock" size={23} /></div>
        <div>
          <h3>{t.noIncidents}</h3>
          <p>{t.noIncidentsNote}</p>
        </div>
      </div>
    {:else}
      <div class="incident-list" aria-live="polite">
        {#each incidents as incident}
          <article class="incident">
            <div class="incident-date">
              <time datetime={incident.startedAt}
                >{dateTime(incident.startedAt, locale, mounted)}</time
              ><span class="incident-state" class:resolved={incident.status === 'resolved'}
                >{t.incidentState[incident.status]}</span
              >
            </div>
            <div class="incident-body">
              <h3>{incident.title[locale]}</h3>
              <div class="affected-services">
                {#each incident.components as id}<span
                    >{groups
                      .flatMap((group) => group.components)
                      .find((component) => component.id === id)?.name[locale]}</span
                  >{/each}
              </div>
              {#each [...incident.updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) as update}<div
                  class="incident-update"
                >
                  <p>{update.message[locale]}</p>
                  <time datetime={update.at}>{dateTime(update.at, locale, mounted)}</time>
                </div>{/each}
            </div>
          </article>
        {/each}
      </div>
      {#if totalPages > 1}<div class="pagination">
          <button
            class="button button-light"
            disabled={!mounted || incidentPage === 0}
            onclick={() => incidentPage--}>{t.previous}</button
          ><span>{t.page} {incidentPage + 1} {t.of} {totalPages}</span><button
            class="button button-light"
            disabled={!mounted || incidentPage === totalPages - 1}
            onclick={() => incidentPage++}>{t.next}</button
          >
        </div>{/if}
    {/if}
  </section>

  <section class="support-section shell" aria-labelledby="support-heading">
    <div class="support-card">
      <div>
        <span class="support-kicker">{locale === 'en' ? 'BREACH SUPPORT' : 'ПОДДЕРЖКА BREACH'}</span
        >
        <h2 id="support-heading">{t.supportHeading}</h2>
        <p>{t.supportCopy}</p>
      </div>
      <a href="https://brea4.space/app/support" class="button button-green"
        >{t.support}<Icon name="arrow" size={17} /></a
      >
    </div>
  </section>
  <footer class="site-footer shell">
    <div class="footer-left">
      <img src="/favicon.svg" alt="" width="23" height="23" /><span>{t.footer}</span>
    </div>
    <div class="footer-links">
      <span>{t.timeZone}</span><a href="/api/status">{t.api}<Icon name="external" size={12} /></a>
    </div>
  </footer>
</main>

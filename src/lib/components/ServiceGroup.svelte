<script lang="ts">
  import type { ServiceGroup } from '#lib/catalog.ts';
  import { messages, type Locale } from '#lib/i18n.ts';
  import { aggregate, currentStatus, type Snapshot } from '#lib/status.ts';
  import Icon from './Icon.svelte';
  import StatusPill from './StatusPill.svelte';
  import History from './History.svelte';
  export let group: ServiceGroup;
  export let snapshot: Snapshot;
  export let locale: Locale;
  export let now: number;
  export let open = false;
  export let ready = false;
  export let onToggle: () => void;
  let detail: string | null = null;
  $: t = messages[locale];
  $: components = group.components.map((component) => ({
    ...component,
    observation: snapshot.components.find(({ id }) => component.id === id)!
  }));
  $: status = aggregate(
    components.map(({ observation }) => currentStatus(observation, now, snapshot.incidents))
  );
</script>

<article class="service-group" class:is-open={open}>
  <button
    class="group-toggle"
    disabled={!ready}
    aria-expanded={open}
    aria-controls={`group-${group.id}`}
    onclick={onToggle}
  >
    <span class="location-icon" class:web={group.id === 'web'}
      >{#if group.id === 'web'}<Icon name="globe" size={22} />{:else}<span>{group.code}</span
        >{/if}</span
    >
    <span class="group-name"
      ><strong>{group.name[locale]}</strong><small>{group.subtitle[locale]}</small></span
    >
    <span class="group-state"><StatusPill {status} {locale} /></span>
    <span class="group-chevron"><Icon name="chevron" size={16} /></span>
  </button>
  {#if open}
    <div class="group-content" id={`group-${group.id}`}>
      {#each components as component}
        {@const observation = component.observation}
        {@const componentStatus = currentStatus(observation, now, snapshot.incidents)}
        <div class="component-row" class:detail-open={detail === component.id}>
          <button
            class="component-toggle"
            disabled={!ready}
            aria-expanded={detail === component.id}
            aria-controls={`detail-${component.id}`}
            onclick={() => (detail = detail === component.id ? null : component.id)}
          >
            <span class="component-title"
              ><span class="component-branch"></span><span>{component.name[locale]}</span></span
            >
            <span class="component-right">
              {#if observation.latency !== null && componentStatus !== 'unknown'}<span
                  class="latency">{observation.latency} ms</span
                >{/if}
              <StatusPill status={componentStatus} {locale} /><span class="component-plus"
                ><Icon name="plus" size={13} /></span
              >
            </span>
          </button>
          {#if detail === component.id}
            <div class="component-detail" id={`detail-${component.id}`}>
              <p>{component.description[locale]}</p>
              <p class="detail-note">
                {componentStatus === 'unknown'
                  ? t.unknownNote
                  : observation.source === 'http'
                    ? t.reachability
                    : ''}
              </p>
              {#if observation.checkedAt}<p class="detail-time">
                  {t.lastObservation} · {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(observation.checkedAt))}
                </p>{/if}
              <History history={observation.history} {locale} {now} />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</article>

<script lang="ts">
  import { messages, type Locale } from '#lib/i18n.ts';
  import { dailyHistory, type Daily } from '#lib/status.ts';
  export let history: Daily[] = [];
  export let locale: Locale;
  export let now: number;
  $: days = dailyHistory(history, now);
  $: t = messages[locale];
  $: recordedDates = new Set(history.map((day) => day.date));
  $: known = days.filter((day) => recordedDates.has(day.date));
  function label(day: Daily) {
    return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(day.date))}: ${t.status[day.status]}${day.uptime !== null ? ` · ${day.uptime.toFixed(2)}%` : ''}`;
  }
</script>

<div class="history-block">
  <div class="history-heading">
    <span>{t.history}</span><span>{known.length ? `${known.length} / 90` : t.noHistory}</span>
  </div>
  <div
    class="history-bars"
    role="img"
    aria-label={`${t.history}. ${known.length ? `${known.length} / 90` : t.noHistory}`}
  >
    {#each days as day}<span class="history-bar {day.status}" title={label(day)}></span>{/each}
  </div>
  <div class="history-scale"><span>{t.daysAgo}</span><span>{t.today}</span></div>
</div>

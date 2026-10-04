<script lang="ts">
  import { messages, type Locale } from '#lib/i18n.ts';
  import { dailyHistory, dailyUptime, historyUptime, type Daily } from '#lib/status.ts';
  export let history: Daily[] = [];
  export let locale: Locale;
  export let now: number;
  $: days = dailyHistory(history, now);
  $: t = messages[locale];
  $: recordedDates = new Set(history.map((day) => day.date));
  $: known = days.filter((day) => recordedDates.has(day.date));
  $: uptime = historyUptime(history, now);
  $: summary =
    uptime !== null ? percentage(uptime, locale) : known.length ? t.status.unknown : t.noHistory;

  function percentage(uptime: number, locale: Locale) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(uptime)}%`;
  }
  function label(day: Daily, locale: Locale) {
    const t = messages[locale];
    const uptime = dailyUptime(day);
    const measurement =
      uptime !== null
        ? `${percentage(uptime, locale)} ${day.uptime !== null ? t.measured : t.recorded}`
        : t.noMeasurement;
    return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(day.date))}: ${t.status[day.status]} · ${measurement}`;
  }
</script>

<div class="history-block">
  <div class="history-heading">
    <span>{t.history}</span><span title={t.historyUptime}>{summary}</span>
  </div>
  <div class="history-bars" role="img" aria-label={`${t.history}. ${t.historyUptime}: ${summary}`}>
    {#each days as day}<span class="history-bar {day.status}" title={label(day, locale)}
      ></span>{/each}
  </div>
  <div class="history-scale"><span>{t.daysAgo}</span><span>{t.today}</span></div>
</div>

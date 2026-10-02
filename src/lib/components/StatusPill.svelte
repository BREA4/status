<script lang="ts">
  import { messages, type Locale } from '#lib/i18n.ts';
  import type { Status } from '#lib/status.ts';
  export let status: Status;
  export let locale: Locale;
</script>

<span class="status-pill {status}"
  ><span class="status-dot"></span>{messages[locale].status[status]}</span
>

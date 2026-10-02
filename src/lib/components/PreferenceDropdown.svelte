<script lang="ts">
  import { tick, type ComponentProps } from 'svelte';
  import Icon from './Icon.svelte';

  type IconName = ComponentProps<typeof Icon>['name'];
  export let id: string;
  export let label: string;
  export let value: string;
  export let display: string;
  export let icon: IconName | undefined = undefined;
  export let compact = false;
  export let ready = false;
  export let options: { value: string; label: string; icon?: IconName; lang?: string }[];
  export let onChange: (value: string) => void;

  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let menu: HTMLDivElement;
  let open = false;
  $: selected = options.find((option) => option.value === value);

  async function show(edge?: 'first' | 'last') {
    open = true;
    await tick();
    const items = menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    const index =
      edge === 'first'
        ? 0
        : edge === 'last'
          ? items.length - 1
          : options.findIndex((option) => option.value === value);
    items[Math.max(0, index)]?.focus();
  }

  function close(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger.focus();
  }

  function choose(next: string) {
    onChange(next);
    close(true);
  }

  function outside(event: Event) {
    if (open && !root.contains(event.target as Node)) close();
  }

  function keyboard(event: KeyboardEvent) {
    if (!root?.contains(event.target as Node)) return;
    if (!open) {
      if (ready && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        void show(event.key === 'ArrowDown' ? 'first' : 'last');
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      // Close after the browser moves focus, including Shift+Tab back to the trigger.
      setTimeout(() => close(), 0);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (
      event.key.length === 1 &&
      /\S/.test(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const next = options.findIndex((option) =>
        option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase())
      );
      if (next >= 0) {
        event.preventDefault();
        menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[next]?.focus();
      }
    }
  }
</script>

<svelte:window
  onpointerdown={outside}
  onfocusin={outside}
  onkeydown={keyboard}
  onblur={() => close()}
/>

<div class="preference-dropdown" class:compact bind:this={root}>
  <button
    {id}
    class="preference-trigger"
    bind:this={trigger}
    disabled={!ready}
    aria-label={`${label}: ${selected?.label ?? display}`}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? `${id}-menu` : undefined}
    onclick={() => (open ? close() : show())}
  >
    {#if icon}<Icon name={icon} size={16} />{/if}
    <span class="preference-value">{display}</span>
    <span class="preference-chevron"><Icon name="chevron" size={12} /></span>
  </button>
  {#if open}
    <div
      class="preference-menu"
      id={`${id}-menu`}
      role="menu"
      aria-labelledby={id}
      bind:this={menu}
    >
      {#each options as option}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={option.value === value}
          tabindex="-1"
          lang={option.lang}
          onclick={() => choose(option.value)}
        >
          {#if option.icon}<Icon name={option.icon} size={16} />{/if}
          <span>{option.label}</span>
          <span class="preference-check"
            >{#if option.value === value}<Icon name="check" size={14} />{/if}</span
          >
        </button>
      {/each}
    </div>
  {/if}
</div>

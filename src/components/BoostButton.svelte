<script>
  import { onMount } from 'svelte';
  export let boost = null;
  export let active = false;
  export let onClaim;
  let now = Date.now();
  $: visible = active && boost && !boost.used && now >= boost.opensAt && now < boost.expiresAt;
  onMount(() => {
    const timer = setInterval(() => { now = Date.now(); }, 100);
    return () => clearInterval(timer);
  });
</script>
<div class="boost-slot" aria-live="polite">
  {#if visible}
    <button class="boost-button" type="button" on:pointerdown|preventDefault={() => { if (visible) onClaim(); }}>⚡ BOOST! <span>+6% · tap now</span></button>
  {/if}
</div>

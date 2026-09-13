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

<style>

  .boost-slot { min-height: 76px; padding-top: var(--space-3); }
  button { width: 100%; border-radius: 0; border: 3px solid #fff0ac; background: #ffd166; color: #352247; box-shadow: 0 4px 0 #b88228; font-size: 26px; }
  span { display: block; font-size: 13px; }
  button:active { transform: translateY(3px); box-shadow: none; }
</style>

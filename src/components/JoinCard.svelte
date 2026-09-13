<script>
  import SwimmerPicker from './SwimmerPicker.svelte';
  export let name = '';
  export let selected = 'human';
  export let error = '';
  export let onJoin;
</script>
<section class="card">
  <div class="big-emoji">🏊</div><h1>Swim Tap Race</h1>
  <p>Enter your name, then tap as fast as you can when the race starts.</p>
  <form on:submit|preventDefault={onJoin}>
    <label for="name">Your name</label>
    <input id="name" bind:value={name} maxlength="18" autocomplete="nickname" placeholder="e.g. Seb">
    <SwimmerPicker bind:selected />
    <button class="primary" type="submit">Join race</button>
    <p class="error" aria-live="polite">{error}</p>
  </form>
</section>

<style>

  h1 { text-align: center; margin: 8px 0; font-size: 34px; }
  .big-emoji { font-size: 64px; text-align: center; }
  p { color: var(--muted); line-height: 1.45; }
  form { display: grid; gap: var(--space-3); margin-top: 22px; }
  .error { min-height: 1.4em; color: var(--danger); margin: 0; }
</style>

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

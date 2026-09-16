<script>
  import SwimmerPicker from './SwimmerPicker.svelte';
  import WellbeingFacts from './WellbeingFacts.svelte';
  export let name = '';
  export let selected = 'human';
  export let error = '';
  export let onJoin;
  let wellbeingDialog;
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
  <button
    class="wellbeing-link"
    type="button"
    on:click={() => wellbeingDialog.showModal()}
  >8 benefits of swimming <span aria-hidden="true">→</span></button>
</section>

<dialog bind:this={wellbeingDialog} aria-labelledby="wellbeing-title">
  <button class="dialog-close" type="button" aria-label="Close wellbeing facts" on:click={() => wellbeingDialog.close()}>×</button>
  <WellbeingFacts titleId="wellbeing-title" />
  <button class="primary dialog-done" type="button" on:click={() => wellbeingDialog.close()}>Back to the race</button>
</dialog>

<style>

  h1 { text-align: center; margin: 8px 0; font-size: 34px; }
  .big-emoji { font-size: 64px; text-align: center; }
  p { color: var(--muted); line-height: 1.45; }
  .wellbeing-link {
    display: block;
    min-height: 32px;
    margin: 2px auto 0;
    padding: 4px 8px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }
  .wellbeing-link:hover { color: var(--accent-2); text-decoration: underline; }
  dialog { width: min(720px, calc(100% - 28px)); max-height: calc(100dvh - 40px); padding: 30px 24px; border: 4px solid var(--accent-2); background: var(--panel); color: var(--text); box-shadow: 8px 8px 0 #031522; }
  dialog::backdrop { background: #021422dd; }
  .dialog-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; padding: 0; border-radius: 0; background: #1b5271; color: white; font-size: 30px; }
  .dialog-done { width: 100%; margin-top: 22px; }
  form { display: grid; gap: var(--space-3); margin-top: 22px; }
  .error { min-height: 1.4em; color: var(--danger); margin: 0; }
</style>

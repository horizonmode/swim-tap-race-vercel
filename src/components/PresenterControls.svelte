<script>
  export let authorized = false;
  export let authStatus = '';
  export let startDisabled = true;
  export let onAuthenticate;
  export let onCommand;
  let key = '';
  function authenticate(event) {
    event.preventDefault();
    onAuthenticate(key);
    key = '';
  }
</script>
<div class="presenter-controls">
  {#if !authorized}
    <form class="presenter-login" on:submit={authenticate}>
      <label for="sessionKey">Session key</label>
      <input id="sessionKey" type="password" autocomplete="current-password" maxlength="256" bind:value={key} required>
      <button type="submit">Unlock lobby</button><p role="status">{authStatus}</p>
    </form>
  {:else}
    <div class="presenter-actions">
      <button class="primary" type="button" disabled={startDisabled} on:click={() => onCommand('presenter:start')}>Start race</button>
      <button type="button" on:click={() => onCommand('presenter:reset')}>Reset</button>
      <button type="button" on:click={() => confirm('Remove all swimmers from the lobby?') && onCommand('presenter:clear')}>Clear players</button>
    </div>
  {/if}
</div>

<style>

  .presenter-controls { grid-column: 1; display: flex; flex-wrap: wrap; gap: 10px; min-width: 0; }
  .presenter-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  button:not(.primary) { background: #ffffff14; color: var(--text); }
  form { display: grid; gap: var(--space-3); flex-basis: 100%; max-width: 420px; margin: 0 0 12px; }
  p { margin: 0; color: var(--muted); font-size: 14px; }
</style>

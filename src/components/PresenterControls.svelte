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
      <label for="presenterKey">Presenter key</label>
      <input id="presenterKey" type="password" autocomplete="current-password" maxlength="256" bind:value={key} required>
      <button type="submit">Unlock controls</button><p role="status">{authStatus}</p>
    </form>
  {:else}
    <div class="presenter-actions">
      <button class="primary" type="button" disabled={startDisabled} on:click={() => onCommand('presenter:start')}>Start race</button>
      <button type="button" on:click={() => onCommand('presenter:reset')}>Reset</button>
      <button type="button" on:click={() => confirm('Remove all swimmers from the lobby?') && onCommand('presenter:clear')}>Clear players</button>
    </div>
  {/if}
</div>

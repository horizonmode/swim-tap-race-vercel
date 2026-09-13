<script>
  import PoolLane from './PoolLane.svelte';
  import BoostButton from './BoostButton.svelte';
  import ResultsDialog from './ResultsDialog.svelte';
  export let name = '';
  export let status = '';
  export let hint = '';
  export let countdown = null;
  export let player = null;
  export let race = null;
  export let players = [];
  export let myId = null;
  export let moving = false;
  export let motionMs = 0;
  export let boost = null;
  export let connected = false;
  export let onTap;
  export let onBoost;
  export let onLeave;
</script>
<section class="card">
  <div class="status-row"><span>{name}</span><strong>{status}</strong></div>
  {#if countdown}<div class="player-countdown" aria-live="assertive">{countdown}</div>{/if}
  <div class="scoreboard player-pool" aria-label="Your swimming lane"><PoolLane {player} {moving} {motionMs} mini /></div>
  <button class="tap-button" type="button" disabled={!connected || race?.state !== 'racing'} on:pointerdown|preventDefault={onTap}>
    {race?.state === 'racing' ? 'TAP TO SWIM' : 'GET READY'}
  </button>
  <BoostButton {boost} active={connected && !!myId && race?.state === 'racing'} onClaim={onBoost} />
  <p id="hint">{hint}</p>
  <button class="reset-player" type="button" on:click={onLeave}>Leave race</button>
  <ResultsDialog {race} {players} {myId} />
</section>

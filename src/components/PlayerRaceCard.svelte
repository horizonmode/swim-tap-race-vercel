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

<style>

  .status-row { display: flex; justify-content: space-between; gap: var(--space-3); align-items: center; }
  .status-row span { font-weight: 800; font-size: 20px; overflow-wrap: anywhere; }
  .player-countdown { text-align: center; font-size: 64px; font-weight: 900; color: var(--accent-2); }
  .player-pool { margin: 18px 0; }
  .tap-button { width: 100%; min-height: 210px; font-size: clamp(32px, 11vw, 54px); color: #032033; background: linear-gradient(180deg, #a7efff, #45c7f2); box-shadow: inset 0 -10px 0 #00000014; touch-action: manipulation; user-select: none; }
  .tap-button:active:not(:disabled) { transform: translateY(3px) scale(.99); box-shadow: inset 0 -5px 0 #00000014; }
  #hint { text-align: center; color: var(--muted); line-height: 1.45; }
  .reset-player { width: 100%; margin-top: 12px; color: var(--text); background: #ffffff14; }
</style>

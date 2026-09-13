<script>
  import { onMount } from 'svelte';
  import { rankPlayers, resultsLifecycle } from '../results-model.js';
  import SwimmerSprite from './SwimmerSprite.svelte';
  export let race = null;
  export let players = [];
  export let myId = null;
  export let onDismiss;
  let dialog;
  let lifecycle;
  $: rows = race ? rankPlayers(race, players) : [];
  $: winner = rows.find(player => player.id === race?.winnerId);
  $: if (lifecycle) lifecycle.update(race?.state);
  onMount(() => { lifecycle = resultsLifecycle(dialog, () => onDismiss?.()); });
</script>
<dialog bind:this={dialog} class="race-results" aria-labelledby="resultsTitle" on:close={() => lifecycle?.dismiss()}>
  <button class="results-close" type="button" aria-label="Close scoreboard" on:click={() => dialog.close()}>×</button>
  <div class="eyebrow">RACE COMPLETE</div><h2 id="resultsTitle">Final scoreboard</h2>
  <p class="results-summary">{winner ? `${winner.name} wins! The race ended when the winner reached the finish.` : 'Final positions when the race ended.'}</p>
  <div class="results-table-wrap">
    <table><thead><tr><th scope="col">Place</th><th scope="col">Swimmer</th><th scope="col">Result</th></tr></thead>
      <tbody>{#each rows as player (player.id)}
        <tr class:results-you={player.id === myId}>
          <td>{player.id === race?.winnerId ? '🏆 1' : player.rank}</td>
          <td><div class="results-identity"><span aria-hidden="true"><SwimmerSprite character={player.swimmer} /></span><span>{player.name}{player.id === myId ? ' (you)' : ''}</span></div></td>
          <td>{player.result}</td>
        </tr>
      {/each}</tbody>
    </table>
  </div>
</dialog>
{#if race?.state === 'finished'}<button class="results-open" type="button" on:click={() => lifecycle?.reopen()}>View scoreboard</button>{/if}

<style>

  dialog { position: fixed; width: min(640px, calc(100% - 28px)); max-height: calc(100dvh - 40px); padding: 30px 24px; border: 4px solid var(--accent-2); background: var(--panel); color: var(--text); box-shadow: 8px 8px 0 #031522; }
  dialog::backdrop { background: #021422cc; }
  h2 { margin: 10px 44px 12px 0; font-size: clamp(24px, 5vw, 36px); }
  .results-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; padding: 0; border-radius: 0; background: #1b5271; color: white; font-size: 30px; }
  .results-summary { color: var(--muted); line-height: 1.5; }
  .results-table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th { color: var(--accent-2); font-size: 13px; }
  td, th { padding: 10px 6px; border-bottom: 2px solid #28536b; }
  td:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .results-identity { display: flex; align-items: center; gap: 8px; overflow-wrap: anywhere; --sprite-width: 48px; --sprite-height: 36px; --cap-color: var(--accent); }
  .results-you { background: #16496a; }
  .results-open { margin-top: 18px; background: var(--accent); color: #032033; }
  @media (max-width: 400px) { dialog { padding: 24px 12px; } .results-identity { flex-wrap: wrap; gap: 4px; } }
</style>

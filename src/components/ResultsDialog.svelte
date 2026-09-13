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

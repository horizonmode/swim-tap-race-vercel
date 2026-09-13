<script>
  import PoolLane from './PoolLane.svelte';
  export let race = null;
  export let players = [];
  export let countdown = null;
  export let goVisible = false;
  export let winnerText = '';
  const colors = ['#ff5f6d', '#ffd166', '#b2f7ef', '#cdb4db', '#ff9f1c', '#80ed99', '#f15bb5', '#9b5de5', '#00bbf9'];
  function capColor(player) {
    let hash = 0;
    for (const character of player.id) hash = ((hash << 5) - hash) + character.charCodeAt(0);
    return colors[Math.abs(hash) % colors.length];
  }
</script>
<section class="scoreboard">
  {#if countdown}<div class="countdown">{countdown}</div>{/if}
  {#if goVisible}<div class="go-burst show">GO!</div>{/if}
  {#if winnerText}<div class="winner">{winnerText}</div>{/if}
  <div class="lanes" class:compact={players.length > 10}>
    {#if !players.length}<div class="empty-state">Waiting for swimmers to join…</div>
    {:else}
      {#each players as player (player.id)}
        <div class="lane">
          <div class="lane-name"><span class="lane-name-dot" style={`background:${capColor(player)}`}></span><span class="swimmer-name">{player.name}</span></div>
          <PoolLane {player} capColor={capColor(player)} moving={race?.state === 'racing' && player.distance > 0} motionMs={player.motionMs || 0} />
        </div>
      {/each}
    {/if}
  </div>
</section>

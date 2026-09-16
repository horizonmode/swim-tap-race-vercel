<script>
  import PoolLane from './PoolLane.svelte';
  export let race = null;
  export let players = [];
  export let countdown = null;
  export let goVisible = false;
  const colors = ['#ff5f6d', '#ffd166', '#7bdff2', '#b2f7ef', '#cdb4db', '#ff9f1c', '#80ed99', '#f15bb5', '#9b5de5', '#00bbf9'];
  function capColor(player) {
    let hash = 0;
    for (const character of player.id) hash = ((hash << 5) - hash) + character.charCodeAt(0);
    return colors[Math.abs(hash) % colors.length];
  }
</script>
<section class="scoreboard">
  {#if countdown}<div class="countdown">{countdown}</div>{/if}
  {#if goVisible}<div class="go-burst show">GO!</div>{/if}
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

<style>

  .lanes { display: grid; gap: 0; border: 4px solid #123e60; background: #197ca9; }
  .lanes.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; }
  .lane { display: grid; grid-template-columns: minmax(110px, 180px) minmax(0, 1fr); align-items: stretch; }
  .lane-name { display: flex; align-items: center; padding: 12px; color: #153850; background: var(--deck); border-bottom: 4px solid var(--tile-seam); font-family: ui-monospace, monospace; font-weight: 900; font-size: clamp(14px, 1.6vw, 22px); overflow: hidden; white-space: nowrap; }
  .swimmer-name { overflow: hidden; text-overflow: ellipsis; }
  .lane-name-dot { width: 11px; height: 11px; flex-shrink: 0; margin-right: 8px; border: 1px solid #ffffffbf; }
  .compact .lane { grid-template-columns: minmax(72px, 110px) minmax(0, 1fr); }
  .compact .lane-name { font-size: clamp(13px, 1.25vw, 18px); }
  .empty-state { padding: 90px 20px; text-align: center; color: #e1faff; font-family: ui-monospace, monospace; font-size: 24px; text-shadow: 2px 2px #12547c; }
  .countdown, .go-burst { position: absolute; z-index: 20; top: 30px; left: 50%; transform: translateX(-50%); text-align: center; font-weight: 900; }
  .countdown { font-size: clamp(72px, 15vw, 180px); padding: 12px 34px; background: #02121ebe; border-radius: 24px; }
  .go-burst { z-index: 30; font-size: clamp(84px, 16vw, 190px); line-height: 1; pointer-events: none; text-shadow: 0 8px 0 #00000029; animation: go-pop .75s ease-out both; }
  @keyframes go-pop { 0% { opacity: 0; transform: translateX(-50%) scale(.55); } 20% { opacity: 1; transform: translateX(-50%) scale(1.18); } 65% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: 0; transform: translateX(-50%) scale(1.08); } }
  @media (max-width: 760px) { .lane { grid-template-columns: 90px minmax(0, 1fr); } .lane-name { padding: 6px; } .lane-name-dot { display: none; } .lanes.compact { grid-template-columns: minmax(0, 1fr); } }
  @media (prefers-reduced-motion: reduce) { .go-burst { animation: none; } }
</style>

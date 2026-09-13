<script>
  import SwimmerSprite from './SwimmerSprite.svelte';
  export let player;
  export let moving = false;
  export let motionMs = 0;
  export let mini = false;
  export let capColor = '#5dd7ff';
  $: progress = Math.max(0, Math.min(100, player?.distance || 0));
</script>
<div class="track" class:mini-track={mini} style={`--cap-color:${capColor}`}>
  {#if !mini}<span class="track-player-name">{player.name}</span>{/if}
  <div class="swimmer-wrap" class:mini-swimmer={mini} class:moving aria-hidden="true" style={`transition-duration:${motionMs}ms;left:calc(${progress}% - ${progress * 0.72}px)`}>
    <span class="splash"></span><SwimmerSprite character={player?.swimmer} />
  </div>
</div>

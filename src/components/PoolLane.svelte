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

<style>

  .track { position: relative; min-height: var(--lane-height, 88px); overflow: hidden; background: linear-gradient(90deg, transparent calc(100% - 28px), #10527c calc(100% - 28px) calc(100% - 24px), transparent 0), repeating-linear-gradient(0deg, transparent 0 20px, #ffffff0c 20px 24px), repeating-linear-gradient(90deg, transparent 0 44px, #ffffff0c 44px 48px), var(--water); box-shadow: inset 0 4px #ffffff38, inset 0 -4px #126d96; }
  .track::before { content: ''; position: absolute; inset: auto 0 0; height: 6px; background: repeating-linear-gradient(90deg, #fff2cf 0 12px, #ff665a 12px 24px); box-shadow: 0 -2px #15577e; z-index: 3; }
  .track::after { content: ''; position: absolute; right: 0; top: 0; width: 12px; height: 100%; background: repeating-conic-gradient(#173953 0% 25%, #eff9ec 0% 50%) 0 0 / 12px 12px; }
  .track-player-name { position: absolute; top: 6px; right: 18px; z-index: 4; max-width: calc(100% - 92px); overflow: hidden; font-family: ui-monospace, monospace; font-size: clamp(12px, 1.35vw, 18px); font-weight: 900; line-height: 1.1; text-align: right; text-overflow: ellipsis; white-space: nowrap; text-shadow: 2px 2px #12547c; }
  .swimmer-wrap { position: absolute; left: 0; top: 16px; width: var(--sprite-width); height: var(--sprite-height); transition-property: left; transition-timing-function: linear; filter: drop-shadow(0 4px 0 #08638866); }
  .splash { position: absolute; left: 2px; top: 27px; width: 28px; height: 13px; opacity: 0; }
  .splash::before, .splash::after { content: ''; position: absolute; width: 4px; height: 4px; background: #d8ffff; box-shadow: -8px -8px #d8ffff, -12px 8px #a7efff, 4px -16px #a7efff; }
  .splash::after { left: 12px; top: -4px; }
  .moving .splash { animation: splash-flick .28s steps(2, end) infinite alternate; }
  @keyframes splash-flick { from { opacity: .3; transform: translate(-2px, 2px) scale(.8); } to { opacity: 1; transform: translate(-8px, -2px) scale(1.15); } }
  @media (prefers-reduced-motion: reduce) { .swimmer-wrap { transition-property: none; } .moving .splash { animation: none; opacity: .5; } }
</style>

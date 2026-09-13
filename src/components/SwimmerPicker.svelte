<script>
  import { swimmerOptions } from '../../swimmers.js';
  import SwimmerSprite from './SwimmerSprite.svelte';
  export let selected = 'human';
</script>
<fieldset class="swimmer-picker">
  <legend>Pick your swimmer</legend>
  <div class="swimmer-choices">
    {#each swimmerOptions as option}
      <label class="swimmer-choice" title={option.name}>
        <input type="radio" name="swimmer" value={option.id} aria-label={option.name} bind:group={selected} on:change={() => sessionStorage.setItem('swim-character', selected)}>
        <span class="swimmer-option"><span aria-hidden="true"><SwimmerSprite character={option.id} /></span>{#if option.id === 'esme'}<span>Esme</span>{/if}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>

  fieldset { border: 0; margin: 4px 0; padding: 0; min-width: 0; }
  legend { font-weight: 800; margin-bottom: 10px; }
  .swimmer-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); }
  .swimmer-choice { position: relative; cursor: pointer; min-width: 0; }
  input { position: absolute; width: 1px; height: 1px; opacity: 0; padding: 0; }
  .swimmer-option { display: grid; justify-items: center; padding: 6px 2px 10px; border: 2px solid #46677e; background: #08243a; font-size: 12px; --sprite-width: 64px; --sprite-height: 48px; --cap-color: var(--accent); }
  input:checked + .swimmer-option { border-color: var(--accent-2); background: #145477; box-shadow: 0 3px 0 var(--accent); }
  input:focus-visible + .swimmer-option { outline: 3px solid var(--text); outline-offset: 3px; }
  @media (max-width: 380px) { .swimmer-choices { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

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

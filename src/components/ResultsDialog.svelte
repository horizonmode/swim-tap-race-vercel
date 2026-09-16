<script>
  import { onMount, tick } from "svelte";
  import { rankPlayers, resultsLifecycle } from "../results-model.js";
  import SwimmerSprite from "./SwimmerSprite.svelte";
  export let race = null;
  export let players = [];
  export let myId = null;
  export let onDismiss;
  let dialog;
  let lifecycle;
  let page = "scoreboard";
  let pageTitle;
  $: if (race?.state !== "finished") page = "scoreboard";

  async function showPage(next) {
    page = next;
    await tick();
    dialog.scrollTop = 0;
    pageTitle?.focus();
  }

  function advanceOrClose() {
    if (page === "scoreboard") showPage("wellbeing");
    else dialog.close();
  }

  function reopen() {
    page = "scoreboard";
    lifecycle?.reopen();
  }
  $: rows = race ? rankPlayers(race, players) : [];
  $: winner = rows.find((player) => player.id === race?.winnerId);
  $: if (lifecycle) lifecycle.update(race?.state);
  onMount(() => {
    lifecycle = resultsLifecycle(dialog, () => onDismiss?.());
  });
</script>

<dialog
  bind:this={dialog}
  class="race-results"
  aria-labelledby="resultsTitle"
  on:close={() => lifecycle?.dismiss()}
  on:cancel|preventDefault={advanceOrClose}
>
  <button
    class="results-close"
    type="button"
    aria-label={page === "scoreboard"
      ? "Continue to swimming wellbeing"
      : "Close swimming wellbeing"}
    on:click={advanceOrClose}>×</button
  >
  {#if page === "scoreboard"}
    <div class="eyebrow">RACE COMPLETE · 1 OF 2</div>
    <h2 bind:this={pageTitle} tabindex="-1" id="resultsTitle">
      Final scoreboard
    </h2>
    <p class="results-summary">
      {winner
        ? `${winner.name} wins! The race ended when the winner reached the finish.`
        : "Final positions when the race ended."}
    </p>
    <div class="results-table-wrap">
      <table>
        <thead
          ><tr
            ><th scope="col">Place</th><th scope="col">Swimmer</th><th
              scope="col">Result</th
            ></tr
          ></thead
        >
        <tbody
          >{#each rows as player (player.id)}
            <tr class:results-you={player.id === myId}>
              <td>{player.id === race?.winnerId ? "🏆 1" : player.rank}</td>
              <td
                ><div class="results-identity">
                  <span aria-hidden="true"
                    ><SwimmerSprite character={player.swimmer} /></span
                  ><span>{player.name}{player.id === myId ? " (you)" : ""}</span
                  >
                </div></td
              >
              <td>{player.result}</td>
            </tr>
          {/each}</tbody
        >
      </table>
    </div>
    <div class="results-actions">
      <button
        class="primary"
        type="button"
        on:click={() => showPage("wellbeing")}
        >Next: swimming wellbeing →</button
      >
    </div>
  {:else}
    <div class="eyebrow">WELLBEING MOMENT · 2 OF 2</div>
    <h2 bind:this={pageTitle} tabindex="-1" id="resultsTitle">
      8 benefits of swimming
    </h2>
    <p class="results-summary">
      Whatever your fitness level, time in the pool can support your body and
      mind in plenty of ways.
    </p>
    <div class="wellbeing-facts">
      <article>
        <span aria-hidden="true">🏊</span>
        <div>
          <h3>1. Full-body workout</h3>
          <p>Every stroke puts muscles across your whole body to work.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">😊</span>
        <div>
          <h3>2. General wellbeing</h3>
          <p>Regular swimming can help you stay fit and support a positive outlook.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">😌</span>
        <div>
          <h3>3. Stress relief</h3>
          <p>Even a light swim can help you relax and may support better sleep.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">🔥</span>
        <div>
          <h3>4. Burns calories</h3>
          <p>Gentle and faster swims both offer an effective way to use energy.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">❤️</span>
        <div>
          <h3>5. Supports long-term health</h3>
          <p>As cardiovascular exercise, swimming can help protect against heart disease, stroke and type 2 diabetes.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">💧</span>
        <div>
          <h3>6. Water supports you</h3>
          <p>Water carries much of your body weight, helping you stay active with less load on your body.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">⚡</span>
        <div>
          <h3>7. More energy</h3>
          <p>Swimming regularly can raise your energy levels by increasing your metabolic rate.</p>
        </div>
      </article>
      <article>
        <span aria-hidden="true">❄️</span>
        <div>
          <h3>8. Keeps you cool</h3>
          <p>The surrounding water cools you while you exercise—however hard you work.</p>
        </div>
      </article>
    </div>
    <p class="sources">
      Summarised from <a
        href="https://www.swimming.org/justswim/8-benefits-of-swimming/"
        target="_blank"
        rel="noreferrer">Swim England’s “8 benefits of swimming”</a
      >
    </p>
    <div class="results-actions">
      <button
        class="back-button"
        type="button"
        on:click={() => showPage("scoreboard")}>← Scoreboard</button
      >
      <button class="primary" type="button" on:click={() => dialog.close()}
        >Finish</button
      >
    </div>
  {/if}
</dialog>
{#if race?.state === "finished"}<button
    class="results-open"
    type="button"
    on:click={reopen}>View scoreboard</button
  >{/if}

<style>
  dialog {
    position: fixed;
    width: min(640px, calc(100% - 28px));
    max-height: calc(100dvh - 40px);
    padding: 30px 24px;
    border: 4px solid var(--accent-2);
    background: var(--panel);
    color: var(--text);
    box-shadow: 8px 8px 0 #031522;
  }
  dialog::backdrop {
    background: #021422cc;
  }
  h2 {
    margin: 10px 44px 12px 0;
    font-size: clamp(24px, 5vw, 36px);
  }
  .results-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 0;
    background: #1b5271;
    color: white;
    font-size: 30px;
  }
  .results-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
  }
  .back-button {
    background: #1b5271;
    color: var(--text);
  }
  .wellbeing-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  article {
    display: flex;
    align-items: start;
    gap: 14px;
    padding: 16px;
    background: #16496a;
    border-radius: 14px;
  }
  article > span {
    font-size: 28px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 18px;
  }
  article p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }
  .sources {
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }
  .results-summary {
    color: var(--muted);
    line-height: 1.5;
  }
  .results-table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  th {
    color: var(--accent-2);
    font-size: 13px;
  }
  td,
  th {
    padding: 10px 6px;
    border-bottom: 2px solid #28536b;
  }
  td:last-child {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .results-identity {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-wrap: anywhere;
    --sprite-width: 48px;
    --sprite-height: 36px;
    --cap-color: var(--accent);
  }
  .results-you {
    background: #16496a;
  }
  .results-open {
    margin-top: 18px;
    background: var(--accent);
    color: #032033;
  }
  @media (max-width: 400px) {
    dialog {
      padding: 24px 12px;
    }
    .results-identity {
      flex-wrap: wrap;
      gap: 4px;
    }
  }
  @media (max-width: 620px) {
    .wellbeing-facts {
      grid-template-columns: 1fr;
    }
  }
</style>

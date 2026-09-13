<script>
  import { onMount } from "svelte";
  import { createResults } from "../results.js";
  import { swimmerOptions, normalizeSwimmer, swimmerMarkup } from "../swimmers.js";

  const playerId = sessionStorage.getItem("swim-player-id") || crypto.randomUUID();
  sessionStorage.setItem("swim-player-id", playerId);
  const playerToken = sessionStorage.getItem("swim-player-token") || crypto.randomUUID();
  sessionStorage.setItem("swim-player-token", playerToken);

  let joinCard;
  let gameCard;
  let ws;
  let reconnectTimer;
  let countdownTimer;
  let results;
  let myId = null;
  let joinedName = "";
  let name = "";
  let joinError = "";
  let hint = "Wait for the presenter to start the race.";
  let raceStatus = "Waiting…";
  let selectedSwimmer = normalizeSwimmer(sessionStorage.getItem("swim-character"));
  let currentSwimmer = selectedSwimmer;
  let race = null;
  let myPlayer = null;
  let countdownValue = null;
  let lastDistance = 0;
  let moving = false;
  let strokeTimer;

  $: progress = Math.max(0, Math.min(100, myPlayer?.distance || 0));

  function wsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/api/ws`;
  }

  function send(type, data = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownValue = null;
  }

  function startCountdown(endsAt) {
    stopCountdown();
    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      if (!remaining) return stopCountdown();
      countdownValue = Math.max(1, Math.ceil(remaining / 1000));
    };
    tick();
    countdownTimer = setInterval(tick, 100);
  }

  function animateStroke() {
    moving = true;
    clearTimeout(strokeTimer);
    strokeTimer = setTimeout(() => { moving = false; }, 420);
  }

  function handleGameState(message) {
    race = message.race;
    if (!myId) return;
    myPlayer = message.players.find((player) => player.id === myId) || null;
    if (!myPlayer) {
      myId = null;
      joinedName = "";
      gameCard.classList.add("hidden");
      joinCard.classList.remove("hidden");
      hint = "Join the next race.";
      return;
    }

    currentSwimmer = normalizeSwimmer(myPlayer.swimmer);
    if (race.state === "racing" && myPlayer.distance > lastDistance) animateStroke();
    if (race.state !== "racing") {
      clearTimeout(strokeTimer);
      moving = false;
    }
    lastDistance = myPlayer.distance;

    if (race.state === "lobby") {
      stopCountdown();
      raceStatus = "Waiting";
      hint = "Wait for the presenter to start the race.";
    } else if (race.state === "countdown") {
      startCountdown(race.countdownEndsAt);
      raceStatus = "Get ready!";
      hint = "3… 2… 1…";
    } else if (race.state === "racing") {
      stopCountdown();
      raceStatus = "GO!";
      hint = "Tap as fast as you can.";
    } else {
      stopCountdown();
      raceStatus = race.winnerId === myId ? "YOU WIN!" : "Finished";
      hint = race.winnerId === myId ? "Lane legend!" : "Race over — nice swimming.";
    }
  }

  function connect() {
    clearTimeout(reconnectTimer);
    ws = new WebSocket(wsUrl());
    ws.addEventListener("open", () => {
      if (joinedName) send("join", { playerId, playerToken, name: joinedName, swimmer: selectedSwimmer });
    });
    ws.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "serverError") {
        joinError = message.message;
        hint = message.message;
      } else if (message.type === "joinResult") {
        if (!message.ok) {
          joinError = message.message || "Could not join.";
          return;
        }
        joinError = "";
        myId = message.id;
        gameCard.classList.remove("hidden");
        joinCard.classList.add("hidden");
      } else if (message.type === "gameState") {
        handleGameState(message);
        results?.({ race: message.race, players: message.players }, myId);
      }
    });
    ws.addEventListener("close", () => {
      raceStatus = "Reconnecting…";
      reconnectTimer = setTimeout(connect, 900);
    });
  }

  function join() {
    joinError = "";
    joinedName = name.trim();
    if (!joinedName) {
      joinError = "Enter a name first.";
      return;
    }
    if (!send("join", { playerId, playerToken, name: joinedName, swimmer: selectedSwimmer })) {
      joinError = "Connecting… try again in a moment.";
    }
  }

  function resetPlayer() {
    send("leave", { playerToken });
    stopCountdown();
    myId = null;
    joinedName = "";
    name = "";
    myPlayer = null;
    lastDistance = 0;
    gameCard.classList.add("hidden");
    joinCard.classList.remove("hidden");
    hint = "Join the next race.";
  }

  onMount(() => {
    document.body.className = "player-page";
    results = createResults(gameCard);
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(countdownTimer);
      clearTimeout(strokeTimer);
      ws?.close();
    };
  });
</script>

<main class="player-shell">
  <section bind:this={joinCard} class="card">
    <div class="big-emoji">🏊</div>
    <h1>Swim Tap Race</h1>
    <p>Enter your name, then tap as fast as you can when the race starts.</p>
    <form on:submit|preventDefault={join}>
      <label for="name">Your name</label>
      <input id="name" bind:value={name} maxlength="18" autocomplete="nickname" placeholder="e.g. Seb">
      <fieldset class="swimmer-picker">
        <legend>Pick your swimmer</legend>
        <div class="swimmer-choices">
          {#each swimmerOptions as option}
            <label class="swimmer-choice">
              <input type="radio" name="swimmer" value={option.id} aria-label={option.name} bind:group={selectedSwimmer} on:change={() => sessionStorage.setItem("swim-character", selectedSwimmer)}>
              <span class="swimmer-option"><span aria-hidden="true">{@html swimmerMarkup(option.id)}</span></span>
            </label>
          {/each}
        </div>
      </fieldset>
      <button class="primary" type="submit">Join race</button>
      <p class="error" aria-live="polite">{joinError}</p>
    </form>
  </section>

  <section bind:this={gameCard} class="card hidden">
    <div class="status-row">
      <span>{joinedName}</span>
      <strong>{raceStatus}</strong>
    </div>
    {#if countdownValue}
      <div class="player-countdown" aria-live="assertive">{countdownValue}</div>
    {/if}
    <div class="scoreboard player-pool" aria-label="Your swimming lane">
      <div class="track mini-track">
        <div class:moving class="swimmer-wrap mini-swimmer" aria-hidden="true" style={`left:calc(${progress}% - ${progress * 0.72}px)`}>
          <span class="splash"></span>{@html swimmerMarkup(currentSwimmer)}
        </div>
      </div>
    </div>
    <button class="tap-button" type="button" disabled={!race || race.state !== "racing"} on:pointerdown|preventDefault={() => send("tap")}>
      {race?.state === "racing" ? "TAP TO SWIM" : "GET READY"}
    </button>
    <p id="hint">{hint}</p>
    <button class="reset-player" type="button" on:click={resetPlayer}>Leave race</button>
  </section>
</main>

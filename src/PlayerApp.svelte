<script>
  import { motionDuration } from "./swimmer-motion.js";
  import { onMount } from "svelte";
  import { normalizeSwimmer } from "../swimmers.js";
  import JoinCard from "./components/JoinCard.svelte";
  import PlayerRaceCard from "./components/PlayerRaceCard.svelte";

  const playerId = sessionStorage.getItem("swim-player-id") || crypto.randomUUID();
  sessionStorage.setItem("swim-player-id", playerId);
  const playerToken = sessionStorage.getItem("swim-player-token") || crypto.randomUUID();
  sessionStorage.setItem("swim-player-token", playerToken);

  let ws;
  let reconnectTimer;
  let countdownTimer;
  let myId = null;
  let joinedName = sessionStorage.getItem("swim-player-name") || "";
  let name = joinedName;
  let joinError = "";
  let hint = "Wait for the presenter to start the race.";
  let raceStatus = "Waiting…";
  let selectedSwimmer = normalizeSwimmer(sessionStorage.getItem("swim-character"));
  let race = null;
  let myPlayer = null;
  let countdownValue = null;
  let lastDistance = 0;
  let motionMs = 0;
  let moving = false;
  let strokeTimer;
  let boost = null;
  let connected = false;
  let players = [];
  function claimBoost() {
    if (connected && myId && race?.state === "racing" && boost && !boost.used && Date.now() >= boost.opensAt && Date.now() < boost.expiresAt && send("boost", { boostId: boost.id })) {
      boost = { ...boost, used: true };
      animateStroke();
    }
  }

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
    players = message.players;
    if (!myId) return;
    myPlayer = message.players.find((player) => player.id === myId) || null;
    if (!myPlayer) {
      myId = null;
      joinedName = "";
      hint = "Join the next race.";
      return;
    }

    if (race.state === "racing" && myPlayer.distance > lastDistance) animateStroke();
    if (race.state !== "racing") {
      clearTimeout(strokeTimer);
      moving = false;
    }
    if (lastDistance !== myPlayer.distance || race.state !== "racing") motionMs = motionDuration(lastDistance, myPlayer.distance, race.state === "racing");
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
      connected = true;
      if (joinedName) send("join", { playerId, playerToken, name: joinedName, swimmer: selectedSwimmer });
    });
    ws.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "boostStatus") {
        boost = message.boost;
      } else if (message.type === "serverError") {
        joinError = message.message;
        hint = message.message;
      } else if (message.type === "joinResult") {
        if (!message.ok) {
          joinError = message.message || "Could not join.";
          return;
        }
        joinError = "";
        myId = message.id;
        sessionStorage.setItem("swim-player-name", joinedName);
      } else if (message.type === "gameState") {
        handleGameState(message);
      }
    });
    ws.addEventListener("close", () => {
      connected = false;
      boost = null;
      raceStatus = "Reconnecting…";
      reconnectTimer = setTimeout(connect, 900);
    });
  }

  function join() {
    joinError = "";
    joinedName = name.trim();
    sessionStorage.setItem("swim-player-name", joinedName);
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
    sessionStorage.removeItem("swim-player-name");
    myPlayer = null;
    lastDistance = 0;
    hint = "Join the next race.";
  }

  onMount(() => {
    document.body.className = "player-page";
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
  {#if !myId}
    <JoinCard bind:name bind:selected={selectedSwimmer} error={joinError} onJoin={join} />
  {:else}
    <PlayerRaceCard name={joinedName} status={raceStatus} {hint} countdown={countdownValue} player={myPlayer} {race} {players} {myId} {moving} {motionMs} {boost} {connected}
      onTap={() => send('tap')} onBoost={claimBoost} onLeave={resetPlayer} />
  {/if}
</main>

<style>
  .player-shell { width: min(100%, 460px); }
</style>

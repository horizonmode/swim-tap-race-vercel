<script>
  import { createPresenterSession } from "./presenter-session.js";
  import { motionDuration } from "./swimmer-motion.js";
  import { onMount } from "svelte";
  import JoinCode from "./components/JoinCode.svelte";
  import PresenterControls from "./components/PresenterControls.svelte";
  import RaceBoard from "./components/RaceBoard.svelte";
  import ResultsDialog from "./components/ResultsDialog.svelte";

  const authSession = createPresenterSession(send);
  let authStatus = "";
  let authorized = false;
  let ws;
  let reconnectTimer;
  let countdownTimer;
  let race = null;
  let players = [];
  let countdownValue = null;
  let goVisible = false;
  let winnerText = "";
  let winnerVisible = false;

  $: startDisabled = !authorized || race?.state !== "lobby" || players.length < 1;

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

  function handleGameState(message) {
    const previousState = race?.state;
    race = message.race;
    const previousPlayers = new Map(players.map(player => [player.id, player]));
    players = message.players.map(player => {
      const previous = previousPlayers.get(player.id);
      return { ...player, motionMs: previous?.distance === player.distance && race.state === "racing"
        ? previous.motionMs : motionDuration(previous?.distance, player.distance, race.state === "racing") };
    });

    if (race.state === "countdown") startCountdown(race.countdownEndsAt);
    else stopCountdown();

    if (previousState === "countdown" && race.state === "racing") {
      goVisible = true;
      setTimeout(() => { goVisible = false; }, 780);
    }
    if (race.state === "lobby") {
      winnerVisible = false;
      winnerText = "";
    }
  }

  function handleWinner(message) {
    winnerText = `🏆 ${message.name} wins! ${(message.timeMs / 1000).toFixed(2)}s`;
    winnerVisible = true;
  }

  function authenticate(key) {
    if (!authSession.authenticate(key)) authStatus = "Connecting… try again shortly.";
  }

  function connect() {
    clearTimeout(reconnectTimer);
    ws = new WebSocket(wsUrl());
    ws.addEventListener("open", () => {
      authSession.reconnect();
    });
    ws.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "presenterAuth") {
        authorized = message.ok;
        authStatus = message.message;
        if (!message.ok) authSession.clear();
      } else if (message.type === "gameState") {
        handleGameState(message);
      } else if (message.type === "winner") {
        handleWinner(message);
      } else if (message.type === "serverError") {
        authStatus = message.message;
      }
    });
    ws.addEventListener("close", () => {
      authorized = false;
      reconnectTimer = setTimeout(connect, 900);
    });
  }

  onMount(() => {
    document.body.className = "race-page";
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(countdownTimer);
      ws?.close();
    };
  });
</script>

<header class="race-header">
  <div>
    <div class="eyebrow">WELLBEING MOMENT</div>
    <h1>Swim Tap Race 🏊</h1>
    <p>Live · connected to race</p>
    <p>Players: open this site on your phone and join the race.</p>
  </div>
  <JoinCode />
  <PresenterControls {authorized} {authStatus} {startDisabled} onAuthenticate={authenticate} onCommand={send} />
</header>

<main class="race-main">
  <RaceBoard {race} {players} countdown={countdownValue} {goVisible} winnerText={winnerVisible ? winnerText : ''} />
  <ResultsDialog {race} {players} onDismiss={() => { if (authorized) send('presenter:reset'); }} />
</main>

<footer class="race-footer">
  <span>{players.length} swimmer{players.length === 1 ? "" : "s"}</span>
  <span>Tap to Swim.</span>
</footer>

<script>
  import { createPresenterSession } from "./presenter-session.js";
  import { motionDuration } from "./swimmer-motion.js";
  import { onMount } from "svelte";
  import JoinCode from "./components/JoinCode.svelte";
  import PresenterControls from "./components/PresenterControls.svelte";
  import RaceBoard from "./components/RaceBoard.svelte";
  import ResultsDialog from "./components/ResultsDialog.svelte";
  import WellbeingFacts from "./components/WellbeingFacts.svelte";

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
  let wellbeingDialog;

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
    <button class="wellbeing-button" type="button" on:click={() => wellbeingDialog.showModal()}>8 benefits of swimming</button>
  </div>
  <JoinCode />
  <PresenterControls {authorized} {authStatus} {startDisabled} onAuthenticate={authenticate} onCommand={send} />
</header>

<dialog bind:this={wellbeingDialog} aria-labelledby="presenter-wellbeing-title">
  <button class="dialog-close" type="button" aria-label="Close wellbeing facts" on:click={() => wellbeingDialog.close()}>×</button>
  <WellbeingFacts titleId="presenter-wellbeing-title" />
  <button class="primary dialog-done" type="button" on:click={() => wellbeingDialog.close()}>Back to the race</button>
</dialog>

<main class="race-main">
  <RaceBoard {race} {players} countdown={countdownValue} {goVisible} />
  <ResultsDialog {race} {players} onDismiss={() => { if (authorized) send('presenter:reset'); }} />
</main>

<footer class="race-footer">
  <span>{players.length} swimmer{players.length === 1 ? "" : "s"}</span>
  <span>Tap to Swim.</span>
</footer>

<style>
  .race-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--space-6); padding: 28px 36px 18px; }
  h1 { margin: 4px 0; font-size: clamp(36px, 5vw, 68px); }
  .race-header p { color: var(--muted); margin: 0; }
  .wellbeing-button { min-height: 36px; margin-top: 12px; padding: 7px 12px; border: 1px solid #ffffff29; border-radius: 10px; background: #16496a; color: var(--accent-2); font-size: 14px; }
  .wellbeing-button:hover { background: #1b577d; text-decoration: underline; }
  dialog { width: min(720px, calc(100% - 28px)); max-height: calc(100dvh - 40px); padding: 30px 24px; border: 4px solid var(--accent-2); background: var(--panel); color: var(--text); box-shadow: 8px 8px 0 #031522; }
  dialog::backdrop { background: #021422dd; }
  .dialog-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; padding: 0; border-radius: 0; background: #1b5271; color: white; font-size: 30px; }
  .dialog-done { width: 100%; margin-top: 22px; }
  .race-main { padding: 12px 36px 24px; }
  .race-footer { display: flex; justify-content: space-between; gap: var(--space-4); padding: 14px 36px 22px; color: var(--muted); font-weight: 700; }
  @media (max-width: 760px) { .race-header { grid-template-columns: minmax(0, 1fr); padding: 20px; } .race-main { padding: 8px 20px 20px; } .race-footer { padding: 12px 20px 20px; } }
</style>

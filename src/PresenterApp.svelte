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
  let currentLobbyName = "";
  let countdownValue = null;
  let goVisible = false;
  let wellbeingDialog;
  let room = new URLSearchParams(location.search).get("room") || "";
  let masterKey = "";
  let newSessionKey = "";
  let lobbyName = "";
  let createStatus = "";
  let pendingCreation = null;

  $: startDisabled = !authorized || race?.state !== "lobby" || players.length < 1;

  function wsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`${protocol}//${location.host}/api/ws`);
    const activeRoom = room || pendingCreation?.room;
    if (activeRoom) url.searchParams.set("room", activeRoom);
    return url.href;
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
    currentLobbyName = message.lobbyName || "";
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

  function createLobby() {
    if (!lobbyName.trim() || !masterKey || !newSessionKey) { createStatus = "Enter a lobby name, master code and session key."; return; }
    createStatus = "Creating lobby…";
    pendingCreation = {
      room: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
      masterKey,
      sessionKey: newSessionKey,
      lobbyName: lobbyName.trim()
    };
    connect();
  }

  function connect() {
    clearTimeout(reconnectTimer);
    ws = new WebSocket(wsUrl());
    ws.addEventListener("open", () => {
      if (pendingCreation) send("session:create", pendingCreation);
      else authSession.reconnect();
    });
    ws.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "presenterAuth") {
        authorized = message.ok;
        authStatus = message.message;
        if (!message.ok) authSession.clear();
      } else if (message.type === "sessionCreated") {
        if (message.ok) {
          const key = pendingCreation.sessionKey;
          room = pendingCreation.room;
          history.replaceState(null, "", `/race?room=${encodeURIComponent(room)}`);
          pendingCreation = null;
          masterKey = "";
          createStatus = "Lobby created.";
          authSession.authenticate(key);
          newSessionKey = "";
        } else {
          createStatus = message.message;
          pendingCreation = null;
          ws.close();
        }
      } else if (message.type === "gameState") {
        handleGameState(message);
      } else if (message.type === "serverError") {
        authStatus = message.message;
      }
    });
    ws.addEventListener("close", () => {
      authorized = false;
      if (pendingCreation) createStatus = "Could not connect. Retrying…";
      if (room || pendingCreation) reconnectTimer = setTimeout(connect, 900);
    });
  }

  onMount(() => {
    document.body.className = "race-page";
    if (room) connect();
    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(countdownTimer);
      ws?.close();
    };
  });
</script>

{#if !room}
<main class="create-shell">
  <section class="card create-card">
    <div class="eyebrow">CREATE A LOBBY</div>
    <h1>Start a Swim Tap Race 🏊</h1>
    <p>Create a private lobby, then share its QR code with your swimmers.</p>
    <form on:submit|preventDefault={createLobby}>
      <label for="lobbyName">Lobby name</label>
      <input id="lobbyName" maxlength="40" bind:value={lobbyName} placeholder="e.g. Friday wellbeing session" required />
      <label for="masterKey">Master code</label>
      <input id="masterKey" type="password" autocomplete="current-password" bind:value={masterKey} required />
      <label for="sessionKey">Choose a session key</label>
      <input id="sessionKey" type="password" autocomplete="new-password" maxlength="256" bind:value={newSessionKey} required />
      <button class="primary" type="submit" disabled={!!pendingCreation}>{pendingCreation ? "Creating lobby…" : "Create lobby"}</button>
      <p class="create-status" role="status">{createStatus}</p>
    </form>
  </section>
</main>
{:else}
<header class="race-header">
  <div>
    <div class="eyebrow">WELLBEING MOMENT</div>
    <h1>Swim Tap Race 🏊</h1>
    <p>Live · {currentLobbyName || "connected to race"}</p>
    <p>Players: open this site on your phone and join the race.</p>
  </div>
  <JoinCode {room} />
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
  <button class="wellbeing-button" type="button" on:click={() => wellbeingDialog.showModal()}>8 benefits of swimming</button>
  <span>Tap to Swim.</span>
</footer>
{/if}

<style>
  .race-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--space-6); padding: 28px 36px 18px; }
  .create-shell { min-height: 100dvh; display: grid; place-items: center; padding: 20px; }
  .create-card { width: min(100%, 520px); }
  .create-card h1 { font-size: clamp(32px, 7vw, 52px); }
  .create-card form { display: grid; gap: 12px; margin-top: 24px; }
  .create-status { min-height: 1.5em; color: var(--muted); }
  h1 { margin: 4px 0; font-size: clamp(36px, 5vw, 68px); }
  .race-header p { color: var(--muted); margin: 0; }
  .wellbeing-button { min-height: 28px; padding: 2px 7px; background: transparent; color: var(--muted); font-size: 12px; }
  .wellbeing-button:hover { color: var(--accent-2); text-decoration: underline; }
  dialog { width: min(720px, calc(100% - 28px)); max-height: calc(100dvh - 40px); padding: 30px 24px; border: 4px solid var(--accent-2); background: var(--panel); color: var(--text); box-shadow: 8px 8px 0 #031522; }
  dialog::backdrop { background: #021422dd; }
  .dialog-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; padding: 0; border-radius: 0; background: #1b5271; color: white; font-size: 30px; }
  .dialog-done { width: 100%; margin-top: 22px; }
  .race-main { padding: 12px 36px 24px; }
  .race-footer { display: flex; justify-content: space-between; gap: var(--space-4); padding: 14px 36px 22px; color: var(--muted); font-weight: 700; }
  @media (max-width: 760px) { .race-header { grid-template-columns: minmax(0, 1fr); padding: 20px; } .race-main { padding: 8px 20px 20px; } .race-footer { padding: 12px 20px 20px; } }
</style>

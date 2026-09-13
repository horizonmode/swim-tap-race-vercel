<script>
  import { onMount } from "svelte";
  import qrcode from "qrcode-generator";
  import { createResults } from "../results.js";
  import { normalizeSwimmer, swimmerMarkup } from "../swimmers.js";

  let presenterLogin;
  let raceMain;
  let joinQr;
  let joinLink;
  let joinHint;
  let networkChoice;
  let joinNetwork;
  let presenterKey = "";
  let authStatus = "";
  let authorized = false;
  let ws;
  let reconnectTimer;
  let countdownTimer;
  let results;
  let race = null;
  let players = [];
  let previousRaceState = null;
  let countdownValue = null;
  let goVisible = false;
  let winnerText = "";
  let winnerVisible = false;

  const capColors = ["#ff5f6d", "#ffd166", "#7bdff2", "#b2f7ef", "#cdb4db", "#ff9f1c", "#80ed99", "#f15bb5", "#9b5de5", "#00bbf9"];

  $: compact = players.length > 10;
  $: startDisabled = !authorized || race?.state !== "lobby" || players.length < 1;

  function capColor(player) {
    let hash = 0;
    for (const character of player.id) hash = ((hash << 5) - hash) + character.charCodeAt(0);
    return capColors[Math.abs(hash) % capColors.length];
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

  function handleGameState(message) {
    const previousState = race?.state;
    race = message.race;
    players = message.players;
    results?.({ race, players });

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
    previousRaceState = race.state;
  }

  function handleWinner(message) {
    winnerText = `🏆 ${message.name} wins! ${(message.timeMs / 1000).toFixed(2)}s`;
    winnerVisible = true;
  }

  async function showJoinCode() {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    let urls = [new URL("/", location.href).href];
    if (loopback) {
      joinHint.textContent = "Connect your phone to the same Wi-Fi as this computer.";
      try {
        const response = await fetch("/api/join-info");
        if (!response.ok) throw new Error("Network address unavailable");
        const info = await response.json();
        if (!info.urls?.length) throw new Error("No network connection");
        urls = info.urls;
      } catch {
        joinHint.textContent = "Connect this computer to Wi-Fi, then refresh to get a phone-accessible QR code.";
        return;
      }
    }

    const render = (url) => {
      joinLink.href = url;
      joinLink.textContent = url;
      try {
        const code = qrcode(0, "M");
        code.addData(url);
        code.make();
        joinQr.innerHTML = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
      } catch {
        joinHint.textContent = "Open the link below on your phone to join.";
      }
    };

    joinNetwork.replaceChildren(...urls.map(url => new Option(url, url)));
    if (urls.length > 1) {
      networkChoice.classList.remove("hidden");
      joinHint.textContent = "Use the same Wi-Fi. If scanning fails, try another network address below.";
    }
    joinNetwork.addEventListener("change", () => render(joinNetwork.value));
    render(urls[0]);
  }

  function authenticate(event) {
    event.preventDefault();
    if (!send("presenter:auth", { key: presenterKey })) authStatus = "Connecting… try again shortly.";
    presenterKey = "";
  }

  function connect() {
    clearTimeout(reconnectTimer);
    ws = new WebSocket(wsUrl());
    ws.addEventListener("open", () => {
      if (presenterKey) send("presenter:auth", { key: presenterKey });
    });
    ws.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "presenterAuth") {
        authorized = message.ok;
        authStatus = message.message;
        if (!message.ok) presenterKey = "";
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
    results = createResults(raceMain, { onDismiss: () => { if (authorized) send("presenter:reset"); } });
    showJoinCode();
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
  <aside class="join-panel" aria-label="Join the race">
    <div bind:this={joinQr} class="join-qr" role="img" aria-label="QR code to join the race"></div>
    <div>
      <strong>Scan to join</strong>
      <p bind:this={joinHint}>Open the camera on your phone.</p>
      <a bind:this={joinLink} href="/" aria-label="Player join link"></a>
      <label bind:this={networkChoice} class="hidden">Network address
        <select bind:this={joinNetwork} aria-label="Network address"></select>
      </label>
    </div>
  </aside>
  <div class="presenter-controls">
    {#if !authorized}
      <form bind:this={presenterLogin} class="presenter-login" on:submit={authenticate}>
        <label for="presenterKey">Presenter key</label>
        <input id="presenterKey" type="password" autocomplete="current-password" maxlength="256" bind:value={presenterKey} required>
        <button type="submit">Unlock controls</button>
        <p role="status">{authStatus}</p>
      </form>
    {:else}
      <div class="presenter-actions">
        <button class="primary" type="button" disabled={startDisabled} on:click={() => send("presenter:start")}>Start race</button>
        <button type="button" on:click={() => send("presenter:reset")}>Reset</button>
        <button type="button" on:click={() => confirm("Remove all swimmers from the lobby?") && send("presenter:clear")}>Clear players</button>
      </div>
    {/if}
  </div>
</header>

<main bind:this={raceMain} class="race-main">
  <section class="scoreboard">
    {#if countdownValue}
      <div class="countdown">{countdownValue}</div>
    {/if}
    {#if goVisible}
      <div class="go-burst show">GO!</div>
    {/if}
    {#if winnerVisible}
      <div class="winner">{winnerText}</div>
    {/if}
    <div class:compact class="lanes">
      {#if players.length === 0}
        <div class="empty-state">Waiting for swimmers to join…</div>
      {:else}
        {#each players as player (player.id)}
          <div class="lane">
            <div class="lane-name"><span class="lane-name-dot" style={`background:${capColor(player)}`}></span><span class="swimmer-name">{player.name}</span></div>
            <div class="track" style={`--cap-color:${capColor(player)}`}>
              <span class="track-player-name">{player.name}</span>
              <div class="swimmer-wrap" class:moving={race?.state === "racing" && player.distance > 0} aria-hidden="true" style={`left:calc(${Math.max(0, Math.min(100, player.distance))}% - ${Math.max(0, Math.min(100, player.distance)) * 0.72}px)`}>
                <span class="splash"></span>{@html swimmerMarkup(normalizeSwimmer(player.swimmer))}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </section>
</main>

<footer class="race-footer">
  <span>{players.length} swimmer{players.length === 1 ? "" : "s"}</span>
  <span>Tap to Swim.</span>
</footer>

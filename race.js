import { createResults } from "./results.js";
import { normalizeSwimmer, swimmerMarkup } from "./swimmers.js";
const connectionStatus = document.getElementById("connectionStatus");
const lanes = document.getElementById("lanes");
const playerCount = document.getElementById("playerCount");
const countdown = document.getElementById("countdown");
const goBurst = document.getElementById("goBurst");
const winnerBanner = document.getElementById("winnerBanner");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const scoreboard = document.querySelector(".scoreboard");

const updateResults = createResults(document.querySelector(".race-main"), {
  onDismiss: () => { if (presenterAuthorized) send("presenter:reset"); }
});

const presenterLogin = document.getElementById("presenterLogin");
const presenterActions = document.getElementById("presenterActions");
const presenterKeyInput = document.getElementById("presenterKey");
const presenterAuthStatus = document.getElementById("presenterAuthStatus");
let presenterAuthorized = false;
let presenterKey = ""; // Retained only in this page's memory for reconnects.
let latestPlayerCount = 0;
function updateControls() {
  startBtn.disabled = !presenterAuthorized || latestRace?.state !== "lobby" || latestPlayerCount < 1;
  resetBtn.disabled = clearBtn.disabled = !presenterAuthorized;
}
presenterLogin.addEventListener("submit", event => {
  event.preventDefault();
  presenterKey = presenterKeyInput.value;
  presenterKeyInput.value = "";
  if (!send("presenter:auth", { key: presenterKey })) presenterAuthStatus.textContent = "Connecting… try again shortly.";
});
let latestRace = null;
let previousRaceState = null;
let countdownTimer = null;
let previousDistances = new Map();
const laneElements = new Map();
const strokeTimers = new Map();

const capColors = [
  "#ff5f6d", "#ffd166", "#7bdff2", "#b2f7ef", "#cdb4db",
  "#ff9f1c", "#80ed99", "#f15bb5", "#9b5de5", "#00bbf9"
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function capColorFor(player) {
  return capColors[hashString(player.id || player.name) % capColors.length];
}

startBtn.addEventListener("click", () => send("presenter:start"));
resetBtn.addEventListener("click", () => send("presenter:reset"));
clearBtn.addEventListener("click", () => {
  if (confirm("Remove all swimmers from the lobby?")) {
    send("presenter:clear");
  }
});

function renderPlayers(players, raceState) {
  playerCount.textContent = `${players.length} swimmer${players.length === 1 ? "" : "s"}`;
  lanes.classList.toggle("compact", players.length > 10);

  if (!players.length) {
    lanes.innerHTML = '<div class="empty-state">Waiting for swimmers to join…</div>';
    previousDistances.clear();
    laneElements.clear();
    strokeTimers.forEach(clearTimeout);
    strokeTimers.clear();
    return;
  }

  if (!laneElements.size) lanes.innerHTML = "";
  const activeIds = new Set(players.map(p => p.id));
  for (const [id, lane] of laneElements) {
    if (!activeIds.has(id)) {
      lane.remove();
      laneElements.delete(id);
      previousDistances.delete(id);
      clearTimeout(strokeTimers.get(id));
      strokeTimers.delete(id);
    }
  }

  players.forEach((p, index) => {
    let lane = laneElements.get(p.id);
    if (!lane) {
      lane = document.createElement("div");
      lane.className = "lane";
      lane.innerHTML = `<div class="lane-name"><span class="lane-name-dot"></span><span class="swimmer-name"></span></div>
        <div class="track"><span class="track-player-name"></span><div class="swimmer-wrap" aria-hidden="true">
          <span class="splash"></span>
          ${swimmerMarkup(p.swimmer)}
        </div></div>`;
      lane.dataset.swimmer = normalizeSwimmer(p.swimmer);
      laneElements.set(p.id, lane);
    }
    lane.querySelector(".swimmer-name").textContent = p.name;
    lane.querySelector(".track-player-name").textContent = p.name;
    lane.querySelector(".lane-name-dot").style.background = capColorFor(p);
    lane.style.setProperty("--cap-color", capColorFor(p));
    const swimmer = lane.querySelector(".swimmer-wrap");
    if (lane.dataset.swimmer !== normalizeSwimmer(p.swimmer)) {
      swimmer.querySelector(".pixel-swimmer").outerHTML = swimmerMarkup(p.swimmer);
      lane.dataset.swimmer = normalizeSwimmer(p.swimmer);
    }
    const previous = previousDistances.get(p.id) ?? p.distance;
    if (raceState === "racing" && p.distance > previous) {
      swimmer.classList.add("moving");
      clearTimeout(strokeTimers.get(p.id));
      strokeTimers.set(p.id, setTimeout(() => {
        swimmer.classList.remove("moving");
        strokeTimers.delete(p.id);
      }, 420));
    } else if (raceState !== "racing") {
      swimmer.classList.remove("moving");
      clearTimeout(strokeTimers.get(p.id));
      strokeTimers.delete(p.id);
    }
    const progress = Math.max(0, Math.min(100, p.distance));
    swimmer.style.left = `calc(${progress}% - ${progress * 0.72}px)`;
    // Preserve each swimmer's animation and movement transition between updates.
    if (lanes.children[index] !== lane) lanes.insertBefore(lane, lanes.children[index] || null);

    previousDistances.set(p.id, p.distance);
  });
}

function startCountdownClock() {
  clearInterval(countdownTimer);

  const tick = () => {
    if (!latestRace || latestRace.state !== "countdown") {
      countdown.classList.add("hidden");
      clearInterval(countdownTimer);
      return;
    }

    const remaining = Math.max(0, latestRace.countdownEndsAt - Date.now());
    const value = Math.max(1, Math.ceil(remaining / 1000));
    countdown.textContent = value;
    countdown.classList.remove("hidden");
  };

  tick();
  countdownTimer = setInterval(tick, 100);
}

function flashGo() {
  goBurst.classList.remove("hidden", "show");
  void goBurst.offsetWidth;
  goBurst.classList.add("show");
  setTimeout(() => {
    goBurst.classList.remove("show");
    goBurst.classList.add("hidden");
  }, 780);
}

function launchConfetti() {
  scoreboard.querySelectorAll(".confetti-piece").forEach(el => el.remove());
  const colors = ["#ff5f6d", "#ffd166", "#7bdff2", "#80ed99", "#f15bb5", "#ffffff"];

  for (let i = 0; i < 55; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * .35}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    scoreboard.appendChild(piece);
    setTimeout(() => piece.remove(), 2400);
  }
}


let ws;
let reconnectTimer;

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

function handleGameState({ race, players }) {
  updateResults({ race, players });
  connectionStatus.textContent = "Live · connected to race";
  latestRace = race;
  renderPlayers(players, race.state);

  latestPlayerCount = players.length;
  updateControls();

  if (race.state === "countdown") {
    winnerBanner.classList.add("hidden");
    winnerBanner.classList.remove("celebrate");
    startCountdownClock();
  } else {
    countdown.classList.add("hidden");
  }

  if (previousRaceState === "countdown" && race.state === "racing") {
    flashGo();
  }

  if (race.state === "lobby") {
    winnerBanner.classList.add("hidden");
    winnerBanner.classList.remove("celebrate");
    scoreboard.querySelectorAll(".confetti-piece").forEach((el) => el.remove());
  }

  previousRaceState = race.state;
}

function handleWinner({ name, timeMs }) {
  const seconds = (timeMs / 1000).toFixed(2);
  winnerBanner.textContent = `🏆 ${name} wins!  ${seconds}s`;
  winnerBanner.classList.remove("hidden");
  winnerBanner.classList.remove("celebrate");
  void winnerBanner.offsetWidth;
  winnerBanner.classList.add("celebrate");
  launchConfetti();
}

function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(wsUrl());

  ws.addEventListener("open", () => {
    startBtn.title = "";
    if (presenterKey) send("presenter:auth", { key: presenterKey });
  });

  ws.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "presenterAuth") {
      presenterAuthorized = message.ok;
      presenterAuthStatus.textContent = message.message;
      presenterLogin.classList.toggle("hidden", presenterAuthorized);
      presenterActions.classList.toggle("hidden", !presenterAuthorized);
      if (!message.ok) presenterKey = "";
      updateControls();
    }
    if (message.type === "serverError") {
      connectionStatus.textContent = message.message;
      startBtn.disabled = true;
    }
    if (message.type === "gameState") handleGameState(message);
    if (message.type === "winner") handleWinner(message);
  });

  ws.addEventListener("close", () => {
    presenterAuthorized = false;
    presenterActions.classList.add("hidden");
    updateControls();
    startBtn.title = "Reconnecting to the race server";
    if (!connectionStatus.textContent.includes("setup")) connectionStatus.textContent = "Reconnecting to race…";
    reconnectTimer = setTimeout(connect, 900);
  });
}

connect();

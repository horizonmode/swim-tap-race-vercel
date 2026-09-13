const lanes = document.getElementById("lanes");
const playerCount = document.getElementById("playerCount");
const countdown = document.getElementById("countdown");
const goBurst = document.getElementById("goBurst");
const winnerBanner = document.getElementById("winnerBanner");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const scoreboard = document.querySelector(".scoreboard");

let latestRace = null;
let previousRaceState = null;
let countdownTimer = null;
let previousDistances = new Map();

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

  if (!players.length) {
    lanes.innerHTML = '<div class="empty-state">Waiting for swimmers to join…</div>';
    previousDistances.clear();
    return;
  }

  const sorted = [...players].sort((a, b) => b.distance - a.distance);
  lanes.innerHTML = "";

  sorted.forEach((p, index) => {
    const lane = document.createElement("div");
    lane.className = "lane";

    const name = document.createElement("div");
    name.className = "lane-name";

    const rank = document.createElement("span");
    rank.className = "lane-rank";
    rank.textContent = index + 1;

    const dot = document.createElement("span");
    dot.className = "lane-name-dot";
    dot.style.background = capColorFor(p);

    const nameText = document.createElement("span");
    nameText.textContent = p.name;

    name.append(rank, dot, nameText);

    const track = document.createElement("div");
    track.className = "track";

    const swimmer = document.createElement("div");
    swimmer.className = "swimmer-wrap";

    const previous = previousDistances.get(p.id) ?? p.distance;
    if (raceState === "racing" && p.distance > previous) {
      swimmer.classList.add("moving");
    }

    const splash = document.createElement("span");
    splash.className = "splash";

    const emoji = document.createElement("span");
    emoji.className = "swimmer-emoji";
    emoji.textContent = "🏊";

    const cap = document.createElement("span");
    cap.className = "swimmer-cap";
    cap.style.background = capColorFor(p);

    const progress = Math.max(0, Math.min(100, p.distance));
    swimmer.style.left = `calc(${progress}% - ${progress * 0.62}px)`;
    swimmer.append(splash, emoji, cap);

    track.appendChild(swimmer);
    lane.append(name, track);
    lanes.appendChild(lane);

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
  latestRace = race;
  renderPlayers(players, race.state);

  startBtn.disabled = race.state !== "lobby" || players.length < 1;

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
  });

  ws.addEventListener("message", (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "gameState") handleGameState(message);
    if (message.type === "winner") handleWinner(message);
  });

  ws.addEventListener("close", () => {
    startBtn.disabled = true;
    startBtn.title = "Reconnecting to the race server";
    reconnectTimer = setTimeout(connect, 900);
  });
}

connect();

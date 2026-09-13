import { createResults } from "./results.js";
import { swimmerOptions, normalizeSwimmer, swimmerMarkup } from "./swimmers.js";
const joinCard = document.getElementById("joinCard");
const gameCard = document.getElementById("gameCard");
const joinForm = document.getElementById("joinForm");
const nameInput = document.getElementById("name");
const joinError = document.getElementById("joinError");
const playerName = document.getElementById("playerName");
const raceStatus = document.getElementById("raceStatus");
const tapButton = document.getElementById("tapButton");
const hint = document.getElementById("hint");
const miniSwimmer = document.getElementById("miniSwimmer");

const updateResults = createResults(gameCard);

const playerId = sessionStorage.getItem("swim-player-id") || crypto.randomUUID();
sessionStorage.setItem("swim-player-id", playerId);
const playerToken = sessionStorage.getItem("swim-player-token") || crypto.randomUUID();
sessionStorage.setItem("swim-player-token", playerToken);

let myId = null;
let joinedName = "";
let selectedSwimmer = normalizeSwimmer(sessionStorage.getItem("swim-character"));
let strokeTimer;
let lastDistance = 0;
function renderMySwimmer(character) {
  miniSwimmer.innerHTML = `<span class="splash"></span>${swimmerMarkup(character)}`;
  miniSwimmer.dataset.swimmer = normalizeSwimmer(character);
}
function animateStroke() {
  miniSwimmer.classList.add("moving");
  clearTimeout(strokeTimer);
  strokeTimer = setTimeout(() => miniSwimmer.classList.remove("moving"), 420);
}

const choices = document.getElementById("swimmerChoices");
for (const option of swimmerOptions) {
  const label = document.createElement("label");
  label.className = "swimmer-choice";
  label.innerHTML = `<input type="radio" name="swimmer" value="${option.id}"><span class="swimmer-option"><span aria-hidden="true">${swimmerMarkup(option.id)}</span><span>${option.name}</span></span>`;
  const radio = label.querySelector("input");
  radio.checked = option.id === selectedSwimmer;
  radio.addEventListener("change", () => {
    selectedSwimmer = radio.value;
    sessionStorage.setItem("swim-character", selectedSwimmer);
    renderMySwimmer(selectedSwimmer);
  });
  choices.appendChild(label);
}
renderMySwimmer(selectedSwimmer);
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
      joinError.textContent = message.message;
      hint.textContent = message.message;
      tapButton.disabled = true;
      return;
    }

    if (message.type === "joinResult") {
      if (!message.ok) {
        joinError.textContent = message.message || "Could not join.";
        return;
      }
      joinError.textContent = "";
      myId = message.id;
      playerName.textContent = joinedName;
      joinCard.classList.add("hidden");
      gameCard.classList.remove("hidden");
      return;
    }

    if (message.type === "gameState") {
      const { race, players } = message;
      if (!myId) return;
      updateResults({ race, players }, myId);
      const me = players.find((p) => p.id === myId);
      if (!me) {
        myId = null;
        joinedName = "";
        tapButton.disabled = true;
        gameCard.classList.add("hidden");
        joinCard.classList.remove("hidden");
        hint.textContent = "Join the next race.";
        return;
      }

      const character = normalizeSwimmer(me.swimmer);
      if (miniSwimmer.dataset.swimmer !== character) {
        renderMySwimmer(character);
      }
      if (race.state === "racing" && me.distance > lastDistance) {
        animateStroke();
      } else if (race.state !== "racing") {
        clearTimeout(strokeTimer);
        miniSwimmer.classList.remove("moving");
      }
      lastDistance = me.distance;
      const progress = Math.max(0, Math.min(100, me.distance));
      miniSwimmer.style.left = `calc(${progress}% - ${progress * 0.72}px)`;

      if (race.state === "lobby") {
        raceStatus.textContent = "Waiting";
        hint.textContent = "Wait for the presenter to start the race.";
        tapButton.disabled = true;
        tapButton.textContent = "GET READY";
      } else if (race.state === "countdown") {
        raceStatus.textContent = "Get ready!";
        hint.textContent = "3… 2… 1…";
        tapButton.disabled = true;
        tapButton.textContent = "READY?";
      } else if (race.state === "racing") {
        raceStatus.textContent = "GO!";
        hint.textContent = "Tap as fast as you can.";
        tapButton.disabled = false;
        tapButton.textContent = "TAP TO SWIM";
      } else if (race.state === "finished") {
        const won = race.winnerId === myId;
        raceStatus.textContent = won ? "YOU WIN!" : "Finished";
        hint.textContent = won ? "🏆 Lane legend!" : "Race over — nice swimming.";
        tapButton.disabled = true;
        tapButton.textContent = won ? "🏆 WINNER!" : "RACE OVER";
      }
      return;
    }

    if (message.type === "winner" && message.id === myId && navigator.vibrate) {
      navigator.vibrate([80, 40, 80, 40, 160]);
    }
  });

  ws.addEventListener("close", () => {
    tapButton.disabled = true;
    raceStatus.textContent = "Reconnecting…";
    reconnectTimer = setTimeout(connect, 900);
  });
}

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  joinError.textContent = "";
  joinedName = nameInput.value.trim();
  if (!joinedName) {
    joinError.textContent = "Enter a name first.";
    return;
  }
  if (!send("join", { playerId, playerToken, name: joinedName, swimmer: selectedSwimmer })) {
    joinError.textContent = "Connecting… try again in a moment.";
  }
});

tapButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (!tapButton.disabled && send("tap")) animateStroke();
});

connect();

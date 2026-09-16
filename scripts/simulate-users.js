import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

try { loadEnvFile(); } catch (error) {
    if (error.code !== "ENOENT") throw error;
}

const swimmers = ["human", "woman", "cat", "cat-bw", "dog", "frog", "duck"];
const options = parseArgs(process.argv.slice(2));
const sockets = new Set();
const timers = new Set();
let joined = 0;
let failed = 0;
let raceState = "unknown";
let finished = false;

function parseArgs(args) {
    const values = {
        users: 10,
        duration: 30,
        tapInterval: 140,
        tapJitter: 35,
        joinDelay: 40,
        url: "ws://localhost:3000/api/ws",
        reset: false,
        start: false
    };

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--start") values.start = true;
        else if (arg === "--reset") values.reset = true;
        else if (arg.startsWith("--users=")) values.users = numberOption(arg, "--users=", 1, 50);
        else if (arg.startsWith("--duration=")) values.duration = numberOption(arg, "--duration=", 0, 3600);
        else if (arg.startsWith("--tap-interval=")) values.tapInterval = numberOption(arg, "--tap-interval=", 55, 60000);
        else if (arg.startsWith("--tap-jitter=")) values.tapJitter = numberOption(arg, "--tap-jitter=", 0, 30000);
        else if (arg.startsWith("--join-delay=")) values.joinDelay = numberOption(arg, "--join-delay=", 0, 60000);
        else if (arg.startsWith("--url=")) values.url = arg.slice("--url=".length);
        else if (arg === "--help" || arg === "-h") printHelp(0);
        else printHelp(1, `Unknown option: ${arg}`);
    }

    return values;
}

function numberOption(arg, prefix, minimum, maximum) {
    const value = Number(arg.slice(prefix.length));
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        printHelp(1, `${prefix.slice(0, -1)} must be an integer from ${minimum} to ${maximum}.`);
    }
    return value;
}

function printHelp(exitCode, error) {
    if (error) console.error(error);
    console.log(`Usage: node scripts/simulate-users.js [options]

Options:
  --users=N          Simulated players, 1-50 (default: 10)
  --duration=N       Run time in seconds; 0 runs until Ctrl+C (default: 30)
    --tap-interval=N   Average milliseconds between taps (default: 140)
    --tap-jitter=N     Random variation around the average (default: 35)
  --join-delay=N     Milliseconds between joins (default: 40)
  --url=URL          WebSocket endpoint (default: localhost)
  --reset            Reset the race to the lobby before joining
  --start            Start the race after all players join; uses MASTER_CODE for the legacy room
  --help             Show this help

Examples:
  node scripts/simulate-users.js --users=25 --duration=60 --start
  node scripts/simulate-users.js --users=25 --reset --start
  node scripts/simulate-users.js --users=50 --tap-interval=300
`);
    process.exit(exitCode);
}

function schedule(callback, delay) {
    const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
    }, delay);
    timers.add(timer);
    return timer;
}

function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function originFor(url) {
    return new URL(url).origin.replace("ws:", "http:").replace("wss:", "https:");
}

function presenterSocket() {
    return new WebSocket(options.url, { headers: { origin: originFor(options.url) } });
}

function resetRace() {
    if (!process.env.MASTER_CODE) {
        throw new Error("--reset requires MASTER_CODE in the environment or .env");
    }

    return new Promise((resolve, reject) => {
        const presenter = presenterSocket();
        let resetSent = false;
        const timeout = setTimeout(() => {
            presenter.close();
            reject(new Error("timed out resetting the race"));
        }, 5000);
        sockets.add(presenter);

        presenter.on("open", () => send(presenter, { type: "presenter:auth", key: process.env.MASTER_CODE }));
        presenter.on("message", raw => {
            let message;
            try { message = JSON.parse(raw); } catch { return; }
            if (message.type === "presenterAuth" && message.ok && !resetSent) {
                resetSent = true;
                send(presenter, { type: "presenter:reset" });
            } else if (message.type === "presenterAuth" && !message.ok) {
                clearTimeout(timeout);
                presenter.close();
                reject(new Error("presenter authentication failed while resetting"));
            }
            if (resetSent && message.type === "gameState" && message.race.state === "lobby") {
                clearTimeout(timeout);
                presenter.close();
                resolve();
            }
        });
        presenter.on("error", error => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function connectPlayer(index) {
    const ws = new WebSocket(options.url, {
        headers: { origin: new URL(options.url).origin.replace("ws:", "http:").replace("wss:", "https:") }
    });
    sockets.add(ws);
    const playerToken = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`.slice(0, 64);
    const playerId = `load-${index}-${randomUUID().slice(0, 8)}`;

    ws.on("open", () => {
        send(ws, {
            type: "join",
            playerId,
            playerToken,
            name: `Load ${index}`,
            swimmer: swimmers[(index - 1) % swimmers.length]
        });
        scheduleTap();
    });

    ws.on("message", raw => {
        let message;
        try { message = JSON.parse(raw); } catch { return; }
        if (message.type === "joinResult") {
            if (message.ok) {
                joined++;
                console.log(`joined ${joined}/${options.users}`);
                if (joined === options.users) maybeStartRace();
            } else {
                failed++;
                console.error(`player ${index} rejected: ${message.message}`);
            }
        }
        if (message.type === "gameState") raceState = message.race.state;
        if (message.type === "serverError") failed++;
    });

    ws.on("close", () => sockets.delete(ws));
    ws.on("error", error => {
        failed++;
        console.error(`player ${index} connection error: ${error.message}`);
    });

    let tapTimer;
    const scheduleTap = () => {
        if (finished || ws.readyState !== WebSocket.OPEN) return;
        const jitter = (Math.random() * 2 - 1) * options.tapJitter;
        const delay = Math.max(55, options.tapInterval + jitter);
        tapTimer = setTimeout(() => {
            timers.delete(tapTimer);
            send(ws, { type: "tap" });
            scheduleTap();
        }, delay);
        timers.add(tapTimer);
    };
    ws.on("close", () => {
        clearTimeout(tapTimer);
        timers.delete(tapTimer);
    });
}

function maybeStartRace() {
    if (!options.start) {
        console.log(`all players joined; start the race manually or rerun with --start`);
        return;
    }
    if (!process.env.MASTER_CODE) {
        console.error("--start requires MASTER_CODE in the environment or .env");
        return;
    }
    const presenter = presenterSocket();
    sockets.add(presenter);
    presenter.on("open", () => send(presenter, { type: "presenter:auth", key: process.env.MASTER_CODE }));
    presenter.on("message", raw => {
        let message;
        try { message = JSON.parse(raw); } catch { return; }
        if (message.type === "presenterAuth" && message.ok) send(presenter, { type: "presenter:start" });
        if (message.type === "presenterAuth" && !message.ok) console.error("presenter authentication failed");
    });
    presenter.on("close", () => sockets.delete(presenter));
    presenter.on("error", error => console.error(`presenter connection error: ${error.message}`));
}

function stop(reason = "duration reached") {
    if (finished) return;
    finished = true;
    for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
    }
    for (const ws of sockets) ws.close(1000, "Simulation finished");
    console.log(`simulation stopped: ${reason}; joined=${joined}, failed=${failed}, lastState=${raceState}`);
}

process.on("SIGINT", () => stop("interrupted"));
process.on("SIGTERM", () => stop("terminated"));

async function main() {
    if (options.reset) {
        console.log("resetting race to lobby");
        await resetRace();
    }
    console.log(`starting ${options.users} simulated players for ${options.duration}s at ${options.url}`);
    for (let index = 1; index <= options.users; index++) {
        schedule(() => connectPlayer(index), (index - 1) * options.joinDelay);
    }
    if (options.duration > 0) schedule(() => stop(), options.duration * 1000);
}

main().catch(error => {
    console.error(`simulation could not start: ${error.message}`);
    stop("setup failed");
    process.exitCode = 1;
});

import { normalizeSwimmer } from "./swimmers.js";
import { loadEnvFile } from "node:process";
import { createRaceServer } from "./lib/race-server.js";

try { loadEnvFile(); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}

import { networkInterfaces } from "node:os";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const root = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 20;
const TAP_COOLDOWN_MS = 55;
const TAP_POWER = 1.45;
const players = new Map();
let race = { state: "lobby", startedAt: null, winnerId: null, countdownEndsAt: null };

const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css" };
const publicFiles = new Set([
  "/index.html", "/race.html", "/style.css", "/player.js", "/race.js",
  "/join.js", "/swimmers.js", "/vendor/qrcode.js"
]);
const handleRequest = async (req, res) => {
  if (req.url === "/api/join-info") {
    const addresses = [...new Set(Object.values(networkInterfaces()).flat()
      .filter(address => address.family === "IPv4" && !address.internal)
      .map(address => address.address))];
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ urls: addresses.map(address => `http://${address}:${PORT}/`) }));
    return;
  }
  if (req.url?.startsWith("/api/ws")) return;
  const pathname = req.url === "/" ? "/index.html" : req.url === "/race" ? "/race.html" : req.url.split("?")[0];
  // Only serve public assets; never expose local credentials or server source.
  if (!publicFiles.has(pathname)) {
    res.writeHead(404); res.end("Not found"); return;
  }
  try {
    const data = await readFile(join(root, pathname));
    res.writeHead(200, { "content-type": mime[extname(pathname)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
};
const server = process.env.REDIS_URL
  ? createRaceServer(undefined, handleRequest).server
  : createServer(handleRequest);
const wss = process.env.REDIS_URL ? null : new WebSocketServer({ server, path: "/api/ws" });
const publicPlayers = () => [...players.values()].map(({ id,name,swimmer,distance,finishedAt }) => ({ id,name,swimmer,distance,finishedAt }));
const send = (ws,type,data={}) => ws.readyState===WebSocket.OPEN && ws.send(JSON.stringify({type,...data}));
const broadcast = (type,data={}) => { const m=JSON.stringify({type,...data}); for(const ws of wss.clients) if(ws.readyState===WebSocket.OPEN) ws.send(m); };
const emitState = () => broadcast("gameState", { race, players: publicPlayers() });
const reset = () => { race={state:"lobby",startedAt:null,winnerId:null,countdownEndsAt:null}; for(const p of players.values()){p.distance=0;p.finishedAt=null;p.lastTapAt=0;} emitState(); };

wss?.on("connection", (ws) => {
  ws.playerId = null;
  send(ws,"gameState",{race,players:publicPlayers()});
  ws.on("message", (raw) => {
    let m; try { m=JSON.parse(raw.toString()); } catch { return; }
    if(m.type==="join"){
      if(race.state!=="lobby") return send(ws,"joinResult",{ok:false,message:"A race is already in progress."});
      const id=String(m.playerId||"").slice(0,80); const name=String(m.name||"").trim().replace(/[<>]/g,"").slice(0,18);
      if(!id||!name) return send(ws,"joinResult",{ok:false,message:"Enter a name first."});
      if([...players.values()].some(p=>p.id!==id&&p.name.toLowerCase()===name.toLowerCase())) return send(ws,"joinResult",{ok:false,message:"That name is already taken."});
      if(!players.has(id)&&players.size>=MAX_PLAYERS) return send(ws,"joinResult",{ok:false,message:"This race is full."});
      const p=players.get(id)||{id,name,distance:0,finishedAt:null,lastTapAt:0}; p.name=name; p.swimmer=normalizeSwimmer(m.swimmer ?? p.swimmer); players.set(id,p); ws.playerId=id; send(ws,"joinResult",{ok:true,id}); emitState();
    } else if(m.type==="tap"){
      if(race.state!=="racing") return; const p=players.get(ws.playerId); if(!p||p.finishedAt) return; const now=Date.now(); if(now-p.lastTapAt<TAP_COOLDOWN_MS) return; p.lastTapAt=now; p.distance=Math.min(100,p.distance+TAP_POWER); if(p.distance>=100){p.finishedAt=now;if(!race.winnerId){race={...race,winnerId:p.id,state:"finished"};broadcast("winner",{id:p.id,name:p.name,timeMs:now-race.startedAt});}} emitState();
    } else if(m.type==="presenter:start"){
      if(players.size<1||race.state!=="lobby") return; race={state:"countdown",startedAt:null,winnerId:null,countdownEndsAt:Date.now()+3000}; for(const p of players.values()){p.distance=0;p.finishedAt=null;p.lastTapAt=0;} emitState(); setTimeout(()=>{if(race.state!=="countdown")return;race={...race,state:"racing",startedAt:Date.now(),countdownEndsAt:null};emitState();},3000);
    } else if(m.type==="presenter:reset") reset();
    else if(m.type==="presenter:clear"){players.clear();reset();}
  });
});

server.listen(PORT, () => console.log(`Swim Tap Race: http://localhost:${PORT}  Presenter: http://localhost:${PORT}/race`));

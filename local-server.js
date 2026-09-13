import { createMemoryStore } from "./lib/memory-store.js";
import { loadEnvFile } from "node:process";
import { createRaceServer } from "./lib/race-server.js";

try { loadEnvFile(); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}

import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css" };
const publicFiles = new Set([
  "/index.html", "/race.html", "/style.css", "/player.js", "/race.js",
  "/join.js", "/swimmers.js", "/results.js", "/vendor/qrcode.js"
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
  if (req.url?.startsWith("/api/ws")) { res.writeHead(426); res.end("WebSocket connection required"); return; }
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
const addresses = Object.values(networkInterfaces()).flat()
  .filter(address => address.family === "IPv4" && !address.internal).map(address => address.address);
const allowedOrigins = new Set([
  ...["localhost", "127.0.0.1", "[::1]", ...addresses].map(host => `http://${host}:${PORT}`),
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean)
]);
const server = createRaceServer(process.env.REDIS_URL ? undefined : createMemoryStore, handleRequest, { allowedOrigins }).server;
server.listen(PORT, () => console.log(`Swim Tap Race: http://localhost:${PORT}  Presenter: http://localhost:${PORT}/race`));

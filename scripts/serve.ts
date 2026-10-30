/*
  A tiny static server for previewing site/ locally: npm run serve [port].
  It exists because browsers only run ES modules served as JavaScript, and some
  setups (Python's server on Windows, for one) send .js as text/plain.
*/
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "site");
const PORT = Number(process.argv[2] ?? 8000);
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json"
};

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) return void response.writeHead(403).end();
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
    statSync(file);
  } catch {
    return void response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(response);
}).listen(PORT, "127.0.0.1", () => console.log(`site/ on http://127.0.0.1:${PORT}`));

import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { seedWords } from "./src/words.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 8787);
const store = process.env.DATA_FILE
  ? pathToFileURL(resolve(process.env.DATA_FILE))
  : new URL("./data/words.json", import.meta.url);

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const assets = new Map([
  ["/", { file: new URL("./public/index.html", import.meta.url), type: "text/html; charset=utf-8" }],
  ["/app.js", { file: new URL("./public/app.js", import.meta.url), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: new URL("./public/styles.css", import.meta.url), type: "text/css; charset=utf-8" }],
]);
const send = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
};

async function words() {
  try {
    const saved = JSON.parse(await readFile(store, "utf8"));
    const additions = seedWords.filter((seed) => !saved.some((word) => word.id === seed.id));
    if (!additions.length) return saved;
    const merged = [...saved, ...additions];
    await writeFile(store, JSON.stringify(merged, null, 2));
    return merged;
  }
  catch {
    await mkdir(new URL("./data/", import.meta.url), { recursive: true });
    await writeFile(store, JSON.stringify(seedWords, null, 2));
    return [...seedWords];
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const asset = request.method === "GET" ? assets.get(url.pathname) : null;
  if (asset) {
    response.writeHead(200, { "content-type": asset.type });
    return response.end(await readFile(asset.file));
  }
  if (url.pathname === "/api/words" && request.method === "GET") return send(response, 200, { words: await words() });
  if (url.pathname === "/api/words" && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let body;
    try { body = JSON.parse(raw); } catch { return send(response, 400, { error: "Send valid JSON." }); }
    const english = clean(body.english), italian = clean(body.italian);
    if (!english || !italian || english.length > 80 || italian.length > 80) return send(response, 400, { error: "Add an English and Italian word (up to 80 characters each)." });
    const list = await words();
    if (list.some((item) => item.english.toLowerCase() === english.toLowerCase() && item.italian.toLowerCase() === italian.toLowerCase())) return send(response, 409, { error: "That translation is already in your list." });
    const item = { id: crypto.randomUUID(), english, italian, type: body.type === "sentence" ? "sentence" : "word" };
    list.push(item);
    await writeFile(store, JSON.stringify(list, null, 2));
    return send(response, 201, { word: item });
  }
  response.writeHead(404); response.end("Not found");
}).listen(port, host, () => console.log(`Parole italiane local preview: http://localhost:${port}`));

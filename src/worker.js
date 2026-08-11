import { app } from "./app.js";
import { seedWords } from "./words.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

async function words(env) {
  const saved = await env.VOCABULARY.get("words", "json");
  if (Array.isArray(saved) && saved.length) {
    const additions = seedWords.filter((seed) => !saved.some((word) => word.id === seed.id));
    if (!additions.length) return saved;
    const merged = [...saved, ...additions];
    await env.VOCABULARY.put("words", JSON.stringify(merged));
    return merged;
  }
  await env.VOCABULARY.put("words", JSON.stringify(seedWords));
  return seedWords;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/words" && request.method === "GET") {
      return json({ words: await words(env) });
    }
    if (url.pathname === "/api/words" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "Send valid JSON." }, 400); }
      const english = clean(body.english);
      const italian = clean(body.italian);
      if (!english || !italian || english.length > 80 || italian.length > 80) {
        return json({ error: "Add an English and Italian word (up to 80 characters each)." }, 400);
      }
      const list = await words(env);
      if (list.some((item) => item.english.toLowerCase() === english.toLowerCase() && item.italian.toLowerCase() === italian.toLowerCase())) {
        return json({ error: "That translation is already in your list." }, 409);
      }
      const item = { id: crypto.randomUUID(), english, italian, type: body.type === "sentence" ? "sentence" : "word" };
      list.push(item);
      await env.VOCABULARY.put("words", JSON.stringify(list));
      return json({ word: item }, 201);
    }
    return new Response(app, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};

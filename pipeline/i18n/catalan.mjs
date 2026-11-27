#!/usr/bin/env node
// Catalan for the website (js/i18n.js → "Català" in the profile, region "ca" on top of Spanish): the cheapest model
// translates every phrase of the Spanish dictionary (js/i18n-es.js) into Catalan. Whatever is missing or fails the
// checks stays in Spanish, and so does the content that only exists in Spanish (posts, news, "What's new").
//   cd pipeline && node i18n/catalan.mjs --sample 40   (prints a sample, writes nothing)
//   cd pipeline && node i18n/catalan.mjs               (writes js/i18n-es-ca.js)
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../library/env.mjs";

loadEnv();
const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const SAMPLE = argv.includes("--sample") ? Number(argv[argv.indexOf("--sample") + 1]) || 40 : 0;
const MODEL = "claude-haiku-5-5", BATCH = 80;
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/i18n-es.js"), "utf8"), box);
const ES = box.window.SCP_ES;
let entries = Object.entries(ES).filter(([, v]) => typeof v === "string" && /[a-záéíóúñ]/i.test(v));
if (SAMPLE) entries = entries.filter((_, i) => i % Math.floor(entries.length / SAMPLE) === 0).slice(0, SAMPLE);

const SYSTEM = `You translate a sports-marketing web app (Sports Content Playbook, "SCP") from Spain Spanish into Catalan (standard central Catalan, as written in Barcelona).
For each numbered phrase, give its natural Catalan translation, the way a Catalan product team would write it.
Rules:
- Informal "tu" exactly like the Spanish: "Guarda", "Tria", "Tens", "Descarrega'l". Never "vostè".
- Correct Catalan spelling: apostrophes (l'equip, d'idees), "per a" before infinitives of purpose when needed, accents (què, més, també).
- Keep the word "posts" (the product's term), "reels", "stories". "Club" / "clubs", "competició" / "competicions", "esport", "patrocinador", "fitxatge".
- Do not translate brand or product names (SCP, Sports Content Playbook, Content Library, My Club, Instagram, TikTok…), numbers, prices or emojis.
- Keep every {placeholder} exactly as it is, and keep any HTML tags and entities untouched.
- Same meaning, tone and similar length. Return the translation for every phrase (never null).`;
const SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["i", "t"], properties: { i: { type: "integer" }, t: { type: "string" } } } } } };

const ca = {};
let tin = 0, tout = 0, bad = 0;
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
const tags = (s) => (s.match(/<\/?[a-z][^>]*>|&\w+;/gi) || []).sort().join();
const valid = (t, es) => typeof t === "string" && t.trim() && ph(t) === ph(es) && tags(t) === tags(es) && !/\bvostè\b/i.test(t);
for (let k = 0; k < entries.length; k += BATCH) {
  const part = entries.slice(k, k + BATCH);
  const msg = await claude.messages.create({
    model: MODEL, max_tokens: 16000, thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: part.map(([, x], i) => `${i}. ${x.replace(/\n/g, " ")}`).join("\n") }],
  });
  tin += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens || 0) + (msg.usage.cache_creation_input_tokens || 0); tout += msg.usage.output_tokens;
  const got = new Map(JSON.parse(msg.content.find((c) => c.type === "text").text).items.map((r) => [r.i, r.t]));
  part.forEach(([key, es], i) => { const t = got.get(i); if (valid(t, es)) ca[key] = t.trim(); else bad++; });
  process.stderr.write(`${Math.min(k + BATCH, entries.length)} / ${entries.length}\n`);
}
const cost = (tin * 0.10 + tout * 0.50) / 1e6;
if (SAMPLE) {
  for (const [key, es] of entries) console.log(`ES  ${es}\nCA  ${ca[key] ?? "(stays in Spanish)"}\n`);
  console.log(`${entries.length} phrases · ${bad} failed the checks · ${tin} in / ${tout} out tokens · $${cost.toFixed(4)}`);
  console.log(`Whole dictionary (${Object.keys(ES).length} phrases): about $${(cost * Object.keys(ES).length / entries.length).toFixed(2)}`);
} else {
  fs.writeFileSync(path.join(ROOT, "js/i18n-es-ca.js"),
    `// Catalan for js/i18n.js ("Català" in the profile): every phrase of js/i18n-es.js translated; anything missing stays in Spanish.\n// Made by pipeline/i18n/catalan.mjs (${MODEL}); edit by hand freely.\nwindow.SCP_ES_CA = ${JSON.stringify(ca, null, 1)};\n`);
  console.log(`Written: ${Object.keys(ca).length} phrases · ${bad} left in Spanish · $${cost.toFixed(3)}`);
}

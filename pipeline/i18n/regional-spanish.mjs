#!/usr/bin/env node
// Mexican and Argentine Spanish for the website (js/i18n.js → "Español (México)" / "Español (Argentina)" in the profile).
// From the Spain Spanish dictionary (js/i18n-es.js), the cheapest model rewrites only the phrases a Mexican or an
// Argentine would say differently (computadora, celular, ustedes; voseo in Argentina) and leaves the rest out: the site
// uses Spain Spanish for whatever isn't in js/i18n-es-mx.js / js/i18n-es-ar.js.
//   cd pipeline && node i18n/regional-spanish.mjs --sample 30   (prints a sample, writes nothing)
//   cd pipeline && node i18n/regional-spanish.mjs               (writes js/i18n-es-mx.js and js/i18n-es-ar.js)
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../library/env.mjs";

loadEnv();
const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const SAMPLE = argv.includes("--sample") ? Number(argv[argv.indexOf("--sample") + 1]) || 30 : 0;
const MODEL = "claude-haiku-5-5", BATCH = 120;
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/i18n-es.js"), "utf8"), box);
const ES = box.window.SCP_ES;
let entries = Object.entries(ES).filter(([, v]) => typeof v === "string" && /[a-záéíóúñ]/i.test(v));
if (SAMPLE) {
  const likely = entries.filter(([, v]) => /ordenador|móvil|vosotr|vuestr|\bcog|\btienes\b|\bpuedes\b|\bquieres\b|\belige\b|\bprueba\b|\bdescarga\b|\bmira\b|\bguarda\b/i.test(v));
  const rest = entries.filter((e) => !likely.includes(e));
  const pick = (a, n) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / n)) === 0).slice(0, n);
  entries = [...pick(likely, Math.ceil(SAMPLE * 0.7)), ...pick(rest, Math.floor(SAMPLE * 0.3))];
}

// one pass per country: asked together, the model mixed them (Argentine voseo in Mexico, "usted" forms)
const COMMON = `You localise a sports-marketing web app (Sports Content Playbook, "SCP") from Spain Spanish into {COUNTRY} Spanish.
For each numbered phrase, give the {COUNTRY} version ONLY when a native speaker there would say it differently; otherwise null.
Rules:
{RULES}
- "competencia" for competición (a sports competition), "computadora" for ordenador, "celular" for móvil, "ustedes" (and its verbs and possessives) for vosotros. Keep the word "posts" (the product's term).
- Never switch "tú" to "usted": informal stays informal ("Descárgalo" never becomes "Descárguelo", "Te quedan" never "Le quedan", "tu" never "su").
- Never change facts, places or names ("Europa" stays "Europa"). Keep the same meaning, tone and length. Do not translate brand or product names (SCP, Content Library, My Club, Reels, TikTok…), numbers or emojis.
- Keep every {placeholder} exactly as it is, and keep any HTML tags and entities untouched.
- Neutral phrases (most of them) → null. Never return a version identical to the original.`;
const VARIANTS = {
  mx: { country: "Mexican", rules: `- Mexico uses "tú" exactly like Spain: tú verbs stay as they are ("guarda", "elige", "tienes", "prueba"). Never use Argentine voseo ("guardá", "tenés", "vos").
- Only change what sounds foreign in Mexico: vosotros forms, "coger" → "tomar/agarrar", "vale" → "de acuerdo", "vídeo" → "video", "zumo" → "jugo", "conducir" → "manejar", "aparcar" → "estacionar".` },
  ar: { country: "Rioplatense (Argentine)", rules: `- Argentina uses voseo for every second person singular: tú verbs and imperatives become vos forms ("tenés", "podés", "querés", "elegí", "probá", "mirá", "guardá", "descargalo", "escribí"), even in short phrases ("Tienes cambios sin guardar" → "Tenés cambios sin guardar"). "aquí" → "acá", "portero" → "arquero", "vídeo" → "video".` },
};
const SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["i", "t"], properties: { i: { type: "integer" }, t: { type: ["string", "null"] } } } } } };

const out = { mx: {}, ar: {} }, mx = out.mx, ar = out.ar;
let tin = 0, tout = 0;
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
// words that change everywhere in Latin America, on top of what the model gives (same capital letter as the original)
const WORDS = [["competiciones", "competencias"], ["competición", "competencia"], ["ordenadores", "computadoras"], ["ordenador", "computadora"], ["móviles", "celulares"], ["móvil", "celular"]];
const fix = (s) => WORDS.reduce((t, [a, b]) => t.replace(new RegExp(`\\b${a}\\b`, "gi"), (m) => (m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b)), s);
const cnt = (t, re) => (t.match(re) || []).length, TU = /\b(tu|tus|te|ti|contigo)\b/gi, UD = /\b(su|sus|le|les|usted)\b/gi;
const words = (t) => new Set(t.toLowerCase().match(/\p{L}+/gu) || []);
// checks: placeholders and names kept, never "usted", and in Mexico no new word ending in a stressed vowel (Argentine voseo)
function valid(v, t, es) {
  if (!t || ph(t) !== ph(es)) return false;
  const names = (es.match(/(?<=\S\s)\p{Lu}[\p{L}\d]+/gu) || []).filter((w) => !WORDS.some(([a]) => a.toLowerCase() === w.toLowerCase()));
  if (!names.every((w) => t.includes(w))) return false;
  if (cnt(t, TU) < cnt(es, TU) && cnt(t, UD) > cnt(es, UD)) return false;
  if (/\p{L}+(?:uelo|uela|uelos|uelas|ese|ase)\b/u.test(t) && !/\p{L}+(?:uelo|uela|uelos|uelas|ese|ase)\b/u.test(es) && v === "mx") return false;
  if (v === "mx") { const old = words(es); if ([...words(t)].some((w) => /[áéí]$/.test(w) && !old.has(w) && !["más", "está", "aquí", "allí", "así", "sí", "ahí", "qué", "podrá", "tendrá", "será", "verá", "estará", "habrá", "hará", "recibirá", "irá"].includes(w))) return false; }
  return true;
}
for (const [v, cfg] of Object.entries(VARIANTS)) {
  const system = COMMON.replaceAll("{COUNTRY}", cfg.country).replace("{RULES}", cfg.rules);
  for (let k = 0; k < entries.length; k += BATCH) {
    const part = entries.slice(k, k + BATCH);
    const msg = await claude.messages.create({
      model: MODEL, max_tokens: 16000, thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: part.map(([, x], i) => `${i}. ${x}`).join("\n") }],
    });
    tin += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens || 0) + (msg.usage.cache_creation_input_tokens || 0); tout += msg.usage.output_tokens;
    const got = new Map(JSON.parse(msg.content.find((c) => c.type === "text").text).items.map((r) => [r.i, r.t]));
    part.forEach(([key, es], i) => { const t = fix(valid(v, got.get(i), es) ? got.get(i) : es); if (t !== es) out[v][key] = t; });
    process.stderr.write(`${v} ${Math.min(k + BATCH, entries.length)} / ${entries.length}\n`);
  }
}
const cost = (tin * 0.10 + tout * 0.50) / 1e6;
if (SAMPLE) {
  for (const [key, es] of entries) console.log(`ES  ${es}\nMX  ${mx[key] ?? "="}\nAR  ${ar[key] ?? "="}\n`);
  console.log(`${entries.length} phrases · ${Object.keys(mx).length} change in MX · ${Object.keys(ar).length} in AR · ${tin} in / ${tout} out tokens · $${cost.toFixed(4)}`);
  console.log(`Whole dictionary (${Object.keys(ES).length} phrases): about $${(cost * Object.keys(ES).length / entries.length).toFixed(2)}`);
} else {
  const write = (file, name, label, dict) => fs.writeFileSync(path.join(ROOT, "js", file),
    `// ${label} for js/i18n.js: only the phrases said differently there; the rest come from js/i18n-es.js (Spain).\n// Made by pipeline/i18n/regional-spanish.mjs (${MODEL}); edit by hand freely.\nwindow.${name} = ${JSON.stringify(dict, null, 1)};\n`);
  write("i18n-es-mx.js", "SCP_ES_MX", "Mexican Spanish", mx);
  write("i18n-es-ar.js", "SCP_ES_AR", "Argentine Spanish", ar);
  console.log(`Written: ${Object.keys(mx).length} MX and ${Object.keys(ar).length} AR phrases · $${cost.toFixed(3)}`);
}

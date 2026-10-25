#!/usr/bin/env node
// YouTube Shorts imported with a normal watch link (youtube.com/watch?v=…): find them and fix them.
// A Short's original-ratio thumbnail (i.ytimg.com/vi/<id>/oar2.jpg) is vertical. For each Short:
//   url → https://www.youtube.com/shorts/<id>, media_ratio → 16/9 (vertical), cover → YouTube's original-ratio
//   thumbnail (oar2.jpg, vertical for Shorts), format tag "Video" → "Shorts".
// Progress is kept in library/.smart-cache/yt-checked.json, so it can stop and resume.
//
//   cd pipeline && node library/youtube-shorts.mjs [--limit 500] [--dry]
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pipeline/.env.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { storeCover } from "./covers.mjs";

loadEnv();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const DRY = argv.includes("--dry");
const LIMIT = Number(arg("--limit") || 1e9);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, ".smart-cache", "yt-checked.json");
fs.mkdirSync(path.dirname(STATE), { recursive: true });
const checked = new Set(fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : []);
const save = () => fs.writeFileSync(STATE, JSON.stringify([...checked]));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
// The original-ratio thumbnail (oar2.jpg) is vertical for a Short and horizontal for a normal video.
// (Asking youtube.com/shorts/<id> doesn't work from the EU: every request is redirected to the cookie consent page.)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
async function isShort(id) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/oar2.jpg`, { headers: { "User-Agent": UA } }).catch(() => null);
    if (!r) { await sleep(3000); continue; }
    if (r.status === 404) return null;   // removed / private: leave it
    if (r.status === 429) { await sleep(30000); continue; }
    if (!r.ok) return null;
    const size = jpegSize(Buffer.from(await r.arrayBuffer()));
    return size ? size.h > size.w * 1.2 : null;
  }
  return null;
}

const { data: fmt } = await db.from("idea_catalog").select("id,name").eq("category", "format");
const SHORTS = fmt.find((f) => f.name === "Shorts")?.id, VIDEO = fmt.find((f) => f.name === "Video")?.id;
if (!SHORTS) throw new Error('No "Shorts" format in the catalog');

let from = 0, done = 0, shorts = 0;
const PAGE = 1000;
outer: while (true) {
  const { data: rows, error } = await db.from("content_ideas").select("id,url").ilike("url", "%youtu%").not("url", "ilike", "%/shorts/%").order("id", { ascending: argv.includes("--oldest") }).range(from, from + PAGE - 1);
  if (error) throw error;
  if (!rows.length) break;
  from += PAGE;
  for (const p of rows) {
    if (done >= LIMIT) break outer;
    if (checked.has(p.id)) continue;
    const vid = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(p.url || "")?.[1];
    if (!vid) { checked.add(p.id); continue; }
    const short = await isShort(vid);
    await sleep(250);
    done++;
    if (short === null) continue;   // try again next run
    checked.add(p.id);
    if (short) {
      shorts++;
      if (DRY) { console.log(`Short: ${p.id} ${p.url}`); continue; }
      const cover = await storeCover(p.id, `https://i.ytimg.com/vi/${vid}/oar2.jpg`).catch(() => null);
      await db.from("content_ideas").update({ url: `https://www.youtube.com/shorts/${vid}`, media_ratio: 16 / 9, ...(cover ? { cover_url: cover.url } : {}) }).eq("id", p.id);
      if (VIDEO) await db.from("content_idea_tags").delete().eq("idea_id", p.id).eq("value_id", VIDEO);
      await db.from("content_idea_tags").upsert({ idea_id: p.id, value_id: SHORTS }, { onConflict: "idea_id,value_id", ignoreDuplicates: true });
    }
    if (done % 200 === 0) { save(); console.log(`${new Date().toISOString().slice(11, 16)} checked ${done} · ${shorts} Shorts`); }
  }
}
save();
console.log(`Done: ${done} checked, ${shorts} were Shorts${DRY ? " (dry run: nothing changed)" : " and are fixed"}.`);

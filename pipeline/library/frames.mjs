#!/usr/bin/env node
// Download a post's video (yt-dlp, public links, never with cookies) and cut it into contact sheets
// (5 x 4 frames each) so Claude can "watch" it by reading 1–3 images instead of dozens of frames.
// Adapted from instagram-research-tool (MIT, Manthan Patel).
//
//   node library/frames.mjs <post url> [--fps 1]
//
// Output: pipeline/media/<id>/video.mp4, cover.jpg, frames/contact-01.jpg …, frames/index.json
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { idFromUrl } from "./adapters.mjs";
import { igEmbed } from "./instagram.mjs";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const fps = Number(args.includes("--fps") ? args[args.indexOf("--fps") + 1] : 1) || 1;
const ref = idFromUrl(url);
if (!ref) { console.error("Usage: node library/frames.mjs <instagram|tiktok|youtube post url> [--fps N]"); process.exit(2); }

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "media", ref.id);
const framesDir = path.join(dir, "frames");
fs.mkdirSync(framesDir, { recursive: true });
const video = path.join(dir, "video.mp4");

// Instagram fallback: the public embed page (the one shown on websites) carries the video file URL — no login needed
async function fromInstagramEmbed() {
  const { video: src } = await igEmbed(ref.url, { captioned: true });
  if (!src) return false;
  try {
    fs.writeFileSync(video, Buffer.from(await (await fetch(src)).arrayBuffer()));
    return fs.statSync(video).size > 10000;
  } catch { return false; }
}

if (!fs.existsSync(video)) {
  const r = spawnSync("yt-dlp", ["--no-playlist", "--no-warnings", "-f", "mp4/best", "-o", video, "--write-thumbnail", "--convert-thumbnails", "jpg", "-o", `thumbnail:${path.join(dir, "cover")}`, ref.url], { encoding: "utf8" });
  if ((r.status !== 0 || !fs.existsSync(video)) && !(await fromInstagramEmbed())) {
    console.error(`Could not download the video (${(r.stderr || "").trim().split("\n").pop() || "unknown error"}).`);
    console.error("Analyse it from the thumbnail and caption instead, and say so in the analysis.");
    process.exit(1);
  }
}

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" });
const duration = Number(probe.stdout.trim()) || null;
const cols = 5, rows = 4, perSheet = cols * rows;
for (const f of fs.readdirSync(framesDir)) if (/^contact-\d+\.jpg$/.test(f)) fs.rmSync(path.join(framesDir, f));
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-vf", `fps=${fps},scale=270:-2,tile=${cols}x${rows}:padding=4:margin=4`, "-q:v", "3", path.join(framesDir, "contact-%02d.jpg")], { encoding: "utf8" });
if (r.status !== 0) { console.error(`ffmpeg failed: ${r.stderr}`); process.exit(1); }

const sheets = fs.readdirSync(framesDir).filter((f) => /^contact-\d+\.jpg$/.test(f)).sort();
const index = { id: ref.id, url: ref.url, durationSec: duration, fps, cols, rows, sheets: sheets.map((file, k) => ({ file: path.join(framesDir, file), from: (k * perSheet) / fps, to: Math.min(duration ?? Infinity, ((k + 1) * perSheet) / fps) })) };
fs.writeFileSync(path.join(framesDir, "index.json"), JSON.stringify(index, null, 2));
console.log(`${ref.id}: ${duration ? Math.round(duration) + "s" : "unknown length"}, ${sheets.length} contact sheet(s), 1 tile = ${1 / fps}s, read left→right, top→bottom`);
for (const s of index.sheets) console.log(`  ${s.file}  (${s.from}s → ${Math.round(s.to)}s)`);

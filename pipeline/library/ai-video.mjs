#!/usr/bin/env node
// AI analysis of a video post (GitHub Actions "AI video analysis", started by the ai-analyze function when someone unlocks a video):
// downloads the video, takes 4-10 frames spread over it (the first at 0.5 s, the hook) and the spoken transcript,
// and hands them to ai-analyze, which asks Claude and stores the analysis. If the video can't be read, ai-analyze
// falls back to the cover.
//
//   node library/ai-video.mjs <post_id>            → analyses and stores it (completes every pending unlock of that post)
//   node library/ai-video.mjs <post_id> --preview  → returns the analysis without storing it (to compare versions)
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (pipeline/.env locally, GitHub secrets in Actions), ffmpeg, yt-dlp
// (TikTok, YouTube, Facebook, X) and python3 with faster-whisper.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";
import { igEmbed, igRef } from "./instagram.mjs";

loadEnv();
const postId = Number(process.argv[2]);
const PREVIEW = process.argv.includes("--preview");
const why = (e) => String(e.stderr || e.message || e).trim().slice(-600);
if (!postId) throw new Error("usage: node library/ai-video.mjs <post_id> [--preview]");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-video-"));
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });

async function download(url, file) {
  if (igRef(url)) {
    const { video } = await igEmbed(url);
    if (!video) throw new Error("Instagram gave no video");
    const r = await fetch(video);
    if (!r.ok) throw new Error(`video ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  } else {
    run("yt-dlp", ["-q", "--no-warnings", "--no-playlist", "-f", "b[height<=720]/b", "-o", file, url]);
  }
}

async function videoOf(url) {
  const file = path.join(dir, "v.mp4");
  await download(url, file);
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));
  if (!(duration > 0)) throw new Error("not a video");
  const n = Math.min(10, Math.max(4, Math.round(duration / 6)));
  const times = Array.from({ length: n }, (_, i) => (i === 0 ? Math.min(0.5, duration / 2) : Math.round((duration * i) / n * 10) / 10));
  const frames = times.map((t, i) => {
    const jpg = path.join(dir, `f${i}.jpg`);
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "4", jpg]);
    return { t, data: fs.readFileSync(jpg).toString("base64") };
  });
  let speech = { language: null, text: "" };
  try {
    const wav = path.join(dir, "a.wav");
    run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", wav]);
    speech = JSON.parse(run("python3", ["-I", path.join(path.dirname(fileURLToPath(import.meta.url)), "transcribe.py"), wav]));
  } catch (e) { console.warn("no transcript:", why(e)); }   // silent clips, music only
  return { duration: Math.round(duration * 10) / 10, frames, transcript: speech.text, language: speech.language };
}

const { data: post, error } = await db.from("content_ideas").select("id,url").eq("id", postId).single();
if (error) throw error;
let video = null;
try { video = await videoOf(post.url); } catch (e) { console.warn("video unavailable:", why(e)); }
console.log(video ? `${video.frames.length} frames over ${video.duration}s · transcript ${video.transcript.length} chars` : "no video: ai-analyze uses the cover");

const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/ai-analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-worker-key": process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ post_id: postId, video, preview: PREVIEW }),
});
const out = await res.json().catch(() => ({}));
fs.rmSync(dir, { recursive: true, force: true });
if (PREVIEW) fs.writeFileSync(path.join(os.tmpdir(), `ai-video-${postId}.json`), JSON.stringify(out, null, 2));
console.log(res.status, PREVIEW ? `preview saved to ${path.join(os.tmpdir(), `ai-video-${postId}.json`)} · cost $${(out.cost || 0).toFixed(4)}` : JSON.stringify(out));
if (!res.ok || out.error) process.exit(1);

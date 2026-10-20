#!/usr/bin/env node
// Renders video/scp-video.html frame by frame with headless Chrome (DevTools protocol) and pipes the frames to ffmpeg.
//   node video/render.mjs --f h --out video/out/scp-h.mp4            (horizontal 1920×1080)
//   node video/render.mjs --f v --out video/out/scp-v.mp4            (vertical 1080×1920)
//   node video/render.mjs --f h --stills 3,14,20 --dir /tmp/stills   (a few PNGs to check the design)
// Options: --fps 30, --d "7.4,5,…" (scene lengths), --audio video/out/vo-mix.wav (muxed in), --base http://localhost:8765
// Needs: Google Chrome, ffmpeg, and the site served on --base (python3 -m http.server 8765).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d = null) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const F = arg("--f", "h"), FPS = Number(arg("--fps", 30)), BASE = arg("--base", "http://localhost:8765");
const W = F === "v" ? 1080 : 1920, H = F === "v" ? 1920 : 1080;
const UNDER = arg("--under");   // a video to draw the (transparent) page over, e.g. the talking-head clip
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "scp-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, "--hide-scrollbars", "--force-device-scale-factor=1",
  "--disable-gpu-vsync", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill("SIGKILL"); } catch {} };
process.on("exit", cleanup);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) throw new Error("Chrome didn't start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
if (UNDER) await cdp("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
const q = new URLSearchParams({ f: F, ...(arg("--d") ? { d: arg("--d") } : {}) });
await cdp("Page.navigate", { url: `${BASE}/video/${arg("--page", "scp-video.html")}?${q}` });
for (let i = 0; i < 100 && !(await evaluate("window.READY === true").catch(() => false)); i++) await sleep(100);
const info = await evaluate("window.VIDEO");
console.log(`format ${F} ${W}×${H} · ${info.TOTAL.toFixed(2)} s`);
const shot = async (t, format = "jpeg") => {
  await evaluate(`window.renderAt(${t}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  if (UNDER && format === "jpeg") format = "png";   // keep the transparency
  return Buffer.from((await cdp("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 92 } : {}), clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })).data, "base64");
};

if (arg("--stills")) {
  const dir = arg("--dir", "video/out/stills"); fs.mkdirSync(dir, { recursive: true });
  for (const t of arg("--stills").split(",").map(Number)) { const f = path.join(dir, `${F}-${t.toFixed(2)}.png`); fs.writeFileSync(f, await shot(t, "png")); console.log(f); }
  cleanup(); process.exit(0);
}

const out = arg("--out", `video/out/scp-${F}.mp4`); fs.mkdirSync(path.dirname(out), { recursive: true });
const audio = arg("--audio");
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", ...(UNDER ? ["-i", UNDER] : []), "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  ...(audio ? ["-i", audio] : []), ...(UNDER ? ["-filter_complex", "[0:v][1:v]overlay=0:0:format=auto:shortest=1[v]", "-map", "[v]", "-map", audio ? "2:a" : "0:a?"] : []), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ...(audio ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []), out], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.ceil(info.TOTAL * FPS), t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const buf = await shot(i / FPS);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 150 === 0) console.log(`${i}/${frames} frames · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
console.log(`Done: ${out}`);
cleanup(); process.exit(0);

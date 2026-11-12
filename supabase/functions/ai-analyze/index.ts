// Supabase Edge Function "ai-analyze": generates the AI analysis of a post the user has just unlocked.
//
// The browser first calls the RPC unlock_analysis(post) — that is where the credit is spent. If the analysis
// didn't exist yet the unlock stays "pending" and the browser calls this function, which:
//   1. checks the caller really has a pending unlock for that post,
//   2. claims the generation (only ONE API call per post + prompt version, even with many users waiting),
//   3. sends the post image + caption to Claude and stores the analysis (complete_generation),
//   4. on any error refunds every pending unlock of that post (fail_generation).
// Other users who unlock the same post later get the stored analysis without any API call.
//
// Videos: when GH_DISPATCH_TOKEN is set, a video unlock starts the GitHub Actions workflow "AI video analysis"
// (pipeline/library/ai-video.mjs), which posts back frames + transcript with the x-worker-key header; the analysis
// is made from them (basis "video"). If the workflow can't start or can't read the video, the cover is used.
//
// POST { post_id, lang: "es" }: the Spanish version of an analysis the caller has unlocked, made the first time someone
// reads it in Spanish and kept inside the analysis (result.es, same shape), so it's made only once per analysis.
//
// Secrets: ANTHROPIC_API_KEY; optional AI_MODEL (default claude-sonnet-5-5: faster and cheaper than Opus for this task),
//          AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK (USD per million tokens; without them, PRICES below records the real cost).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

const PROMPT_VERSION = "v1";   // the key unlocks and stored analyses share (billing.sql); the prompt itself is ANALYSIS_VERSION
const ANALYSIS_VERSION = "v2"; // v2: the post's real numbers against its account, and a ready-to-use playbook
const PRICES: Record<string, [number, number]> = { "claude-sonnet-5-5": [2, 10], "claude-sonnet-5": [2, 10] }; // USD per million tokens in / out
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
const rpc = async (fn: string, args: unknown) => {
  const r = await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return r.json();
};

const SYSTEM = `You are the content analyst of Sports Content Playbook (SCP), a platform for the social media teams of sports clubs, leagues, athletes and sports brands.
You receive one social media post (its image or video cover, its caption and its tags). Explain why it works and how a club could reuse the idea.
Write in English, concise and specific to what you can see. Never invent numbers or results. Never identify people by their face; only name people when the caption or on-screen text says who they are. Analysis, never criticism.
When you only get the cover of a video: base the visual breakdown on what the cover and caption show and keep it short.`;
// v2 adds these rules and the performance + playbook fields; LIVE_V2 says whether members get it (an admin can preview it first)
const LIVE_V2 = true;
const LIVE_VIDEO = true;    // members' video unlocks go through the video worker (needs GH_DISPATCH_TOKEN too)
const SYSTEM_V2 = `
When you get Frames instead of a cover, you see the video itself: frames at the given seconds and the automatic transcript of what is said (it may contain mistakes; empty when nobody speaks). Base the hook on the first frame and the first spoken line, visualBreakdown on the frames with their real seconds as t, pacing on how the frames change, and scrollStoppers on the seconds where they happen. Quote spoken words only from the transcript, fixing obvious transcription mistakes (misheard names, joined words).
For a single static image there is no timeline: return an empty visualBreakdown and give every scroll stopper t = 0. For a carousel, t is the slide number.

You also get the post's real numbers and the median of the same account's posts that quarter (Numbers). Use only those numbers.
performance.verdict: copy the Verdict you are given.
In performance.explanation say in one or two sentences how the post did against what is usual for this account (quote the multiple, e.g. "3.4x the account's median views") and which element of the post most likely explains it. With "no_data" or "too_early", say so in one sentence and explain nothing else.
Let the verdict shape whyItWorks: for an underperforming post, explain what still makes it worth studying instead of claiming it worked.
playbook is what a club's social media team can use today: three hookVariants (opening lines or on-screen texts in the post's spirit, each a different angle, in English, written for any club, no real names), a shotList of 3 to 6 shots or slides to produce (shot: what to film or design; note: one practical tip), and a captionDraft of at most 3 short lines with [placeholders] for the club's own names.`;
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    summary: { type: "string" },
    whyItWorks: { type: "string" },
    hook: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, category: { type: "string" }, template: { type: "string" }, whyItWorks: { type: "string" } }, required: ["text", "category", "template", "whyItWorks"] },
    format: { type: "object", additionalProperties: false, properties: { category: { type: "string" }, type: { type: "string" }, visualLayout: { type: "string" }, pacing: { type: "string" } }, required: ["category", "type", "visualLayout", "pacing"] },
    angle: { type: "object", additionalProperties: false, properties: { topic: { type: "string" }, angle: { type: "string" } }, required: ["topic", "angle"] },
    visualBreakdown: { type: "array", items: { type: "object", additionalProperties: false, properties: { t: { type: "integer" }, shot: { type: "string" }, onScreenText: { type: "string" }, why: { type: "string" } }, required: ["t", "shot", "onScreenText", "why"] } },
    scrollStoppers: { type: "array", items: { type: "object", additionalProperties: false, properties: { t: { type: "integer" }, moment: { type: "string" }, why: { type: "string" } }, required: ["t", "moment", "why"] } },
    replicable: { type: "object", additionalProperties: false, properties: { is: { type: "boolean" }, howToAdapt: { type: "string" } }, required: ["is", "howToAdapt"] },
    performance: { type: "object", additionalProperties: false, properties: { verdict: { type: "string", enum: ["overperformed", "in_line", "underperformed", "too_early", "no_data"] }, explanation: { type: "string" } }, required: ["verdict", "explanation"] },
    playbook: { type: "object", additionalProperties: false, properties: {
      hookVariants: { type: "array", items: { type: "string" } },
      shotList: { type: "array", items: { type: "object", additionalProperties: false, properties: { shot: { type: "string" }, note: { type: "string" } }, required: ["shot", "note"] } },
      captionDraft: { type: "string" } }, required: ["hookVariants", "shotList", "captionDraft"] },
    topics: { type: "array", items: { type: "string" } },
    moment: { type: "string", enum: ["matchday", "signing", "kit", "sponsor", "behind_the_scenes", "fans", "milestone", "community", "ticketing", "training", "humour", "other"] },
    style: { type: "string", enum: ["talking_head", "pov", "meme", "graphic", "montage", "interview", "challenge", "vlog", "live_action", "other"] },
    language: { type: "string" },
  },
  required: ["summary", "whyItWorks", "hook", "format", "angle", "visualBreakdown", "scrollStoppers", "replicable", "performance", "playbook", "topics", "moment", "style", "language"],
};
const { performance: _p, playbook: _b, ...V1_PROPS } = SCHEMA.properties;
const SCHEMA_V1 = { ...SCHEMA, properties: V1_PROPS, required: SCHEMA.required.filter((k) => k !== "performance" && k !== "playbook") };

const toBase64 = async (img: Response) => {
  const bytes = new Uint8Array(await img.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(bin), type: img.headers.get("content-type")?.split(";")[0] || "image/jpeg" };
};
// The cover we already keep in Storage (covers.sql) — fast and always there; Instagram's embed page only as a fallback
async function storedCover(coverUrl: string | null) {
  if (!coverUrl) return null;
  const img = await fetch(coverUrl).catch(() => null);
  return img?.ok && (img.headers.get("content-type") || "").startsWith("image/") ? toBase64(img) : null;
}
// Instagram's public embed page: cover image of the post (no login)
async function coverImage(url: string): Promise<{ data: string; type: string } | null> {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(url || "");
  if (!m) return null;
  const html = await (await fetch(`https://www.instagram.com/${m[1]}/${m[2]}/embed/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Accept: "text/html", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site",
    },
  })).text();
  const src = /class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  if (!src) return null;
  const img = await fetch(src);
  if (!img.ok) return null;
  return toBase64(img);
}

// ---------- Spanish version ----------
const TRANSLATE = `You translate the AI analysis of a sports social media post, written for the social media teams of sports clubs, leagues and brands, from English into Spanish (Spain).
Natural, professional Spanish, tú form. Keep the meaning and length; don't add or remove information. Keep names of clubs, players, brands, platforms and features as they are (Instagram, TikTok, Reels…), and numbers.
Common terms Spanish social media teams use can stay (hook, engagement, post, reel, scroll). Spanish only: never a word or character from another language or alphabet.
You get a JSON object: return the same object with every text translated, the same keys and the same number of items in every list.`;
// the readers' text of an analysis (what is translated); hook.text and onScreenText are the post's own words: they stay
const textOf = (a: any) => ({
  summary: a.summary || "", whyItWorks: a.whyItWorks || "",
  hook: { category: a.hook?.category || "", template: a.hook?.template || "", whyItWorks: a.hook?.whyItWorks || "" },
  format: { category: a.format?.category || "", type: a.format?.type || "", visualLayout: a.format?.visualLayout || "", pacing: a.format?.pacing || "" },
  angle: { topic: a.angle?.topic || "", angle: a.angle?.angle || "" },
  visualBreakdown: (a.visualBreakdown || []).map((x: any) => ({ shot: x.shot || "", why: x.why || "" })),
  scrollStoppers: (a.scrollStoppers || []).map((x: any) => ({ moment: x.moment || "", why: x.why || "" })),
  replicable: { howToAdapt: a.replicable?.howToAdapt || "" },
  topics: (a.topics || []).map(String),
  ...(a.performance ? { performance: { explanation: a.performance.explanation || "" } } : {}),
  ...(a.playbook ? { playbook: { hookVariants: (a.playbook.hookVariants || []).map(String), shotList: (a.playbook.shotList || []).map((x: any) => ({ shot: x.shot || "", note: x.note || "" })), captionDraft: a.playbook.captionDraft || "" } } : {}),
});
const s = { type: "string" };
const obj = (keys: string[]) => ({ type: "object", additionalProperties: false, properties: Object.fromEntries(keys.map((k) => [k, s])), required: keys });
const ES_BASE = ["summary", "whyItWorks", "hook", "format", "angle", "visualBreakdown", "scrollStoppers", "replicable", "topics"];
const esSchema = (a: any) => ({ type: "object", additionalProperties: false, required: [...ES_BASE, ...(a.performance ? ["performance"] : []), ...(a.playbook ? ["playbook"] : [])], properties: {
  summary: s, whyItWorks: s, hook: obj(["category", "template", "whyItWorks"]), format: obj(["category", "type", "visualLayout", "pacing"]), angle: obj(["topic", "angle"]),
  visualBreakdown: { type: "array", items: obj(["shot", "why"]) }, scrollStoppers: { type: "array", items: obj(["moment", "why"]) },
  replicable: obj(["howToAdapt"]), topics: { type: "array", items: s },
  performance: obj(["explanation"]),
  playbook: { type: "object", additionalProperties: false, required: ["hookVariants", "shotList", "captionDraft"], properties: { hookVariants: { type: "array", items: s }, shotList: { type: "array", items: obj(["shot", "note"]) }, captionDraft: s } } } });

async function spanish(postId: number, userId: string) {
  // only someone who can read the analysis (their unlock is completed) asks for its Spanish version
  const [u] = await (await rest(`user_ai_unlocks?select=analysis_id&user_id=eq.${userId}&post_id=eq.${postId}&status=eq.completed`)).json();
  if (!u?.analysis_id) return json({ error: "Unlock the analysis first" }, 403);
  const [row] = await (await rest(`ai_analyses?select=id,result&id=eq.${u.analysis_id}`)).json();
  const a = row?.result;
  if (!a) return json({ error: "Analysis not found" }, 404);
  if (a.es) return json({ status: "ok", es: a.es });
  const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const src = textOf(a);
  const res: any = await claude.messages.create({
    model: env("TRANSLATE_MODEL") || "claude-sonnet-5-5", max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: esSchema(a) } },
    system: TRANSLATE, messages: [{ role: "user", content: JSON.stringify(src) }],
  } as never);
  if (res.stop_reason !== "end_turn") return json({ error: `Translation stopped: ${res.stop_reason}` }, 502);
  const t = JSON.parse(res.content.find((b: { type: string }) => b.type === "text")?.text || "{}");
  if (/[\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/.test(JSON.stringify(t))) return json({ error: "Translation failed the check" }, 502);
  // the whole shape, so a page shows a.es over a: lists keep their times (t), the post's own words stay as they were
  const es = {
    ...t,
    hook: { ...a.hook, ...t.hook },
    format: { ...a.format, ...t.format },
    angle: { ...a.angle, ...t.angle },
    replicable: { ...a.replicable, ...t.replicable },
    ...(a.performance ? { performance: { ...a.performance, ...t.performance } } : {}),
    visualBreakdown: (a.visualBreakdown || []).map((x: any, i: number) => ({ ...x, ...(t.visualBreakdown?.[i] || {}) })),
    scrollStoppers: (a.scrollStoppers || []).map((x: any, i: number) => ({ ...x, ...(t.scrollStoppers?.[i] || {}) })),
  };
  await rest(`ai_analyses?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ result: { ...a, es } }), headers: { Prefer: "return=minimal" } });
  return json({ status: "ok", es });
}

// The verdict comes from the numbers, never from the model: too early under 48 h, then views (or likes + comments) against the account median
function verdictOf(n: any) {
  if (!n || n.numbers_counted_hours_after_publishing == null) return "no_data";
  if (n.numbers_counted_hours_after_publishing < 48) return "too_early";
  const r = n.views_vs_median ?? n.engagement_vs_median;
  if (r == null) return "no_data";
  return r >= 2 ? "overperformed" : r <= 0.5 ? "underperformed" : "in_line";
}

// Post + image (or video frames) -> Claude -> the analysis and what it cost (v2: with the post's numbers and the playbook)
type Video = { duration: number; frames: { t: number; data: string }[]; transcript: string; language: string | null } | null;
async function analyse(postId: number, v2: boolean, video: Video = null) {
  const [post] = await (await rest(`content_ideas?select=id,url,title,cover_url,content_idea_tags(idea_catalog(category,name))&id=eq.${postId}`)).json();
  if (!post) throw new Error("Post not found");
  const tags: Record<string, string[]> = {};
  for (const t of post.content_idea_tags || []) if (t.idea_catalog) (tags[t.idea_catalog.category] ||= []).push(t.idea_catalog.name);
  const numbers = v2 ? await rpc("post_benchmark", { p_post_id: postId }).catch(() => ({})) : null;
  const frames = video?.frames?.length ? video.frames : null;
  const image = frames ? null : (await storedCover(post.cover_url)) || (await coverImage(post.url));
  if (!frames && !image) throw new Error("Couldn't load the post image (removed or private post)");
  const visual = frames
    ? frames.flatMap((f) => [{ type: "text", text: `Frame at ${f.t}s` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } }])
    : [{ type: "image", source: { type: "base64", media_type: image!.type, data: image!.data } }];

  // Claude
  const model = env("AI_MODEL") || "claude-sonnet-5-5";
  const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const response = await claude.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: v2 ? SCHEMA : SCHEMA_V1 } },
    system: v2 ? SYSTEM + SYSTEM_V2 : SYSTEM,
    messages: [{ role: "user", content: [
      ...visual,
      { type: "text", text: `${frames ? `Frames: ${frames.length} over ${video!.duration}s\nTranscript (${video!.language || "none"}): ${video!.transcript || "(nobody speaks)"}\n` : ""}Tags: ${JSON.stringify(tags)}\nFormat: ${tags.format?.[0] || "unknown"}${v2 ? `\nMedia: ${numbers?.media_type || "unknown"}\nNumbers: ${JSON.stringify(numbers || {})}\nVerdict: ${verdictOf(numbers)}` : ""}\nCaption:\n${(post.title || "").slice(0, 2000)}` },
    ] }],
  } as never);
  // deno-lint-ignore no-explicit-any
  const res = response as any;
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Model stopped: ${res.stop_reason}`);
  const text = res.content.find((b: { type: string }) => b.type === "text")?.text;
  const analysis = { ...JSON.parse(text), basis: frames ? "video" : "image", ...(v2 ? { version: ANALYSIS_VERSION } : {}) };
  if (v2) analysis.performance = { ...analysis.performance, verdict: verdictOf(numbers) };
  const inTok = res.usage?.input_tokens ?? 0, outTok = res.usage?.output_tokens ?? 0;
  const [pIn, pOut] = PRICES[res.model || model] || [0, 0];
  const cost = (inTok * Number(env("AI_PRICE_IN_PER_MTOK") || pIn) + outTok * Number(env("AI_PRICE_OUT_PER_MTOK") || pOut)) / 1e6;

  return { analysis, model: res.model || model, inTok, outTok, cost, numbers };
}

// A video post (reel, TikTok, YouTube, Facebook video): its analysis can come from the video itself
const VIDEO_URL = /instagram\.com\/(?:[\w.]+\/)?reel\/|tiktok\.com\/|youtube\.com\/|youtu\.be\/|facebook\.com\/.*\/videos?\/|fb\.watch\//i;
async function isVideo(postId: number) {
  const [p] = await (await rest(`content_ideas?select=url,media_type&id=eq.${postId}`)).json();
  return !!p && (p.media_type === "reel" || p.media_type === "video" || VIDEO_URL.test(p.url || ""));
}
// Starts the GitHub Actions workflow that reads the video; false when it can't (no token, GitHub down): use the cover
async function startVideoWorker(postId: number) {
  if (!env("GH_DISPATCH_TOKEN")) return false;
  const r = await fetch("https://api.github.com/repos/martiruiz/newscp2627/actions/workflows/ai-video.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("GH_DISPATCH_TOKEN")}`, Accept: "application/vnd.github+json", "User-Agent": "scp-ai-analyze", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { post_id: String(postId) } }),
  }).catch(() => null);
  return r?.status === 204;
}

// The worker sends the service key (legacy JWT or new secret key, whichever pipeline/.env and GitHub hold): it is the
// worker if the database accepts that key for a function only the service role may run
async function isWorker(req: Request) {
  const key = req.headers.get("x-worker-key") || "";
  if (!key) return false;
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/post_benchmark`, {
    method: "POST", body: JSON.stringify({ p_post_id: 0 }),
    headers: { apikey: key, "Content-Type": "application/json", ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) },
  }).catch(() => null);
  return r?.ok === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The video worker (ai-video.mjs) posts back the frames and the transcript; with preview it only returns the analysis
  if (await isWorker(req)) {
    const { post_id, video, preview } = await req.json().catch(() => ({}));
    const postId = Number(post_id);
    if (!postId) return json({ error: "post_id required" }, 400);
    if (preview) return analyse(postId, true, video).then((r) => json(r)).catch((e) => json({ error: String((e as Error)?.message || e) }, 500));
    try {
      const r = await analyse(postId, LIVE_V2, video).catch(() => (video ? analyse(postId, LIVE_V2) : Promise.reject(new Error("no analysis"))));
      await rpc("complete_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_result: r.analysis, p_model: r.model, p_input_tokens: r.inTok, p_output_tokens: r.outTok, p_cost_usd: r.cost, p_source: "api" });
      return json({ status: "unlocked", basis: r.analysis.basis });
    } catch (e) {
      await rpc("fail_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_error: String((e as Error)?.message || e) }).catch(() => null);
      return json({ status: "failed" }, 500);
    }
  }

  // 1. Who is calling?
  const userRes = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: req.headers.get("Authorization") ?? "" } });
  if (!userRes.ok) return json({ error: "Not signed in" }, 401);
  const user = await userRes.json();
  const { post_id, lang, preview } = await req.json().catch(() => ({}));
  const postId = Number(post_id);
  if (!postId) return json({ error: "post_id required" }, 400);
  // Admins only: the v2 analysis of any post, returned and not stored (nothing unlocked, nothing charged)
  if (preview) {
    const admin = await (await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" })).json().catch(() => false);
    if (admin !== true) return json({ error: "Admins only" }, 403);
    return analyse(postId, true).then((r) => json(r)).catch((e) => json({ error: String((e as Error)?.message || e) }, 500));
  }
  if (lang === "es") return spanish(postId, user.id).catch((e) => json({ error: String((e as Error)?.message || e) }, 500));

  // Only someone who has paid (pending unlock) can trigger a generation
  const unlock = await (await rest(`user_ai_unlocks?select=status&user_id=eq.${user.id}&post_id=eq.${postId}`)).json();
  if (!unlock[0]) return json({ error: "Unlock the analysis first" }, 403);
  if (unlock[0].status === "completed") return json({ status: "unlocked" });

  // 2. One generation per post: if someone else is already generating it, the browser just keeps polling
  const claimed = await rpc("claim_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION });
  if (!claimed) return json({ status: "pending" });

  // Videos: the workflow reads the video and posts the analysis back; the browser keeps polling
  if (LIVE_VIDEO && await isVideo(postId) && await startVideoWorker(postId)) return json({ status: "pending" });

  try {
    const { analysis, model, inTok, outTok, cost } = await analyse(postId, LIVE_V2);
    await rpc("complete_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_result: analysis, p_model: model, p_input_tokens: inTok, p_output_tokens: outTok, p_cost_usd: cost, p_source: "api" });
    return json({ status: "unlocked" });
  } catch (e) {
    // 4. Nobody keeps paying for an analysis that couldn't be generated
    await rpc("fail_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_error: String((e as Error)?.message || e) }).catch(() => null);
    return json({ status: "failed", error: "We couldn't generate this analysis. Your credit has been refunded." }, 200);
  }
});

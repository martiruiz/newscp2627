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
// POST { post_id, lang: "es" }: the Spanish version of an analysis the caller has unlocked, made the first time someone
// reads it in Spanish and kept inside the analysis (result.es, same shape), so it's made only once per analysis.
//
// Secrets: ANTHROPIC_API_KEY; optional AI_MODEL (default claude-sonnet-5-5: faster and cheaper than Opus for this task),
//          AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK (USD per million tokens, to record the real cost).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

const PROMPT_VERSION = "v1";
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
For videos you only see the cover image: base the visual breakdown on what the cover and caption show and keep it short.`;
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
    topics: { type: "array", items: { type: "string" } },
    moment: { type: "string", enum: ["matchday", "signing", "kit", "sponsor", "behind_the_scenes", "fans", "milestone", "community", "ticketing", "training", "humour", "other"] },
    style: { type: "string", enum: ["talking_head", "pov", "meme", "graphic", "montage", "interview", "challenge", "vlog", "live_action", "other"] },
    language: { type: "string" },
  },
  required: ["summary", "whyItWorks", "hook", "format", "angle", "visualBreakdown", "scrollStoppers", "replicable", "topics", "moment", "style", "language"],
};

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
});
const s = { type: "string" };
const obj = (keys: string[]) => ({ type: "object", additionalProperties: false, properties: Object.fromEntries(keys.map((k) => [k, s])), required: keys });
const ES_SCHEMA = { type: "object", additionalProperties: false, required: ["summary", "whyItWorks", "hook", "format", "angle", "visualBreakdown", "scrollStoppers", "replicable", "topics"], properties: {
  summary: s, whyItWorks: s, hook: obj(["category", "template", "whyItWorks"]), format: obj(["category", "type", "visualLayout", "pacing"]), angle: obj(["topic", "angle"]),
  visualBreakdown: { type: "array", items: obj(["shot", "why"]) }, scrollStoppers: { type: "array", items: obj(["moment", "why"]) },
  replicable: obj(["howToAdapt"]), topics: { type: "array", items: s } } };

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
    output_config: { format: { type: "json_schema", schema: ES_SCHEMA } },
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
    visualBreakdown: (a.visualBreakdown || []).map((x: any, i: number) => ({ ...x, ...(t.visualBreakdown?.[i] || {}) })),
    scrollStoppers: (a.scrollStoppers || []).map((x: any, i: number) => ({ ...x, ...(t.scrollStoppers?.[i] || {}) })),
  };
  await rest(`ai_analyses?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ result: { ...a, es } }), headers: { Prefer: "return=minimal" } });
  return json({ status: "ok", es });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1. Who is calling?
  const userRes = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: req.headers.get("Authorization") ?? "" } });
  if (!userRes.ok) return json({ error: "Not signed in" }, 401);
  const user = await userRes.json();
  const { post_id, lang } = await req.json().catch(() => ({}));
  const postId = Number(post_id);
  if (!postId) return json({ error: "post_id required" }, 400);
  if (lang === "es") return spanish(postId, user.id).catch((e) => json({ error: String((e as Error)?.message || e) }, 500));

  // Only someone who has paid (pending unlock) can trigger a generation
  const unlock = await (await rest(`user_ai_unlocks?select=status&user_id=eq.${user.id}&post_id=eq.${postId}`)).json();
  if (!unlock[0]) return json({ error: "Unlock the analysis first" }, 403);
  if (unlock[0].status === "completed") return json({ status: "unlocked" });

  // 2. One generation per post: if someone else is already generating it, the browser just keeps polling
  const claimed = await rpc("claim_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION });
  if (!claimed) return json({ status: "pending" });

  try {
    const [post] = await (await rest(`content_ideas?select=id,url,title,cover_url,content_idea_tags(idea_catalog(category,name))&id=eq.${postId}`)).json();
    if (!post) throw new Error("Post not found");
    const tags: Record<string, string[]> = {};
    for (const t of post.content_idea_tags || []) if (t.idea_catalog) (tags[t.idea_catalog.category] ||= []).push(t.idea_catalog.name);
    const image = (await storedCover(post.cover_url)) || (await coverImage(post.url));
    if (!image) throw new Error("Couldn't load the post image (removed or private post)");

    // 3. Claude
    const model = env("AI_MODEL") || "claude-sonnet-5-5";
    const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
    const response = await claude.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.data } },
        { type: "text", text: `Tags: ${JSON.stringify(tags)}\nFormat: ${tags.format?.[0] || "unknown"}\nCaption:\n${(post.title || "").slice(0, 2000)}` },
      ] }],
    } as never);
    // deno-lint-ignore no-explicit-any
    const res = response as any;
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Model stopped: ${res.stop_reason}`);
    const text = res.content.find((b: { type: string }) => b.type === "text")?.text;
    const analysis = { ...JSON.parse(text), basis: "image" };
    const inTok = res.usage?.input_tokens ?? 0, outTok = res.usage?.output_tokens ?? 0;
    const cost = (inTok * Number(env("AI_PRICE_IN_PER_MTOK") || 0) + outTok * Number(env("AI_PRICE_OUT_PER_MTOK") || 0)) / 1e6;

    await rpc("complete_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_result: analysis, p_model: res.model || model, p_input_tokens: inTok, p_output_tokens: outTok, p_cost_usd: cost, p_source: "api" });
    return json({ status: "unlocked" });
  } catch (e) {
    // 4. Nobody keeps paying for an analysis that couldn't be generated
    await rpc("fail_generation", { p_post_id: postId, p_prompt_version: PROMPT_VERSION, p_error: String((e as Error)?.message || e) }).catch(() => null);
    return json({ status: "failed", error: "We couldn't generate this analysis. Your credit has been refunded." }, 200);
  }
});

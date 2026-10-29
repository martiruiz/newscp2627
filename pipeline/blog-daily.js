// SCP daily blog post (GitHub Action "Daily blog post", every morning): one new SEO article a day, written by Claude from
// today's daily-analysis reel topics (Content hub, content_items V16…) or, when there are none, the latest Social News.
//   node blog-daily.js   → content/blog/<slug>.json + its cover in assets/blog/, checked with blog-tools/build.mjs --check,
//                          saved in blog_posts (Admin → Blog). The workflow commits it and runs "Publish blog".
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { stripHtml, pageImages } from "./fetch.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = new Anthropic();
const MODEL = "claude-sonnet-5-5";   // the cheaper model that writes well enough (one post a day)
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "blog-tools/keywords.json"), "utf8"));
const posts = fs.readdirSync(path.join(ROOT, "content/blog")).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content/blog", f), "utf8")));
if (posts.some((p) => !p.legacy && p.date === today)) { console.log(`There is already a post dated ${today}: nothing to do.`); process.exit(0); }
const recent = posts.filter((p) => !p.legacy).sort((a, b) => b.date.localeCompare(a.date));
const example = recent[0];

// ---------- 1. The material: today's reel topics, or the latest Social News ----------
let material, origin;
const { data: topics, error } = await db.from("content_items").select("topic, source, note, script")
  .ilike("vertical", "V16%").gte("pub_date", yesterday).lte("pub_date", today).neq("stage", "Descartat");
if (error) throw error;
if (topics?.length) {
  origin = "today's daily-analysis reel topics";
  material = topics.map((t, i) => `### Topic ${i + 1}: ${t.topic}\nScript (real figures):\n${t.script || "-"}\nSources: ${t.source || "-"}\nNote: ${t.note || "-"}`).join("\n\n");
} else {
  const { data: news, error: e2 } = await db.from("news").select("title, paragraphs, url, source_name")
    .eq("relevant", true).gte("published_at", new Date(Date.now() - 3 * 864e5).toISOString()).order("published_at", { ascending: false }).limit(12);
  if (e2) throw e2;
  if (!news?.length) { console.log("No reel topics and no recent Social News: no post today."); process.exit(1); }
  origin = "the latest Social News";
  material = news.map((n, i) => `### Topic ${i + 1}: ${n.title}\n${n.paragraphs.join("\n")}\nSource: ${n.source_name} ${n.url.replace(/#.*$/, "")}`).join("\n\n");
}

// the source pages: their text (so figures can be checked) and their picture (the cover)
const urls = [...new Set((material.match(/https?:\/\/[^\s)"'<>\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))]
  .filter((u) => !/(^|[/.])(instagram|tiktok|youtube|x|twitter)\.com|youtu\.be/.test(u)).slice(0, 10);
const pages = [];
for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) continue;
    const html = await r.text();
    const text = stripHtml(html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html).slice(0, 6000);
    const og = (await pageImages(url).catch(() => ({}))).og || null;
    pages.push({ url, text, og });
  } catch (e) { console.warn(`  ! ${url}: ${e.message}`); }
}
const pictures = pages.filter((p) => p.og);

// ---------- 2. Claude writes the post ----------
const kw = cfg.keywords.map((k, i) => `${i + 1}. ${k.keyword}`).join("\n");
const types = Object.entries(cfg.types).map(([k, t]) => `- "${k}" (${t.label}): ${t.min_words}–${t.max_words} words`).join("\n");
const SYSTEM = `You write the daily blog post of Sports Content Playbook (SCP), a content library of sports social media posts (filters by sport, platform, format and performance, smart AI labels Top Picks / Replicable Ideas / Overperforming, saved folders, updated every day) for the social media teams of clubs, leagues, federations, athletes and sports brands. Never claim features beyond these.

Write ONE new post in English, from the material you are given:
- Pick the single topic with the most value for sports social media managers, not already covered by the existing posts.
- Pick the type that fits:\n${types}\n  The body_html word count MUST be inside that range. Prefer "ideas" at least twice a week (the recent types are listed).
- Angle: the topic is the starting point. Turn it into a broader message about the content strategy of the profiles whose content stands out: what they do consistently, which formats and platforms they combine, and the pattern other teams can apply. Brand voice: analysis, never criticism; explain WHY something works and what a club or brand can replicate. Short, clear sentences, always actionable.
- Never invent figures, dates, quotes or posts: only use what is in the material or the source pages. Credit the sources (sources field).
- Structure: strong intro, 3–5 <h2> sections (<h3> where useful), a practical list of ideas, a short takeaway. body_html uses only <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <a>.
- Specific posts, reels or profiles: only mention one if its URL (Instagram post/reel, TikTok video, YouTube video/Short or X post) appears in the material; then show it right after the paragraph that mentions it with <div class="embed" data-embed="URL" data-caption="who, what, key metric"></div> and list it in references [{name, url}] with the same URL. Otherwise don't name specific posts, and references is [].
- SEO: ALL 15 keywords below must appear in every post, each at least once in normal paragraph or list text (not only in headings or links), written in sentence case (lowercase except proper nouns like Instagram, TikTok, AI). Don't link them yourself.\n${kw}
  primary_keyword: one keyword from #6–#15 that best matches the topic, used in the title or meta_title, meta_description, the first paragraph, one <h2> and image_alt.
- Add 1–2 natural inline sentences showing how SCP helps with this exact topic, linking to pricing.html or signup.html.
- meta_title ≤ 60 characters, meta_description ≤ 150 characters. slug: kebab-case, includes the primary keyword idea. faq: 3–4 questions with short answers. takeaways: 3–5 one-sentence points. cta_title + cta_text: a mid-article box tailored to the topic.
- cover: the number of the source picture that best illustrates the post (0 if none fits).`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["slug", "title", "meta_title", "meta_description", "type", "primary_keyword", "excerpt", "cta_title", "cta_text", "body_html", "references", "sources", "faq", "takeaways", "image_alt", "cover"],
  properties: {
    slug: { type: "string" }, title: { type: "string" }, meta_title: { type: "string" }, meta_description: { type: "string" },
    type: { type: "string", enum: Object.keys(cfg.types) }, primary_keyword: { type: "string" }, excerpt: { type: "string" },
    cta_title: { type: "string" }, cta_text: { type: "string" }, body_html: { type: "string" }, image_alt: { type: "string" }, cover: { type: "integer" },
    references: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "url"], properties: { name: { type: "string" }, url: { type: "string" } } } },
    sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "url"], properties: { name: { type: "string" }, url: { type: "string" } } } },
    faq: { type: "array", items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } } },
    takeaways: { type: "array", items: { type: "string" } },
  },
};

const user = `Today: ${today}. Material (${origin}):\n\n${material}\n\n## Source pages\n${pages.map((p, i) => `### ${p.url}\n${p.text}`).join("\n\n") || "(none could be read)"}\n\n## Source pictures (for "cover")\n${pictures.map((p, i) => `${i + 1}. picture of ${p.url}`).join("\n") || "(none: cover = 0)"}\n\n## Existing posts (don't repeat these topics)\n${posts.map((p) => `- ${p.title}`).join("\n")}\n\n## Recent types\n${recent.slice(0, 6).map((p) => `${p.date} ${p.type}`).join(", ")}\n\n## Example of a finished post (format reference only)\n${JSON.stringify({ title: example.title, type: example.type, primary_keyword: example.primary_keyword, body_html: example.body_html })}`;

const usage = { input: 0, output: 0 };
const messages = [{ role: "user", content: user }];
async function write() {
  const response = await client.messages.stream({
    model: MODEL, max_tokens: 32000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM, messages,
  }).finalMessage();
  usage.input += response.usage.input_tokens ?? 0;
  usage.output += response.usage.output_tokens ?? 0;
  if (response.stop_reason !== "end_turn") throw new Error(`Claude stopped: ${response.stop_reason}`);
  const text = response.content.find((b) => b.type === "text")?.text;
  messages.push({ role: "assistant", content: text });
  return JSON.parse(text);
}

const save = (out) => {
  const file = `${out.slug}.jpg`;
  const pic = pictures[out.cover - 1];
  const host = pic && new URL(pic.url).hostname.replace(/^www\./, "");
  const post = {
    slug: out.slug, title: out.title, meta_title: out.meta_title, meta_description: out.meta_description, type: out.type, date: today,
    author: "Martí Ruiz", primary_keyword: out.primary_keyword, keywords: cfg.keywords.map((k) => k.keyword), excerpt: out.excerpt,
    cta_title: out.cta_title, cta_text: out.cta_text, references: out.references, sources: out.sources, faq: out.faq, takeaways: out.takeaways,
    image: { file, alt: out.image_alt, title: out.title, credit: pic ? { author: host, source_url: pic.url } : { author: "Sports Content Playbook", source_url: "https://sportscontentplaybook.com" } },
    body_html: out.body_html,
  };
  const jsonPath = path.join(ROOT, "content/blog", `${out.slug}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(post, null, 2)}\n`);
  // the cover: the source's photo (its credit printed under it), or the branded SCP cover when there is none
  try {
    if (pic) execFileSync("python3", [path.join(ROOT, "blog-tools/photo.py"), jsonPath, pic.og], { stdio: "inherit" });
    else throw new Error("no source picture");
  } catch (e) {
    console.warn(`  cover from the source failed (${e.message}): branded cover`);
    post.image.credit = { author: "Sports Content Playbook", source_url: "https://sportscontentplaybook.com" };
    fs.writeFileSync(jsonPath, `${JSON.stringify(post, null, 2)}\n`);
    execFileSync("python3", [path.join(ROOT, "blog-tools/cover.py"), jsonPath], { stdio: "inherit" });
  }
  return { post, jsonPath };
};

// ---------- 3. Checked by the blog's build; its problems go back to Claude (up to 3 rewrites) ----------
let saved;
for (let attempt = 1; ; attempt++) {
  const out = await write();
  if (saved && saved.post.slug !== out.slug) fs.rmSync(saved.jsonPath, { force: true });   // a rewrite with a new slug: no stray file
  saved = save(out);
  let log = "";
  try { execFileSync("node", [path.join(ROOT, "blog-tools/build.mjs"), "--check"], { encoding: "utf8", stdio: "pipe" }); break; }
  catch (e) { log = `${e.stdout || ""}${e.stderr || ""}`; }
  const mine = log.split(/\n(?=✗ )/).filter((b) => b.startsWith("✗") && b.includes(out.slug)).join("\n");
  if (!mine) throw new Error(`The blog's build fails on other posts:\n${log}`);
  console.warn(`  attempt ${attempt}: the build found problems\n${mine}`);
  if (attempt === 4) throw new Error("The post still doesn't pass the build's checks after 3 rewrites.");
  messages.push({ role: "user", content: `The blog's build rejected the post:\n${mine}\nFix exactly these problems (keep everything else) and return the whole post again.` });
}

// ---------- 4. Saved in the admin (Admin → Blog): "Publish blog" builds it and adds the Spanish version ----------
const { slug, ...data } = saved.post;
const { error: e3 } = await db.from("blog_posts").upsert({ slug, data, draft: false, updated_at: new Date().toISOString() }, { onConflict: "slug" });
if (e3) throw e3;
fs.writeFileSync(path.join(ROOT, ".daily-post"), `${slug}\n${saved.post.image.file}\n`);
// Sonnet list price: $3 / $15 per MTok
console.log(`\n✓ ${saved.post.title} (${saved.post.type}, from ${origin}) → https://sportscontentplaybook.com/blog/${slug}.html`);
console.log(`Claude usage: ${usage.input} + ${usage.output} tokens ≈ $${((usage.input * 3 + usage.output * 15) / 1e6).toFixed(2)}`);

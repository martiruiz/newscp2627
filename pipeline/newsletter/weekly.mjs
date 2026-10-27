#!/usr/bin/env node
// Weekly SCP newsletter → Resend broadcast DRAFT (approved by a human in Resend before it goes out).
//
//   node newsletter/weekly.mjs            → builds this week's issue, creates the draft, emails a preview to NEWSLETTER_REVIEW_TO
//   node newsletter/weekly.mjs --dry-run  → builds it and writes newsletter-preview.html, nothing is sent or saved
//
// Structure: header + intro · Social News ("This week on SCP": top story + other headlines) · 4 featured posts from the
// Content Library · 3 blog articles with photo · social icons. Claude writes the intro, the top-story take, a short
// description per featured post and a teaser per article.
// Subscribers = website sign-ups + members who opted in on their profile (synced to the Resend segment before each issue).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, RESEND_SEGMENT_ID,
//      NEWSLETTER_FROM, NEWSLETTER_REVIEW_TO (who receives the preview)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadEnv } from "../library/env.mjs";
import { igEmbed } from "../library/instagram.mjs";
import { articleImage } from "./news-image.mjs";
import { renderWeekly, SITE } from "./template.mjs";

loadEnv();
const DRY = process.argv.includes("--dry-run");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = (k) => process.env[k] || "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Monday of this week (Europe/Madrid) identifies the issue
const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
const weekStart = monday.toISOString().slice(0, 10);
const since = new Date(Date.now() - 7 * 864e5).toISOString();
const dateLabel = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

if (!DRY) {
  const { data: existing } = await db.from("newsletter_issues").select("id").eq("week_start", weekStart).maybeSingle();
  if (existing) { console.log(`Issue for the week of ${weekStart} already exists — nothing to do.`); process.exit(0); }
}

// ---------- 1. Gather content ----------
const { data: newsData } = await db.from("news").select("id,url,source_name,platform,title,paragraphs,published_at")
  .eq("relevant", true).gte("published_at", since).order("published_at", { ascending: false }).limit(12);
const newsRows = newsData || [];

// Featured posts: newest imports (analysed ones first); fallback to the newest overall
// Posts a superadmin removed from the library (supabase/quality.sql) never go out
const removedPosts = new Set(((await db.from("content_removals").select("external_id")).data || []).map((r) => r.external_id));
const postSelect = "id,external_id,url,title,cover_url,published_at,ai_analyses(result),content_idea_tags(idea_catalog(category,name))";
let { data: postRows } = await db.from("content_ideas").select(postSelect)
  .is("unavailable_at", null).gte("created_at", since).order("analyzed_at", { ascending: false, nullsFirst: false }).limit(16);
if ((postRows || []).length < 4) {
  ({ data: postRows } = await db.from("content_ideas").select(postSelect)
    .is("unavailable_at", null).order("analyzed_at", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false }).limit(16));
}
const tagsOf = (p) => { const t = {}; for (const { idea_catalog: v } of p.content_idea_tags || []) if (v) (t[v.category] ||= []).push(v.name); return t; };
const libPosts = (postRows || []).filter((p) => !removedPosts.has(p.external_id)).map((p) => ({ ...p, analysis: p.ai_analyses?.[0]?.result || null, tags: tagsOf(p) }));

const blogDir = path.join(ROOT, "content/blog");
const blogPosts = fs.existsSync(blogDir)
  ? fs.readdirSync(blogDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(blogDir, f), "utf8")))
      .filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  : [];

if (!newsRows.length && !blogPosts.length) { console.log("No content this week — skipping."); process.exit(0); }
console.log(`Content: ${newsRows.length} news, ${libPosts.length} library posts, ${blogPosts.length} blog article(s)`);

// ---------- 2. Claude: pick and write ----------
const SYSTEM = `You write the weekly newsletter of Sports Content Playbook (SCP), a content-intelligence platform for the social media teams of sports clubs, leagues, athletes and sports brands.

You receive this week's Social News (sports digital marketing / platform / AI news) and our latest blog articles. Write in English: warm, expert, short sentences, no hype, no emojis.

Return:
- subject: max 60 characters, specific and curiosity-driven, no emojis.
- preheader: max 110 characters, complements the subject.
- intro: 1–2 sentences, "In this edition: …" summarising the most interesting things inside. Do not greet (the greeting is added for you). You may bold 1–3 key names with **double asterisks**.
- topStory: the single most important news item for sports social teams (by id) and "take": 2 sentences on what happened and what it means for a club.
- news: up to 6 other useful news item ids, most relevant first (not the top story).
- posts: pick 4 featured posts (by id) from the Content Library material, varied in sport, format and account, preferring ones with hasCover true (the e-mail shows their image) and ones with an analysis. For each, "description": 1–2 sentences (max 35 words) on why it's worth studying and how a club could use the idea. You may bold one key idea with **double asterisks**.
- blogs: for EACH blog article given (by slug), "teaser": 2 short paragraphs (35–60 words each) that make people want to read it. Bold key names or figures that appear in the article with **double asterisks** (max 3 per paragraph).
Only use facts present in the material. Never invent numbers, results or quotes.`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    subject: { type: "string" }, preheader: { type: "string" }, intro: { type: "string" },
    topStory: { type: ["object", "null"], additionalProperties: false, properties: { id: { type: "integer" }, take: { type: "string" } }, required: ["id", "take"] },
    news: { type: "array", items: { type: "integer" } },
    posts: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "integer" }, description: { type: "string" } }, required: ["id", "description"] } },
    blogs: { type: "array", items: { type: "object", additionalProperties: false, properties: { slug: { type: "string" }, teaser: { type: "array", items: { type: "string" } } }, required: ["slug", "teaser"] } },
  },
  required: ["subject", "preheader", "intro", "topStory", "news", "posts", "blogs"],
};
const Result = z.object({
  subject: z.string().min(5), preheader: z.string(), intro: z.string().min(10),
  topStory: z.object({ id: z.number(), take: z.string() }).nullable(),
  news: z.array(z.number()),
  posts: z.array(z.object({ id: z.number(), description: z.string() })),
  blogs: z.array(z.object({ slug: z.string(), teaser: z.array(z.string()) })),
});

const plain = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const material = {
  news: newsRows.map((n) => ({ id: n.id, platform: n.platform, title: n.title, summary: (n.paragraphs || []).join(" ").slice(0, 900) })),
  posts: libPosts.map((p) => ({
    id: p.id, account: p.tags.club?.[0] || p.tags.entity?.[0] || "", sport: p.tags.sport?.[0] || "", format: p.tags.format?.[0] || "",
    hasCover: !!p.cover_url, caption: (p.title || "").slice(0, 400),
    analysis: p.analysis ? { summary: p.analysis.summary, hook: p.analysis.hook?.text, whyItWorks: p.analysis.whyItWorks, howToAdapt: p.analysis.replicable?.howToAdapt } : null,
  })),
  blogs: blogPosts.map((b) => ({ slug: b.slug, title: b.title, excerpt: b.excerpt, text: plain(b.body_html).slice(0, 2500) })),
};

const claude = new Anthropic();
const response = await claude.beta.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
  system: SYSTEM,
  messages: [{ role: "user", content: `This week's material (JSON):\n${JSON.stringify(material, null, 2)}` }],
});
if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") throw new Error(`Claude stopped: ${response.stop_reason}`);
const out = Result.parse(JSON.parse(response.content.find((b) => b.type === "text").text));
console.log(`Claude: "${out.subject}" (${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens)`);

// ---------- 3. Assemble ----------
const newsById = new Map(newsRows.map((n) => [n.id, n]));
const newsLink = (n) => `${SITE}/news.html#news-${n.id}`;
const top = out.topStory && newsById.get(out.topStory.id);
// each news item gets its article's cover image, copied to our public bucket
const newsImage = (n) => articleImage(n.url, async (buf, ext, type) => {
  if (DRY) return `data:${type};base64,${buf.toString("base64")}`;
  const file = `${weekStart}/news-${n.id}.${ext}`;
  const { error } = await db.storage.from("newsletter").upload(file, buf, { contentType: type, upsert: true });
  return error ? null : db.storage.from("newsletter").getPublicUrl(file).data.publicUrl;
});
const topStory = top ? { title: top.title, take: out.topStory.take, platform: top.platform, link: newsLink(top), image: await newsImage(top) } : null;
const news = await Promise.all(out.news.filter((id) => id !== top?.id).map((id) => newsById.get(id)).filter(Boolean).slice(0, 6)
  .map(async (n) => ({ title: n.title, platform: n.platform, link: newsLink(n), image: await newsImage(n) })));
// Featured posts: copy each cover image to our public bucket (Instagram image links expire)
async function stableImage(post) {
  if (post.cover_url) return post.cover_url; // library cover, already in our public "covers" bucket
  try {
    const { image } = await igEmbed(post.url);
    if (!image) return null;
    if (DRY) return image;
    const buf = Buffer.from(await (await fetch(image)).arrayBuffer());
    const file = `${weekStart}/${post.id}.jpg`;
    const { error } = await db.storage.from("newsletter").upload(file, buf, { contentType: "image/jpeg", upsert: true });
    return error ? null : db.storage.from("newsletter").getPublicUrl(file).data.publicUrl;
  } catch { return null; }
}
const libById = new Map(libPosts.map((p) => [p.id, p]));
const posts = [];
for (const pick of out.posts) {
  const p = libById.get(pick.id);
  if (!p || posts.length >= 4) continue;
  const format = p.tags.format?.[0] || "";
  posts.push({
    who: p.tags.club?.[0] || p.tags.entity?.[0] || "Post", format, sport: p.tags.sport?.[0] || "",
    reel: /reel|video|short/i.test(format) || /\/reel\//.test(p.url || ""),
    description: pick.description, image: await stableImage(p), url: p.url,
    library: `${SITE}/content-library.html#post=${p.id}`, // opens the post (with its embed) in the Content Library
    analysis: p.analysis ? `${SITE}/content-library.html#post=${p.id}` : null,
  });
}

const TYPE = { news: "News & updates", trends: "Social media trends", ideas: "Sports content ideas" };
const teasers = new Map(out.blogs.map((b) => [b.slug, b.teaser.slice(0, 2)]));
const blogs = blogPosts.map((b) => ({
  title: b.title, type: TYPE[b.type] || "Blog",
  date: new Date(`${b.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
  image: `${SITE}/assets/blog/${b.image?.file}`, link: `${SITE}/blog/${b.slug}.html`,
  teaser: teasers.get(b.slug)?.length ? teasers.get(b.slug) : [b.excerpt],
}));

const { count: pastIssues } = await db.from("newsletter_issues").select("id", { count: "exact", head: true });
// everything the email shows, saved with the issue so it can be edited in Admin → Audience → Newsletter (and re-rendered)
const content = { subject: out.subject, preheader: out.preheader, intro: out.intro, topStory, news, posts, blogs, dateLabel, issue: (pastIssues || 0) + 1 };
const html = renderWeekly(content);

if (DRY) {
  const file = path.join(ROOT, "pipeline", "newsletter-preview.html");
  fs.writeFileSync(file, html.replaceAll("{{{contact.first_name|there}}}", "there").replaceAll("{{{RESEND_UNSUBSCRIBE_URL}}}", "#"));
  console.log(`Dry run — preview written to ${file}`);
  process.exit(0);
}

// ---------- 4. Resend: sync subscribers, create the draft, send the preview ----------
const RESEND = "https://api.resend.com";
const headers = { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" };
const api = async (method, url, body) => {
  await sleep(120); // stay under 10 requests / second
  const res = await fetch(`${RESEND}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
};

// Members who opted in on their profile → contacts in the segment; members who opted out → unsubscribed
const { data: memberRows } = await db.from("profiles").select("email,first_name,newsletter").not("email", "is", null);
const members = memberRows || [];
let added = 0, removed = 0;
for (const m of members) {
  if (m.newsletter) {
    const r = await api("POST", "/contacts", { email: m.email, first_name: m.first_name || undefined, segments: [{ id: env("RESEND_SEGMENT_ID") }] });
    if (r.ok) added++;
  } else {
    const { data: signup } = await db.from("newsletter_signups").select("id").eq("email", m.email).maybeSingle();
    if (!signup) { const r = await api("PATCH", `/contacts/${encodeURIComponent(m.email)}`, { unsubscribed: true }); if (r.ok) removed++; }
  }
}
console.log(`Contacts synced: ${added} added, ${removed} unsubscribed (members).`);

const name = `SCP weekly — ${dateLabel}`;
const draft = await api("POST", "/broadcasts", { segment_id: env("RESEND_SEGMENT_ID"), from: env("NEWSLETTER_FROM"), subject: out.subject, html, name });
if (!draft.ok) throw new Error(`Resend broadcast error ${draft.status}: ${JSON.stringify(draft.data)}`);
const broadcastId = draft.data.id;
console.log(`Draft broadcast created: ${broadcastId}`);

await db.from("newsletter_issues").insert({ week_start: weekStart, subject: out.subject, broadcast_id: broadcastId, items: content });

if (env("NEWSLETTER_REVIEW_TO")) {
  const banner = `<div style="background:#f0b84a;color:#121b33;padding:14px 18px;font-family:Arial,sans-serif;font-size:14px;text-align:center"><b>Preview — not sent yet.</b> To send it to all subscribers: Resend → Broadcasts → “${name}” → Send.</div>`;
  const preview = html.replace("<body style=\"margin:0;padding:0;background:#0e1529\">", `<body style="margin:0;padding:0;background:#0e1529">${banner}`)
    .replaceAll("{{{contact.first_name|there}}}", "there").replaceAll("{{{RESEND_UNSUBSCRIBE_URL}}}", "#");
  const r = await api("POST", "/emails", { from: env("NEWSLETTER_FROM"), to: env("NEWSLETTER_REVIEW_TO").split(",").map((s) => s.trim()), subject: `[Preview] ${out.subject}`, html: preview });
  console.log(r.ok ? `Preview sent to ${env("NEWSLETTER_REVIEW_TO")}.` : `Preview email failed: ${r.status} ${JSON.stringify(r.data)}`);
}
console.log("Done. Approve and send it from Resend → Broadcasts.");

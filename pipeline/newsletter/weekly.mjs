#!/usr/bin/env node
// Weekly SCP newsletter → Resend broadcast DRAFT (approved by a human in Resend before it goes out).
//
//   node newsletter/weekly.mjs            → builds this week's issue, creates the draft, emails a preview to NEWSLETTER_REVIEW_TO
//   node newsletter/weekly.mjs --dry-run  → builds it and writes newsletter-preview.html, nothing is sent or saved
//
// Content: Social News (last 7 days), newest Content Library posts (analysed ones first), latest blog article.
// Claude picks and writes the intro, the takes and the tip. Subscribers = website sign-ups + members who opted in
// on their profile (synced to the Resend segment before each issue).
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
  .eq("relevant", true).gte("published_at", since).order("published_at", { ascending: false }).limit(10);
const newsRows = newsData || [];

const postSelect = "id,url,title,published_at,analysis,content_idea_tags(idea_catalog(category,name))";
let { data: postRows } = await db.from("content_ideas").select(postSelect)
  .is("unavailable_at", null).gte("created_at", since).order("analyzed_at", { ascending: false, nullsFirst: false }).limit(12);
if ((postRows || []).length < 4) {
  ({ data: postRows } = await db.from("content_ideas").select(postSelect)
    .is("unavailable_at", null).order("analyzed_at", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false }).limit(12));
}
const tagsOf = (p) => { const t = {}; for (const { idea_catalog: v } of p.content_idea_tags || []) if (v) (t[v.category] ||= []).push(v.name); return t; };
const posts = (postRows || []).map((p) => ({ ...p, tags: tagsOf(p) }));

const blogDir = path.join(ROOT, "content/blog");
const blogPost = fs.existsSync(blogDir)
  ? fs.readdirSync(blogDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(blogDir, f), "utf8")))
      .filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date))[0]
  : null;

if (!newsRows.length && !posts.length) { console.log("No content this week — skipping."); process.exit(0); }
console.log(`Content: ${newsRows.length} news, ${posts.length} posts, blog: ${blogPost ? blogPost.slug : "none"}`);

// ---------- 2. Claude: pick and write ----------
const SYSTEM = `You write the weekly newsletter of Sports Content Playbook (SCP), a content-intelligence platform for the social media teams of sports clubs, leagues, athletes and sports brands.

You receive this week's material: platform/industry news, sports social posts from our Content Library (some with an expert analysis), and our latest blog article. Write in English, warm and expert, short sentences, no hype, no emojis.

Return:
- subject: max 60 characters, specific and curiosity-driven (not clickbait). No emojis.
- preheader: max 110 characters, complements the subject.
- intro: 2–3 sentences that set up this week's theme. Do not greet (the greeting is added for you).
- news: pick up to 4 of the most useful news items (by id). For each, "take": 1–2 sentences on what it means for a sports social team.
- posts: pick 4 posts (by id), varied in sport and format, preferring ones with an analysis. For each: "why": 1–2 sentences on what makes it work and how a club could adapt it; "hook": the opening hook if the analysis has one, else "".
- tip: one concrete, actionable idea a sports social team can try this week, based on the material.
Only use facts present in the material. Never invent numbers, results or quotes. Never identify people except by names given in the material.`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    subject: { type: "string" }, preheader: { type: "string" }, intro: { type: "string" }, tip: { type: "string" },
    news: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "integer" }, take: { type: "string" } }, required: ["id", "take"] } },
    posts: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "integer" }, why: { type: "string" }, hook: { type: "string" } }, required: ["id", "why", "hook"] } },
  },
  required: ["subject", "preheader", "intro", "news", "posts", "tip"],
};
const Result = z.object({
  subject: z.string().min(5), preheader: z.string(), intro: z.string().min(10), tip: z.string(),
  news: z.array(z.object({ id: z.number(), take: z.string() })),
  posts: z.array(z.object({ id: z.number(), why: z.string(), hook: z.string() })),
});

const material = {
  news: newsRows.map((n) => ({ id: n.id, platform: n.platform, title: n.title, summary: (n.paragraphs || []).join(" ").slice(0, 900) })),
  posts: posts.map((p) => ({
    id: p.id, account: p.tags.club?.[0] || p.tags.entity?.[0] || "", sport: p.tags.sport?.[0] || "", format: p.tags.format?.[0] || "",
    caption: (p.title || "").slice(0, 400),
    analysis: p.analysis ? { summary: p.analysis.summary, hook: p.analysis.hook?.text, whyItWorks: p.analysis.whyItWorks, howToAdapt: p.analysis.replicable?.howToAdapt } : null,
  })),
  blog: blogPost ? { title: blogPost.title, excerpt: blogPost.excerpt } : null,
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

// ---------- 3. Images: copy each picked post's image to our public bucket (Instagram links expire) ----------
async function stableImage(post) {
  try {
    const { image } = await igEmbed(post.url);
    if (!image) return null;
    const buf = Buffer.from(await (await fetch(image)).arrayBuffer());
    if (DRY) return image;
    const file = `${weekStart}/${post.id}.jpg`;
    const { error } = await db.storage.from("newsletter").upload(file, buf, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    return db.storage.from("newsletter").getPublicUrl(file).data.publicUrl;
  } catch { return null; }
}
const byId = new Map(posts.map((p) => [p.id, p]));
const pickedPosts = [];
for (const pick of out.posts.slice(0, 4)) {
  const p = byId.get(pick.id);
  if (!p) continue;
  pickedPosts.push({
    who: p.tags.club?.[0] || p.tags.entity?.[0] || "Post", format: p.tags.format?.[0] || "", sport: p.tags.sport?.[0] || "",
    hook: pick.hook, why: pick.why, image: await stableImage(p), link: `${SITE}/content-library.html#post=${p.id}`,
  });
}
const newsById = new Map(newsRows.map((n) => [n.id, n]));
const pickedNews = out.news.slice(0, 4).map((n) => ({ ...newsById.get(n.id), take: n.take })).filter((n) => n.title)
  .map((n) => ({ platform: n.platform, title: n.title, take: n.take, link: `${SITE}/news.html` }));
const blog = blogPost ? { title: blogPost.title, excerpt: blogPost.excerpt, link: `${SITE}/blog/${blogPost.slug}.html` } : null;

const html = renderWeekly({ subject: out.subject, preheader: out.preheader, intro: out.intro, news: pickedNews, posts: pickedPosts, tip: out.tip, blog, dateLabel });

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

await db.from("newsletter_issues").insert({ week_start: weekStart, subject: out.subject, broadcast_id: broadcastId, items: { news: pickedNews, posts: pickedPosts, tip: out.tip, blog } });

if (env("NEWSLETTER_REVIEW_TO")) {
  const banner = `<div style="background:#f0b84a;color:#121b33;padding:14px 18px;font-family:Arial,sans-serif;font-size:14px;text-align:center"><b>Preview — not sent yet.</b> To send it to all subscribers: Resend → Broadcasts → “${name}” → Send.</div>`;
  const preview = html.replace("<body style=\"margin:0;padding:0;background:#0e1529\">", `<body style="margin:0;padding:0;background:#0e1529">${banner}`)
    .replaceAll("{{{contact.first_name|there}}}", "there").replaceAll("{{{RESEND_UNSUBSCRIBE_URL}}}", "#");
  const r = await api("POST", "/emails", { from: env("NEWSLETTER_FROM"), to: env("NEWSLETTER_REVIEW_TO").split(",").map((s) => s.trim()), subject: `[Preview] ${out.subject}`, html: preview });
  console.log(r.ok ? `Preview sent to ${env("NEWSLETTER_REVIEW_TO")}.` : `Preview email failed: ${r.status} ${JSON.stringify(r.data)}`);
}
console.log("Done. Approve and send it from Resend → Broadcasts.");

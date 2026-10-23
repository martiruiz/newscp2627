#!/usr/bin/env node
// Blog posts edited in Admin → Blog live in Supabase (table blog_posts, supabase/admin-content.sql). The GitHub Action
// "Publish blog" uses this script around blog-tools/build.mjs:
//   node blog-tools/sync-db.mjs export         → content/blog/<slug>.json for every post (drafts keep "draft": true) and the
//                                               covers uploaded from the admin copied into assets/blog; prints how many.
//                                               Also content/news.json (published Social News, each with its fixed slug)
//                                               and content/seo.json (Admin → SEO settings) when supabase/seo.sql is run
//   node blog-tools/sync-db.mjs ok             → the posts changed since their last publish are marked published
//   node blog-tools/sync-db.mjs fail <logfile> → those posts get the build's error (shown in the admin)
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub secrets). No files are ever deleted: hiding a post = draft.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, ""), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL || !KEY) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed."); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (q, init = {}) => {
  const r = await fetch(`${URL}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${q.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};
const pending = (p) => !p.published_at || new Date(p.updated_at) > new Date(p.published_at);

const [mode, logFile] = process.argv.slice(2);
const missing = (e) => /PGRST205|PGRST204|42P01|42703|schema cache|: 404 /.test(e.message);
const slugify = (t) => { const s = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); return s.length > 70 ? s.slice(0, 70).replace(/-[^-]*$/, "") : s; };

async function sourceImage(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (!r.ok) { console.log(`  no picture (${r.status}) for ${url}`); return null; }
    const html = (await r.text()).slice(0, 400000);
    const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).find((t) => /(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i.test(t));
    const src = tag && (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    return src ? new globalThis.URL(src.replace(/&amp;/g, "&"), r.url).href : null;
  } catch (e) { console.log(`  no picture (${e.message}) for ${url}`); return null; }
}

// Social News (published) and the SEO settings → content/news.json and content/seo.json (skipped until seo.sql is run)
if (mode === "export") {
  try {
    const news = await rest("news?select=*&relevant=eq.true&order=published_at.desc.nullslast&limit=1000");
    // the preview picture of the source article (og:image) for the news that don't have one yet (supabase/news-images.sql)
    for (const n of news.filter((x) => "image_url" in x && !x.image_url).slice(0, 40)) {
      n.image_url = (await sourceImage(n.url)) || "";
      await rest(`news?id=eq.${n.id}`, { method: "PATCH", body: JSON.stringify({ image_url: n.image_url }), headers: { Prefer: "return=minimal" } });
    }
    for (const n of news.filter((x) => !x.slug)) {   // the page's URL is fixed the first time: editing the title later doesn't break links
      n.slug = `${slugify(n.title) || "news"}-${n.id}`;
      await rest(`news?id=eq.${n.id}`, { method: "PATCH", body: JSON.stringify({ slug: n.slug }), headers: { Prefer: "return=minimal" } });
    }
    fs.writeFileSync(path.join(ROOT, "content/news.json"), `${JSON.stringify(news, null, 2)}\n`);
    console.log(`${news.length} published news exported`);
    const [seo] = await rest("seo_settings?select=data&id=eq.1");
    fs.writeFileSync(path.join(ROOT, "content/seo.json"), `${JSON.stringify(seo?.data || {}, null, 2)}\n`);
  } catch (e) { if (!missing(e)) throw e; console.log("supabase/seo.sql isn't run yet: news pages and SEO settings skipped."); }
}

let posts;
try { posts = await rest("blog_posts?select=slug,data,draft,updated_at,published_at"); }
catch (e) {   // the table isn't there yet (supabase/admin-content.sql not run): nothing to do, the repo's files stay as they are
  if (/PGRST205|42P01|schema cache|: 404 /.test(e.message)) { console.log("blog_posts isn't set up yet: nothing to sync."); process.exit(0); }
  throw e;
}

if (mode === "export") {
  if (!posts.length) { console.log("No posts in blog_posts: nothing exported (run supabase/admin-content.sql)."); process.exit(0); }
  for (const p of posts) {
    const data = { ...p.data, slug: p.slug };
    delete data.draft;
    // a cover uploaded from the admin (Storage "blog"): copy it next to the others
    const img = data.image || {};
    if (img.url && img.file && !fs.existsSync(path.join(ROOT, "assets/blog", img.file))) {
      const r = await fetch(img.url);
      if (r.ok) fs.writeFileSync(path.join(ROOT, "assets/blog", img.file), Buffer.from(await r.arrayBuffer()));
      else console.warn(`cover not downloaded for ${p.slug}: ${r.status}`);
    }
    delete img.url;
    const out = p.draft ? { draft: true, ...data } : data;
    fs.writeFileSync(path.join(ROOT, "content/blog", `${p.slug}.json`), `${JSON.stringify(out, null, 2)}\n`);
  }
  console.log(`${posts.length} posts exported · ${posts.filter(pending).length} changed since their last publish`);
} else if (mode === "ok" || mode === "fail") {
  const error = mode === "fail" ? (fs.existsSync(logFile || "") ? fs.readFileSync(logFile, "utf8") : "The build failed.").slice(-2000) : null;
  for (const p of posts.filter(pending)) {
    const body = mode === "ok" ? { published_at: new Date().toISOString(), publish_error: null } : { publish_error: error };
    await rest(`blog_posts?slug=eq.${encodeURIComponent(p.slug)}`, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } });
  }
  console.log(`${posts.filter(pending).length} posts marked ${mode === "ok" ? "published" : "with the error"}`);
} else {
  console.error("Usage: node blog-tools/sync-db.mjs export | ok | fail <logfile>");
  process.exit(1);
}

#!/usr/bin/env node
// Blog posts edited in Admin → Blog live in Supabase (table blog_posts, supabase/admin-content.sql). The GitHub Action
// "Publish blog" uses this script around blog-tools/build.mjs:
//   node blog-tools/sync-db.mjs export         → content/blog/<slug>.json for every post (drafts keep "draft": true) and the
//                                               covers uploaded from the admin copied into assets/blog; prints how many
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
let posts;
try { posts = await rest("blog_posts?select=slug,data,draft,updated_at,published_at"); }
catch (e) {   // the table isn't there yet (supabase/admin-content.sql not run): nothing to do, the repo's files stay as they are
  if (/blog_posts|PGRST205|42P01|schema cache/.test(e.message)) { console.log("blog_posts isn't set up yet: nothing to sync."); process.exit(0); }
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

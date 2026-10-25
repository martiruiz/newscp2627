// Supabase Edge Function "translate-content": the Spanish version of a blog article or a Social News item, by AI.
// POST { kind: "blog", slug } | { kind: "news", id } → translates the fields readers see, saves them in the row's "es"
// column (supabase/translations.sql) with the source's last-change date, and returns them. Called by the publish job
// (blog-tools/sync-db.mjs, service role) for what's new or edited, or by an admin.
// Secrets: ANTHROPIC_API_KEY (same as ai-analyze); optional TRANSLATE_MODEL (default: the cheapest, claude-haiku-5-5).
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const SR = () => ({ apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" });
const rest = (q: string, init: RequestInit = {}) => fetch(`${env("SUPABASE_URL")}/rest/v1/${q}`, { ...init, headers: { ...SR(), ...(init.headers || {}) } });

const SYSTEM = `You translate content of Sports Content Playbook (SCP), a platform for the social media teams of sports clubs, leagues and brands, from English into Spanish (Spain).
Rules:
- Natural, professional Spanish for sports marketing people, tú form. Keep the meaning, tone and length; don't add or remove information.
- Keep HTML exactly: same tags, attributes, links (href / src unchanged) and structure; translate only the visible text. Never touch embed code, URLs or [placeholders].
- Keep names of clubs, players, leagues, brands, platforms and features as they are (Instagram, TikTok, Reels, Shorts, X…). Keep numbers and dates.
- Common English terms used by Spanish social media teams can stay (engagement, hook, reach, post), but translate everything else.
- Return every field you get, translated; empty fields stay empty.`;

const str = { type: "string" };
const SCHEMA = { type: "object", additionalProperties: false, properties: {
  title: str, excerpt: str, body_html: str, meta_title: str, meta_description: str, cta_title: str, cta_text: str, image_alt: str, image_title: str,
  paragraphs: { type: "array", items: str }, takeaways: { type: "array", items: str },
  faq: { type: "array", items: { type: "object", additionalProperties: false, properties: { q: str, a: str }, required: ["q", "a"] } },
}, required: ["title", "excerpt", "body_html", "meta_title", "meta_description", "cta_title", "cta_text", "image_alt", "image_title", "paragraphs", "takeaways", "faq"] };

const list = (v: unknown) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x) => String(x).trim()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // the publish job (service role) or an admin: only they can read blog_posts (admin-only table) with these credentials
  const auth = req.headers.get("Authorization") ?? "";
  const probe = await fetch(`${env("SUPABASE_URL")}/rest/v1/blog_posts?select=slug&limit=1`, { headers: { apikey: req.headers.get("apikey") || env("SUPABASE_ANON_KEY"), Authorization: auth } }).catch(() => null);
  if (!probe?.ok || !((await probe.json().catch(() => [])) as unknown[]).length) return json({ error: "Admins only" }, 403);
  const p = await req.json().catch(() => ({}));
  try {
    let src: Record<string, unknown>, changed: string, where: string;
    if (p.kind === "blog" && p.slug) {
      const [row] = await (await rest(`blog_posts?select=slug,data,updated_at&slug=eq.${encodeURIComponent(p.slug)}`)).json();
      if (!row) return json({ error: "Article not found" }, 404);
      const d = row.data || {};
      src = { title: d.title, excerpt: d.excerpt, body_html: d.body_html, meta_title: d.meta_title, meta_description: d.meta_description, cta_title: d.cta_title, cta_text: d.cta_text,
        image_alt: d.image?.alt, image_title: d.image?.title, takeaways: list(d.takeaways), faq: Array.isArray(d.faq) ? d.faq : [], paragraphs: [] };
      changed = row.updated_at; where = `blog_posts?slug=eq.${encodeURIComponent(p.slug)}`;
    } else if (p.kind === "news" && p.id) {
      const [row] = await (await rest(`news?select=id,title,paragraphs,takeaways,faq,meta_title,meta_description,edited_at,created_at&id=eq.${Number(p.id)}`)).json();
      if (!row) return json({ error: "News item not found" }, 404);
      src = { title: row.title, paragraphs: list(row.paragraphs), takeaways: list(row.takeaways), faq: Array.isArray(row.faq) ? row.faq : [], meta_title: row.meta_title, meta_description: row.meta_description,
        excerpt: "", body_html: "", cta_title: "", cta_text: "", image_alt: "", image_title: "" };
      changed = row.edited_at || row.created_at; where = `news?id=eq.${Number(p.id)}`;
    } else return json({ error: "Send { kind: 'blog', slug } or { kind: 'news', id }" }, 400);

    for (const k of Object.keys(src)) if (src[k] == null) src[k] = "";
    const model = env("TRANSLATE_MODEL") || "claude-haiku-5-5";
    const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
    const response = await claude.beta.messages.create({
      model, max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Translate into Spanish:\n${JSON.stringify(src)}` }],
    } as never);
    // deno-lint-ignore no-explicit-any
    const res = response as any;
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Model stopped: ${res.stop_reason}`);
    const es = { ...JSON.parse(res.content.find((b: { type: string }) => b.type === "text")?.text || "{}"), source_changed: changed, model: res.model || model,
      translated_at: new Date().toISOString(), tokens: { in: res.usage?.input_tokens ?? 0, out: res.usage?.output_tokens ?? 0 } };
    const saved = await rest(where, { method: "PATCH", body: JSON.stringify({ es }), headers: { Prefer: "return=minimal" } });
    if (!saved.ok) throw new Error(`Couldn't save the translation: ${saved.status} ${await saved.text()}`);
    return json(es);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

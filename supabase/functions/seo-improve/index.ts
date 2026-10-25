// Supabase Edge Function "seo-improve": Admin → Blog → a post → "Improve with AI" (next to the SEO score).
// Gets the post as it is in the editor plus the checks that fail, and returns only what's needed to pass them: main
// keyword, meta title / description, the first paragraph and one subtitle with the keyword, a short paragraph with the
// missing keywords, key takeaways, FAQ and the cover's alt text. Nothing is saved here: the editor fills the fields and the
// admin reviews them and presses Save. Only admins can call it.
//
// Secrets: ANTHROPIC_API_KEY (the same as ai-analyze); optional AI_SEO_MODEL (default claude-opus-5-5).
import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `You are the SEO editor of Sports Content Playbook (SCP), a platform for the social media teams of sports clubs, leagues and brands.
You improve one blog article so it ranks on Google and gets quoted by AI assistants (ChatGPT, Perplexity, Gemini, Claude).
Rules:
- Write in the article's language, in the same tone. Natural sentences: never keyword stuffing.
- Use only facts that are in the article. Never invent numbers, results, quotes, names or links.
- Only fill the fields listed under "Fix"; return an empty string or empty list for every other field.
- primary_keyword: one of the site keywords, the one this article fits best.
- title: the current title rewritten minimally so it contains the main keyword.
- meta_title: 45–60 characters, contains the main keyword, compelling. meta_description: 130–155 characters, contains the main keyword, says what the reader gets.
- first_paragraph_html: the current first paragraph, rewritten minimally so it contains the main keyword, as one <p>…</p>.
- subtitle_old: the exact text of one existing H2/H3 (copy it character for character); subtitle_new: that subtitle rewritten to contain the main keyword (plain text).
- extra_paragraph_html: one or two short <p> paragraphs that fit the article and use each missing keyword once, naturally.
- takeaways: 3–5 short, self-contained sentences with the article's key points.
- faq: 3–4 questions people would type into Google or ask an AI about this topic, each answered in 2–3 direct sentences based on the article.
- image_alt: describes the cover for someone who can't see it, based on the title and cover title, with the main keyword if natural (max 125 characters).`;
const str = { type: "string" };
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    primary_keyword: str, title: str, meta_title: str, meta_description: str, first_paragraph_html: str, subtitle_old: str, subtitle_new: str, extra_paragraph_html: str,
    takeaways: { type: "array", items: str },
    faq: { type: "array", items: { type: "object", additionalProperties: false, properties: { q: str, a: str }, required: ["q", "a"] } },
    image_alt: str,
  },
  required: ["primary_keyword", "title", "meta_title", "meta_description", "first_paragraph_html", "subtitle_old", "subtitle_new", "extra_paragraph_html", "takeaways", "faq", "image_alt"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // admins only (public.is_admin() with the caller's session)
  const auth = req.headers.get("Authorization") ?? "";
  const adm = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "Admins only" }, 403);

  const p = await req.json().catch(() => null);
  if (!p?.fix?.length) return json({ error: "Nothing to fix" }, 400);
  try {
    const claude = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
    const response = await claude.beta.messages.create({
      model: env("AI_SEO_MODEL") || "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Fix: ${p.fix.join(", ")}
Site keywords: ${(p.site_keywords || []).join(" · ")}
Main keyword: ${p.primary_keyword || "(none yet)"}
Missing keywords: ${(p.missing_keywords || []).join(" · ") || "(none)"}
Title: ${p.title || ""}
Cover title: ${p.image_title || ""}
Meta title: ${p.meta_title || ""}
Meta description: ${p.meta_description || ""}
Article (HTML):
${String(p.body_html || "").slice(0, 40000)}` }],
    } as never);
    // deno-lint-ignore no-explicit-any
    const res = response as any;
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Model stopped: ${res.stop_reason}`);
    return json(JSON.parse(res.content.find((b: { type: string }) => b.type === "text")?.text || "{}"));
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

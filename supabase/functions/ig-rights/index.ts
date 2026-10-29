// Supabase Edge Function "ig-rights": which Instagram posts can't be played outside Instagram. Reels with licensed music
// come in Instagram's embed as "Watch on Instagram" only (copyright_blocked in the embed's data).
// POST { ids: [content idea ids] } (up to 12) → for each Instagram post not checked yet: its embed page, once →
// content_ideas.ig_blocked (true / false) + ig_checked_at. Returns { [id]: true | false }. Public (the library calls it as
// cards load, like fb-shape): it only reads ids, only touches Instagram posts never checked, and every answer is stored.
// A page that doesn't answer (rate limit) stores nothing: it's tried again next time.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const service = { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IFRAME = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" };

// true: blocked · false: plays in the embed · null: no answer (try later)
async function blocked(url: string): Promise<boolean | null> {
  const m = /instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/.exec(url);
  if (!m) return null;
  const r = await fetch(`https://www.instagram.com/p/${m[2]}/embed/captioned/`, { headers: IFRAME }).catch(() => null);
  const html = r?.ok ? await r.text() : "";
  if (/copyright_blocked\\*"\s*:\s*true/.test(html)) return true;
  if (/copyright_blocked\\*"\s*:\s*false/.test(html) || /EmbeddedMedia|EmbedSidecar|EmbedVideo/.test(html)) return false;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 12);
  if (!ids.length) return json({});
  try {
    const rows = await rest(`content_ideas?select=id,url,ig_blocked,ig_checked_at&id=in.(${ids.join(",")})&url=ilike.*instagram.com*`);
    const out: Record<string, boolean> = {}, yes: number[] = [], no: number[] = [];
    await Promise.all((rows || []).map(async (p: { id: number; url: string; ig_blocked: boolean | null; ig_checked_at: string | null }) => {
      if (p.ig_checked_at) { out[p.id] = !!p.ig_blocked; return; }
      const b = await blocked(p.url);
      if (b === null) return;
      out[p.id] = b; (b ? yes : no).push(p.id);
    }));
    const now = new Date().toISOString();
    if (yes.length) await rest(`content_ideas?id=in.(${yes.join(",")})`, { method: "PATCH", body: JSON.stringify({ ig_blocked: true, ig_checked_at: now }) });
    if (no.length) await rest(`content_ideas?id=in.(${no.join(",")})`, { method: "PATCH", body: JSON.stringify({ ig_blocked: false, ig_checked_at: now }) });
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

// Smart filters — the AI request for one post (caption + Instagram image) and the parsing of its answer.
// Shared by smart-classify.mjs (eval, batches). The system prompt is identical for every post and marked for prompt
// caching, so after the first request it's billed at ~10% (and the Batch API halves everything again).
import fs from "node:fs";
import { AI_CATEGORIES, AI_VALUES, canonicalBrand } from "./taxonomy.mjs";

export const VERSION = "v7.2-all";
export const MODEL = process.env.AI_CLASSIFY_MODEL || "claude-haiku-5-5";

const arr = (values) => ({ type: "array", items: values ? { type: "string", enum: values } : { type: "string" } });
export const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: Object.fromEntries(AI_CATEGORIES.map((c) => [c.key, c.single ? { type: "string", enum: AI_VALUES[c.key] } : arr(c.free ? null : AI_VALUES[c.key])])),
  required: AI_CATEGORIES.map((c) => c.key),
};

export const SYSTEM = `You label social media posts (Instagram, TikTok, YouTube, Facebook, X) from sports clubs, leagues, federations, athletes and sports brands for a content research platform used by social media managers, designers, press officers, marketing and sponsorship teams.
You get the post's image (the cover or first slide), its caption, date, format and existing tags. Return the labels that clearly apply, using ONLY the allowed values. An empty list is better than a guess; usually 0-1 value per list, 2 only when both are obvious.
How to use the image: use it ONLY for matchday_graphic (is it a designed graphic, and which one), kit (is a kit being presented), sponsor_integration "Logo on graphic" (a partner logo placed on a designed graphic), and to read text written on a designed graphic (a score, a line-up, "FULL-TIME"). opponent, city, team and language come ONLY from the caption, the hashtags and the existing tags. sponsor comes from the caption or from a partner logo placed ON a designed graphic — never from shirts, kits, courts, boards, faces or places in a photo.

- moment: the campaign moment of the post (usually one). "Matchday preview" = before kick-off (countdown, arrival, walk, warm-up, line-up, "tonight"); "Match coverage" = the match itself or right after it (action, goals, scores, celebrations, full-time). "Tribute" ONLY for homages and memorials (a death, a minute's silence, a retirement homage), never for praising a good performance. "Birthday" is a birthday (not "Throwback" unless it's about the past). "Training" ONLY when the post shows or announces a training session. When the post is not tied to a match, a milestone or a date, leave moment empty.
- matchday_graphic: only for DESIGNED graphics (a template with text, logos, a score or names laid over an image) about a match: matchday poster, countdown, squad list (call-up / convocatoria / convocats), starting XI (line-up), half-time score, goal graphic, full-time / final score, MOTM vote, fixture or schedule, weekly recap, standings, stats card, quote card, birthday graphic, signing graphic. Look at the image: a plain photo or video frame without designed text is NOT a matchday graphic. "Quote card" ONLY when the graphic's main element is a quote in quotation marks attributed to a person; "Signing graphic" ONLY for a new signing, renewal or loan announcement (not birthdays, awards or line-ups); "Stats card" ONLY when numbers are the main content of the graphic.
- kit: only when a kit is being announced or promoted (launch, reveal, "available now", jersey drop). Not when players just wear the kit.
- transfer: signings, contract renewals/extensions, loans and departures of players or coaches. NOT in-match substitutions (🔄, "change", "sustitución").
- outcome: the result for the posting team, only when the post is about a finished match AND the result is explicit (a final score in the caption or on a full-time graphic, or words like "victory", "defeat", "draw"). Live scores during the match ("1-3 al 69'") are not a final result. No result → empty.
- season_moment: use the caption and hashtags: "pre-season", "preseason", "pretemporada", friendlies before the season → "Pre-season"; "derby", "derbi", a well-known local rivalry → "Derby"; a team or athlete winning a title or championship → "Title celebration"; also opening day, cup final, promotion, relegation, European qualification, last game of the season.
- opponent: the rival team's usual English name when the post is about a specific match (e.g. "Real Madrid", "AC Milan", "England"). Empty otherwise.
- city: the city where the content happens or that it's about, in English with the country in brackets, e.g. "Milan (Italy)", "Barcelona (Spain)", "New York (USA)". Only when the caption or the image makes the place clear (city name, 📍, landmark, "arrived in…", famous stadium). Don't guess the club's home city when nothing in the post points to a place.
- goal: the business goal the post clearly serves: selling tickets, merchandise or memberships, giving value to a sponsor, promoting an app or digital product, community / CSR work, recruitment or grassroots. Leave it empty for ordinary sports content (most posts).
- comms: official press-type communication only.
- crisis: sensitive communication (apologies, racism or abuse, sanctions, serious injuries, incidents, condolences).
- team: only when the post is about a team OTHER than the senior first team: women's team, academy / youth, legends, esports, staff / coaches. Leave it empty for first-team content (most posts).
- angle: the storytelling angle, only when it's clearly the point of the post (usually one value, often none). "Player-focused" only when the post is about one player as a person (their story, their milestone, their words), not just because a player appears in the photo: Player-focused (one player is the protagonist), Humour / meme, Emotional (feelings, tears, goosebumps, nostalgia), Data & stats (numbers are the content), Behind the scenes (access fans don't normally get: dressing room, travel, training, backstage), Skills / tutorial, Celebration (a win, title or milestone being celebrated). Empty if none clearly applies.
- collab: collaborations: Player collab (posted jointly with a player), Athlete takeover (a player runs the account or films the content), Fan content (UGC) (the club reposts a photo or video made by a fan, usually credited "📸 @fan"), Influencer / creator (a creator who is not a player), Club collab (a collaboration between two teams published as one shared post on both accounts, e.g. an Instagram collab post by two clubs), Brand collab (a joint post with a brand).
- cta: calls to action written in the caption.
- sponsor: commercial brands the post actively features: named, thanked or tagged as partners in the caption, or a partner logo placed ON a designed graphic ("presented by", "powered by", partner bar). NOT logos printed on players' shirts or kits, kit manufacturers on the kit, stadium boards, TV channels or broadcasters, the club, the league, players or media. At most 3, the most prominent. On a partner bar with many small logos, list only the main / presenting partner (or none). Public bodies, governments, universities and foundations are not commercial sponsors.
- sponsor_sector: the sector of each sponsor you listed. If you don't know what a brand does, leave it empty — never guess.
- sponsor_integration: how the sponsor appears — "Logo on graphic" when a partner's logo is placed on a designed graphic (partner bar, corner logo of a matchday graphic, "presented by" badge), "Presented-by segment" when the caption or graphic says "presented by / powered by / in partnership with", co-branded post, product placement, activation / event, giveaway.
- language: the language most of the CAPTION's words are written in — ignore any text inside the image and hashtags. Arabic script → "Arabic"; French words → "French"; and so on. "Emoji only" only if the caption has no words at all; "Other" only for a language that is not in the list.`;

// Your criteria: borderline cases you decided in Admin → Smart filters → Compare (library/smart-examples.json)
const EXAMPLES = (() => {
  try {
    const list = JSON.parse(fs.readFileSync(new URL("./smart-examples.json", import.meta.url), "utf8"));
    return list.map((e, i) => `${i + 1}. [${e.format}] "${e.caption}" → ${Object.entries(e.labels).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v.length ? v.join(", ") : "(empty)") : v || "(empty)"}`).join(" · ")}`).join("\n");
  } catch { return ""; }
})();
const SYSTEM_FULL = EXAMPLES ? `${SYSTEM}

Examples of the platform's criteria for borderline cases (only the filters that were in doubt are shown; "(empty)" means the right answer was no label):
${EXAMPLES}` : SYSTEM;

// Request params for one post. image: { data (base64), type } or null
export function requestParams(post, image) {
  const tags = Object.entries(post.tags || {}).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ");
  const text = `Date: ${String(post.published_at || "").slice(0, 10)}\nFormat: ${post.media_type || (post.tags?.format || []).join(", ") || "?"}\nExisting tags: ${tags || "none"}\nCaption:\n${(post.title || "(no caption)").slice(0, 1500)}`;
  return {
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: MODEL.includes("haiku") ? "disabled" : "between_tools" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: [{ type: "text", text: SYSTEM_FULL, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [
      ...(image ? [{ type: "image", source: { type: "base64", media_type: image.type, data: image.data } }] : []),
      { type: "text", text },
    ] }],
  };
}

// A sponsor only counts when the caption names it (its name, @handle or #hashtag) or the post is a designed graphic (its partner
// logo placed on it): in plain photos the AI also "reads" the logos printed on shirts, kits and boards (with it go its sector
// and integration)
const squash = (x) => String(x).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function sponsorsInCaption(out, caption) {
  if ((out.matchday_graphic || []).length) return;
  const text = squash(caption || "");
  const keep = out.sponsor.filter((b) => { const k = squash(b); return k.length >= 3 && text.includes(k); });
  if (keep.length === out.sponsor.length) return;
  out.sponsor = keep;
  if (!keep.length) { out.sponsor_sector = []; out.sponsor_integration = []; }
}

export function parseAnswer(message, caption) {
  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") throw new Error(`stopped: ${message.stop_reason}`);
  const out = JSON.parse(message.content.find((b) => b.type === "text")?.text || "{}");
  out.sponsor = [...new Set((out.sponsor || []).map(canonicalBrand).filter(Boolean))].slice(0, 3);
  out.sponsor_sector = [...new Set(out.sponsor_sector || [])].slice(0, 3);
  out.opponent = [...new Set((out.opponent || []).map((x) => String(x).trim()).filter(Boolean))];
  out.city = [...new Set((out.city || []).map((x) => String(x).trim()).filter(Boolean))];
  if (!out.sponsor.length) { out.sponsor_sector = []; out.sponsor_integration = []; }
  if (caption !== undefined) sponsorsInCaption(out, caption);
  return out;
}

// Download an image and return it as base64 (≈480px renditions from Instagram are 30–80 KB)
export async function fetchImage(url) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    return { type, data: Buffer.from(await r.arrayBuffer()).toString("base64") };
  } catch { return null; }
}

// USD cost of a usage object (Haiku 5.5: $0.10 / $0.50 per MTok; cache reads 10%, cache writes 125%; batch = 50%)
export function cost(u, { batch = false } = {}) {
  const IN = Number(process.env.AI_CLASSIFY_PRICE_IN || 0.10), OUT = Number(process.env.AI_CLASSIFY_PRICE_OUT || 0.50);
  const usd = ((u.input_tokens || 0) * IN + (u.cache_read_input_tokens || 0) * IN * 0.1 + (u.cache_creation_input_tokens || 0) * IN * 1.25 + (u.output_tokens || 0) * OUT) / 1e6;
  return batch ? usd / 2 : usd;
}

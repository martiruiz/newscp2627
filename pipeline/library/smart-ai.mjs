// Smart filters — the AI request for one post (caption + Instagram image) and the parsing of its answer.
// Shared by smart-classify.mjs (eval, batches). The system prompt is identical for every post and marked for prompt
// caching, so after the first request it's billed at ~10% (and the Batch API halves everything again).
import { AI_CATEGORIES, AI_VALUES, canonicalBrand } from "./taxonomy.mjs";

export const VERSION = "v2-img";
export const MODEL = process.env.AI_CLASSIFY_MODEL || "claude-haiku-5-5";

const arr = (values) => ({ type: "array", items: values ? { type: "string", enum: values } : { type: "string" } });
export const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: Object.fromEntries(AI_CATEGORIES.map((c) => [c.key, c.single ? { type: "string", enum: AI_VALUES[c.key] } : arr(c.free ? null : AI_VALUES[c.key])])),
  required: AI_CATEGORIES.map((c) => c.key),
};

export const SYSTEM = `You label Instagram posts from sports clubs, leagues, federations, athletes and sports brands for a content research platform used by social media managers, designers, press officers, marketing and sponsorship teams.
You get the post's image (the cover or first slide), its caption, date, format and existing tags. Return the labels that clearly apply, using ONLY the allowed values. An empty list is better than a guess; usually 0-2 values per list.

- moment: the campaign moment(s) of the post.
- matchday_graphic: only for DESIGNED graphics (a template with text, logos, a score or names laid over an image) about a match: matchday poster, countdown, squad list (call-up / convocatoria / convocats), starting XI (line-up), half-time score, goal graphic, full-time / final score, MOTM vote, fixture or schedule, weekly recap, standings, stats card, quote card, birthday graphic, signing graphic. Look at the image: a plain photo or video frame without designed text is NOT a matchday graphic.
- kit: only when a kit is being announced or promoted (launch, reveal, "available now", jersey drop). Not when players just wear the kit.
- transfer: signings, contract renewals/extensions, loans and departures of players or coaches. NOT in-match substitutions (🔄, "change", "sustitución").
- outcome: the result for the posting team when the post is about a finished match (win / draw / loss).
- season_moment: opening day, derby (big local or historic rivalry), cup final, title celebration, promotion, relegation, European qualification, last game, pre-season.
- opponent: the rival team's usual English name when the post is about a specific match (e.g. "Real Madrid", "AC Milan", "England"). Empty otherwise.
- city: the city where the content happens or that it's about, in English with the country in brackets, e.g. "Milan (Italy)", "Barcelona (Spain)", "New York (USA)". Only when the caption or the image makes the place clear (city name, 📍, landmark, "arrived in…", famous stadium). Don't guess the club's home city when nothing in the post points to a place.
- goal: the business goal the post clearly serves (tickets, merchandise, memberships, sponsor value, app, community, recruitment). "Engagement" only for posts built to get interactions (polls, questions, contests); "Fan growth" only for explicit follow / subscribe asks. Leave it empty for ordinary match content.
- comms: official press-type communication only.
- crisis: sensitive communication (apologies, racism or abuse, sanctions, serious injuries, incidents, condolences).
- team: which team or audience the post is about.
- angle: the storytelling angle(s).
- collab: collaborations (with players, other clubs, creators or brands; athlete takeovers; reposted fan content). Club collab = a joint post with another club or league.
- cta: calls to action written in the caption.
- sponsor: commercial brands promoted, thanked, tagged or clearly visible as partners (official brand name, e.g. "Spotify", "Emirates"). Not the club, the league, broadcasters' sports accounts, players or media.
- sponsor_sector: the sector of each sponsor you listed. If you don't know what a brand does, use "Other" — never guess.
- sponsor_integration: how the sponsor appears — "Logo on graphic" when a brand logo is visible in the image, "Presented-by segment", co-branded post, product placement, activation / event, giveaway.
- language: the main language of the caption ("Emoji only" if there are no words).`;

// Request params for one post. image: { data (base64), type } or null
export function requestParams(post, image) {
  const tags = Object.entries(post.tags || {}).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ");
  const text = `Date: ${String(post.published_at || "").slice(0, 10)}\nFormat: ${post.media_type || (post.tags?.format || []).join(", ") || "?"}\nExisting tags: ${tags || "none"}\nCaption:\n${(post.title || "(no caption)").slice(0, 1500)}`;
  return {
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [
      ...(image ? [{ type: "image", source: { type: "base64", media_type: image.type, data: image.data } }] : []),
      { type: "text", text },
    ] }],
  };
}

export function parseAnswer(message) {
  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") throw new Error(`stopped: ${message.stop_reason}`);
  const out = JSON.parse(message.content.find((b) => b.type === "text")?.text || "{}");
  out.sponsor = [...new Set((out.sponsor || []).map(canonicalBrand).filter(Boolean))];
  out.opponent = [...new Set((out.opponent || []).map((x) => String(x).trim()).filter(Boolean))];
  out.city = [...new Set((out.city || []).map((x) => String(x).trim()).filter(Boolean))];
  if (!out.sponsor.length) { out.sponsor_sector = []; out.sponsor_integration = []; }
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

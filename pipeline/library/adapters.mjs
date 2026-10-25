// Turn one raw item from any source into an SCP post row (or null if it has no usable URL).
// Unknown numbers stay null — never 0, never guessed.

// Numbers like 1234, "1,234", "1.2M", "379K", "379 mil", "1,2 M"
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  const m = s.match(/^([\d.,]+)\s*(k|m|b|mil|mill(?:ones)?)?$/);
  if (!m) return null;
  let digits = m[1];
  const mult = { k: 1e3, mil: 1e3, m: 1e6, mill: 1e6, millones: 1e6, b: 1e9 }[m[2]] ?? 1;
  if (mult > 1) digits = digits.replace(",", "."); // "1,2 M" → 1.2
  else digits = digits.replace(/[.,](?=\d{3}(\D|$))/g, ""); // thousands separators
  const n = Number(digits) * mult;
  return Number.isFinite(n) ? Math.round(n) : null;
};
const iso = (v) => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{8}$/.test(s)) return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00Z`).toISOString(); // 20261008
  if (/^\d{10,13}$/.test(s)) return new Date(Number(s) * (s.length === 10 ? 1000 : 1)).toISOString(); // unix
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** Platform, id and canonical URL from a post link. */
export function idFromUrl(url) {
  const u = String(url || "").trim();
  let m;
  if ((m = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i))) {
    const kind = /\/(reel|reels)\//i.test(u) ? "reel" : "p";
    return { platform: "instagram", id: `ig-${m[1].toLowerCase()}`, url: `https://www.instagram.com/${kind}/${m[1]}/`, guessFormat: kind === "reel" ? "reel" : null };
  }
  if ((m = u.match(/tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d+)/i)))
    return { platform: "tiktok", id: `tt-${m[2]}`, url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`, handle: m[1].toLowerCase(), guessFormat: "video" };
  if ((m = u.match(/youtube\.com\/shorts\/([\w-]{11})/i)))
    return { platform: "youtube", id: `yt-${m[1].toLowerCase()}`, url: `https://www.youtube.com/shorts/${m[1]}`, guessFormat: "short" };
  if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i)))
    return { platform: "youtube", id: `yt-${m[1].toLowerCase()}`, url: `https://www.youtube.com/watch?v=${m[1]}`, guessFormat: "video" };
  if ((m = u.match(/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/i)))
    return { platform: "x", id: `x-${m[2]}`, url: `https://x.com/${m[1]}/status/${m[2]}`, handle: m[1].toLowerCase(), guessFormat: "text" };
  return null;
}

const FORMATS = { reel: "reel", reels: "reel", clips: "reel", video: "video", graphvideo: "video", sidecar: "carousel", carousel: "carousel", carousel_album: "carousel", graphsidecar: "carousel", image: "image", photo: "image", graphimage: "image", short: "short", shorts: "short" };
const fmt = (v) => (v ? FORMATS[String(v).toLowerCase().replace(/[^a-z_]/g, "")] ?? null : null);

export function toPost(item, source = null) {
  // 1) SCP normalized format (or the instagram-research-tool "your own JSON" shape)
  const link = item.url ?? item.permalink ?? item.post_url ?? item.platform_url;
  const ref = idFromUrl(link);
  if (!ref) return null;

  const handle = String(
    item.account_handle ?? item.creator ?? item.handle ?? item.username ?? item.ownerUsername ?? item.user_posted ?? item.account ?? ref.handle ?? ""
  ).replace(/^@/, "").toLowerCase();
  if (!handle) return null;

  return {
    id: ref.id,
    platform: ref.platform,
    url: ref.url,
    account_handle: handle,
    posted_at: iso(item.posted_at ?? item.postedAt ?? item.timestamp ?? item.date_posted ?? item.published_at ?? item.taken_at ?? item.date),
    format: fmt(item.format ?? item.type ?? item.media_type ?? item.product_type ?? item.content_type) ?? ref.guessFormat,
    caption: item.caption ?? item.description ?? item.text ?? item.content ?? null,
    thumbnail_url: item.thumbnail_url ?? item.cover ?? item.thumbnail ?? item.displayUrl ?? item.image_url ?? item.imageUrl ?? null,
    duration_sec: num(item.duration_sec ?? item.durationSec ?? item.video_duration ?? item.length),
    views: num(item.views ?? item.video_view_count ?? item.videoPlayCount ?? item.play_count ?? item.view_count),
    likes: num(item.likes ?? item.likesCount ?? item.like_count ?? item.num_likes),
    comments: num(item.comments ?? item.commentsCount ?? item.comment_count ?? item.num_comments),
    shares: num(item.shares ?? item.sharesCount ?? item.share_count),
    saves: num(item.saves ?? item.save_count),
    source: source ?? item.source ?? null,
    fetched_at: new Date().toISOString(),
  };
}

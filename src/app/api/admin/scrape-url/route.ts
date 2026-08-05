import { NextRequest, NextResponse } from "next/server";

interface Detected {
  platform: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  format: string | null;
}

// Known short-URL hostnames that need a redirect-follow to get the real URL
const SHORT_URL_HOSTS = new Set([
  "t.co", "bit.ly", "ow.ly", "tinyurl.com",
  "lnkd.in",          // LinkedIn
  "vm.tiktok.com",    // TikTok
  "fb.watch",         // Facebook
  "instagr.am",       // Instagram
  "youtu.be",         // YouTube (already handled but kept for safety)
]);

async function resolveRedirect(raw: string): Promise<string> {
  try {
    const res = await fetch(raw, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return res.url || raw;
  } catch {
    // Try GET if HEAD fails
    try {
      const res = await fetch(raw, {
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      return res.url || raw;
    } catch {
      return raw;
    }
  }
}

function detectPlatform(raw: string): Detected | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "").replace(/^mobile\./, "");
  const path = url.pathname;

  // ── Twitter / X ─────────────────────────────────────────────────────────────
  if (host === "twitter.com" || host === "x.com") {
    // Handle /i/web/status/ID (no username in URL)
    const webM = path.match(/\/i\/web\/status\/(\d+)/);
    if (webM) {
      const tweetId = webM[1];
      return {
        platform: "X",
        externalPostId: tweetId,
        canonicalUrl: `https://x.com/i/web/status/${tweetId}`,
        embedUrl: `https://x.com/i/web/status/${tweetId}`,
        format: null,
      };
    }

    // Handle /username/status/ID
    const statusM = path.match(/\/([^/]+)\/status\/(\d+)/);
    if (statusM) {
      const [, username, tweetId] = statusM;
      return {
        platform: "X",
        externalPostId: tweetId,
        canonicalUrl: `https://x.com/${username}/status/${tweetId}`,
        embedUrl: `https://x.com/${username}/status/${tweetId}`,
        format: null,
      };
    }
  }

  // ── Instagram ────────────────────────────────────────────────────────────────
  if (host === "instagram.com" || host === "instagr.am") {
    // Posts, reels, IGTV
    const postM = path.match(/\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/);
    if (postM) {
      const [, rawType, shortcode] = postM;
      const type = rawType === "reels" ? "reel" : rawType;
      const fmt = type === "reel" ? "Reel" : type === "tv" ? "Video" : "Image";
      return {
        platform: "Instagram",
        externalPostId: shortcode,
        canonicalUrl: `https://www.instagram.com/${type}/${shortcode}/`,
        embedUrl: `https://www.instagram.com/${type}/${shortcode}/embed`,
        format: fmt,
      };
    }
    // Stories: /stories/username/ID/
    const storyM = path.match(/\/stories\/([^/]+)\/(\d+)/);
    if (storyM) {
      const [, username, storyId] = storyM;
      return {
        platform: "Instagram",
        externalPostId: storyId,
        canonicalUrl: `https://www.instagram.com/stories/${username}/${storyId}/`,
        embedUrl: `https://www.instagram.com/stories/${username}/${storyId}/`,
        format: "Image",
      };
    }
  }

  // ── YouTube ──────────────────────────────────────────────────────────────────
  if (host === "youtube.com" || host === "youtu.be") {
    let videoId: string | null = null;
    if (host === "youtu.be") {
      videoId = path.slice(1).split("?")[0] || null;
    } else {
      // Shorts: /shorts/VIDEO_ID
      const shortsM = path.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      // Live: /live/VIDEO_ID
      const liveM = path.match(/\/live\/([A-Za-z0-9_-]+)/);
      // Embed: /embed/VIDEO_ID
      const embedM = path.match(/\/embed\/([A-Za-z0-9_-]+)/);
      videoId = shortsM?.[1] ?? liveM?.[1] ?? embedM?.[1] ?? url.searchParams.get("v") ?? null;
    }
    if (videoId) {
      return {
        platform: "YouTube",
        externalPostId: videoId,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        format: "Video",
      };
    }
  }

  // ── TikTok ───────────────────────────────────────────────────────────────────
  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    // /video/ID or /@username/video/ID
    const m = path.match(/\/video\/(\d+)/) ?? path.match(/@[^/]+\/video\/(\d+)/);
    if (m) {
      const videoId = m[1];
      // Build canonical with username if present
      const userM = path.match(/@([^/]+)\/video\/\d+/);
      const username = userM?.[1] ?? null;
      const canonical = username
        ? `https://www.tiktok.com/@${username}/video/${videoId}`
        : raw;
      return {
        platform: "TikTok",
        externalPostId: videoId,
        canonicalUrl: canonical,
        embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
        format: "Video",
      };
    }
  }

  // ── LinkedIn ─────────────────────────────────────────────────────────────────
  if (host === "linkedin.com" || host === "lnkd.in") {
    // /feed/update/urn:...
    const urnMatch = path.match(/\/feed\/update\/(urn:[^/?#]+)/);
    if (urnMatch) {
      const urn = urnMatch[1];
      const embedUrl = `https://www.linkedin.com/embed/feed/update/${urn}`;
      return {
        platform: "LinkedIn",
        externalPostId: urn,
        canonicalUrl: `https://www.linkedin.com/feed/update/${urn}/`,
        embedUrl,
        format: null,
      };
    }
    // /posts/slug or /posts/slug-activityId
    const postsMatch = path.match(/\/posts\/([^/?#]+)/);
    if (postsMatch) {
      const slug = postsMatch[1];
      // Extract activity ID from the end of the slug if present
      const actM = slug.match(/-(\d+)$/);
      const id = actM ? `urn:li:activity:${actM[1]}` : slug;
      const embedUrl = actM
        ? `https://www.linkedin.com/embed/feed/update/urn:li:activity:${actM[1]}`
        : raw;
      return {
        platform: "LinkedIn",
        externalPostId: id,
        canonicalUrl: raw,
        embedUrl,
        format: null,
      };
    }
    // /pulse/article-title (article)
    const pulseMatch = path.match(/\/pulse\/([^/?#]+)/);
    if (pulseMatch) {
      return {
        platform: "LinkedIn",
        externalPostId: pulseMatch[1],
        canonicalUrl: raw,
        embedUrl: raw,
        format: null,
      };
    }
    // /company/name or /in/username — generic fallback
    return {
      platform: "LinkedIn",
      externalPostId: path.split("/").filter(Boolean).pop() ?? "",
      canonicalUrl: raw,
      embedUrl: raw,
      format: null,
    };
  }

  // ── Facebook ─────────────────────────────────────────────────────────────────
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") {
    // /watch?v=VIDEO_ID
    const watchV = url.searchParams.get("v");
    if (watchV) {
      const canonical = `https://www.facebook.com/watch?v=${watchV}`;
      return {
        platform: "Facebook",
        externalPostId: watchV,
        canonicalUrl: canonical,
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=true&width=500`,
        format: "Video",
      };
    }
    // /reel/ID
    const reelM = path.match(/\/reel\/(\d+)/);
    if (reelM) {
      const reelId = reelM[1];
      const canonical = `https://www.facebook.com/reel/${reelId}`;
      return {
        platform: "Facebook",
        externalPostId: reelId,
        canonicalUrl: canonical,
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=true&width=500`,
        format: "Reel",
      };
    }
    // /photo?fbid=ID or /photo.php?fbid=ID
    const fbid = url.searchParams.get("fbid");
    if (fbid) {
      return {
        platform: "Facebook",
        externalPostId: fbid,
        canonicalUrl: raw,
        embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(raw)}&show_text=true&width=500`,
        format: "Image",
      };
    }
    // /permalink.php?story_fbid=ID
    const storyId = url.searchParams.get("story_fbid");
    if (storyId) {
      return {
        platform: "Facebook",
        externalPostId: storyId,
        canonicalUrl: raw,
        embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(raw)}&show_text=true&width=500`,
        format: null,
      };
    }
    // Generic Facebook post
    return {
      platform: "Facebook",
      externalPostId: path.split("/").filter(Boolean).pop() ?? "",
      canonicalUrl: raw,
      embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(raw)}&show_text=true&width=500`,
      format: null,
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL required" }, { status: 400 });

  let resolvedUrl = url.trim();

  // Follow redirects for known short-URL domains
  try {
    const u = new URL(resolvedUrl);
    const host = u.hostname.replace(/^www\./, "");
    if (SHORT_URL_HOSTS.has(host)) {
      resolvedUrl = await resolveRedirect(resolvedUrl);
    }
  } catch {
    // invalid URL — will fail below
  }

  const detected = detectPlatform(resolvedUrl);
  if (!detected) {
    return NextResponse.json(
      { error: "Unsupported URL. Supported: X/Twitter, Instagram, YouTube, TikTok, LinkedIn, Facebook" },
      { status: 400 }
    );
  }

  let title: string | null = null;
  let accountUsername: string | null = null;
  let thumbnailUrl: string | null = null;

  // oEmbed enrichment
  try {
    if (detected.platform === "X") {
      const r = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}&omit_script=true`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = await r.json();
        accountUsername = d.author_name ?? null;
        const stripped = (d.html as string ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        title = stripped.slice(0, 280) || null;
      }
    } else if (detected.platform === "YouTube") {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = await r.json();
        title = d.title ?? null;
        accountUsername = d.author_name ?? null;
        thumbnailUrl = d.thumbnail_url ?? null;
      }
    } else if (detected.platform === "TikTok") {
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = await r.json();
        title = d.title ?? null;
        accountUsername = d.author_unique_id ?? d.author_name ?? null;
        thumbnailUrl = d.thumbnail_url ?? null;
      }
    }
  } catch {
    // oEmbed is optional — continue with partial data
  }

  // Fall back to username from URL path
  if (!accountUsername) {
    try {
      const u = new URL(resolvedUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      const h = u.hostname;
      if (h.includes("twitter.com") || h.includes("x.com") || h.includes("instagram.com")) {
        accountUsername = parts[0]?.replace(/^@/, "") || null;
      } else if (h.includes("tiktok.com")) {
        accountUsername = parts[0]?.replace(/^@/, "") || null;
      }
    } catch {}
  }

  return NextResponse.json({
    platform: detected.platform,
    externalPostId: detected.externalPostId,
    canonicalUrl: detected.canonicalUrl,
    embedUrl: detected.embedUrl,
    originalUrl: url.trim(),
    format: detected.format,
    title,
    accountUsername,
    thumbnailUrl,
  });
}

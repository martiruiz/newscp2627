import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Detected {
  platform: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  format: string | null;
  accountUsername: string | null;
  title: string | null;
}

function detectPlatform(raw: string): Detected | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "").replace(/^mobile\./, "");
  const path = url.pathname;

  if (host === "twitter.com" || host === "x.com") {
    const webM = path.match(/\/i\/web\/status\/(\d+)/);
    if (webM) {
      const id = webM[1];
      return { platform: "X", externalPostId: id, canonicalUrl: `https://x.com/i/web/status/${id}`, embedUrl: `https://x.com/i/web/status/${id}`, format: null, accountUsername: null, title: null };
    }
    const m = path.match(/\/([^/]+)\/status\/(\d+)/);
    if (m) {
      const [, username, id] = m;
      return { platform: "X", externalPostId: id, canonicalUrl: `https://x.com/${username}/status/${id}`, embedUrl: `https://x.com/${username}/status/${id}`, format: null, accountUsername: username, title: null };
    }
  }

  if (host === "instagram.com" || host === "instagr.am") {
    const m = path.match(/\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const [, rawType, shortcode] = m;
      const type = rawType === "reels" ? "reel" : rawType;
      const fmt = type === "reel" ? "Reel" : type === "tv" ? "Video" : "Image";
      return { platform: "Instagram", externalPostId: shortcode, canonicalUrl: `https://www.instagram.com/${type}/${shortcode}/`, embedUrl: `https://www.instagram.com/${type}/${shortcode}/embed`, format: fmt, accountUsername: null, title: null };
    }
  }

  if (host === "youtube.com" || host === "youtu.be") {
    let videoId: string | null = null;
    if (host === "youtu.be") { videoId = path.slice(1).split("?")[0] || null; }
    else {
      const shortsM = path.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      const liveM = path.match(/\/live\/([A-Za-z0-9_-]+)/);
      const embedM = path.match(/\/embed\/([A-Za-z0-9_-]+)/);
      videoId = shortsM?.[1] ?? liveM?.[1] ?? embedM?.[1] ?? url.searchParams.get("v") ?? null;
    }
    if (videoId) return { platform: "YouTube", externalPostId: videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`, embedUrl: `https://www.youtube.com/embed/${videoId}`, format: "Video", accountUsername: null, title: null };
  }

  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    const m = path.match(/\/video\/(\d+)/) ?? path.match(/@[^/]+\/video\/(\d+)/);
    if (m) {
      const videoId = m[1];
      const userM = path.match(/@([^/]+)\/video\/\d+/);
      const username = userM?.[1] ?? null;
      return { platform: "TikTok", externalPostId: videoId, canonicalUrl: username ? `https://www.tiktok.com/@${username}/video/${videoId}` : raw, embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`, format: "Video", accountUsername: username, title: null };
    }
  }

  if (host === "linkedin.com" || host === "lnkd.in") {
    const urnM = path.match(/\/feed\/update\/(urn:[^/?#]+)/);
    if (urnM) {
      const urn = urnM[1];
      return { platform: "LinkedIn", externalPostId: urn, canonicalUrl: `https://www.linkedin.com/feed/update/${urn}/`, embedUrl: `https://www.linkedin.com/embed/feed/update/${urn}`, format: null, accountUsername: null, title: null };
    }
    const postsM = path.match(/\/posts\/([^/?#]+)/);
    if (postsM) {
      const slug = postsM[1];
      const actM = slug.match(/-(\d+)$/);
      const id = actM ? `urn:li:activity:${actM[1]}` : slug;
      const embedUrl = actM ? `https://www.linkedin.com/embed/feed/update/urn:li:activity:${actM[1]}` : raw;
      return { platform: "LinkedIn", externalPostId: id, canonicalUrl: raw, embedUrl, format: null, accountUsername: null, title: null };
    }
    return { platform: "LinkedIn", externalPostId: path.split("/").filter(Boolean).pop() ?? "", canonicalUrl: raw, embedUrl: raw, format: null, accountUsername: null, title: null };
  }

  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") {
    const watchV = url.searchParams.get("v");
    if (watchV) {
      const canonical = `https://www.facebook.com/watch?v=${watchV}`;
      return { platform: "Facebook", externalPostId: watchV, canonicalUrl: canonical, embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=true&width=500`, format: "Video", accountUsername: null, title: null };
    }
    const reelM = path.match(/\/reel\/(\d+)/);
    if (reelM) {
      const canonical = `https://www.facebook.com/reel/${reelM[1]}`;
      return { platform: "Facebook", externalPostId: reelM[1], canonicalUrl: canonical, embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=true&width=500`, format: "Reel", accountUsername: null, title: null };
    }
    const fbid = url.searchParams.get("fbid");
    if (fbid) return { platform: "Facebook", externalPostId: fbid, canonicalUrl: raw, embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(raw)}&show_text=true&width=500`, format: "Image", accountUsername: null, title: null };
    return { platform: "Facebook", externalPostId: path.split("/").filter(Boolean).pop() ?? "", canonicalUrl: raw, embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(raw)}&show_text=true&width=500`, format: null, accountUsername: null, title: null };
  }

  return null;
}

async function fetchOEmbed(detected: Detected): Promise<Partial<Detected>> {
  try {
    if (detected.platform === "YouTube") {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}&format=json`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); return { title: d.title ?? null, accountUsername: d.author_name ?? null }; }
    } else if (detected.platform === "TikTok") {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); return { title: d.title ?? null, accountUsername: d.author_unique_id ?? d.author_name ?? null }; }
    } else if (detected.platform === "X") {
      const r = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(detected.canonicalUrl)}&omit_script=true`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); const stripped = (d.html as string ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); return { title: stripped.slice(0, 280) || null, accountUsername: d.author_name ?? null }; }
    }
  } catch { /* oEmbed optional */ }
  return {};
}

export async function POST(request: NextRequest) {
  const { urls } = await request.json() as { urls: string[] };

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls required" }, { status: 400 });
  }

  const safeUrls = urls.slice(0, 100).map((u: string) => u.trim()).filter(Boolean);

  // Prefetch all platforms from DB once
  const dbPlatforms = await prisma.platform.findMany({ select: { id: true, name: true } });
  const platformMap = new Map(dbPlatforms.map((p) => [p.name.toLowerCase(), p.id]));

  let created = 0, duplicate = 0, ignored = 0, failed = 0;
  const errors: { url: string; error: string }[] = [];

  for (const url of safeUrls) {
    const detected = detectPlatform(url);
    if (!detected) {
      ignored++;
      continue;
    }

    // Resolve platform ID (look up by lowercase name, create if missing)
    let platformId = platformMap.get(detected.platform.toLowerCase());
    if (!platformId) {
      try {
        const slug = detected.platform.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const newPlatform = await prisma.platform.upsert({
          where: { slug },
          create: { name: detected.platform, slug },
          update: {},
          select: { id: true },
        });
        platformId = newPlatform.id;
        platformMap.set(detected.platform.toLowerCase(), platformId);
      } catch {
        failed++;
        errors.push({ url, error: `Unknown platform: ${detected.platform}` });
        continue;
      }
    }

    // Enrich with oEmbed (best-effort, don't block on failure)
    const enriched = await fetchOEmbed(detected);
    const finalDetected = { ...detected, ...enriched };

    try {
      await prisma.publication.create({
        data: {
          externalPostId: finalDetected.externalPostId,
          canonicalUrl: finalDetected.canonicalUrl,
          embedUrl: finalDetected.embedUrl,
          originalUrl: url,
          platformId,
          accountUsername: finalDetected.accountUsername || null,
          rawTitle: finalDetected.title || null,
          importStatus: "imported",
        },
      });
      created++;
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
        duplicate++;
      } else {
        failed++;
        errors.push({ url, error: msg.slice(0, 120) });
      }
    }
  }

  return NextResponse.json({ total: safeUrls.length, created, duplicate, ignored, failed, errors });
}

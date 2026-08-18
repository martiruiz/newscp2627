"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { PROFILES, Profile } from "@/lib/profiles-data";
import InstagramEmbed from "@/components/InstagramEmbed";
import YouTubeFeedEmbed from "@/components/YouTubeFeedEmbed";
import TikTokFeedEmbed from "@/components/TikTokFeedEmbed";
import TwitterEmbed from "@/components/TwitterEmbed";
import { getEffectivePlan } from "@/lib/plan-utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}
function fmtPctDisplay(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

const GRADIENTS = [
  "linear-gradient(135deg,#E8567A,#A82346)",
  "linear-gradient(135deg,#3B82F6,#1E3A8A)",
  "linear-gradient(135deg,#52D68A,#1B8A4E)",
  "linear-gradient(135deg,#F97316,#9A3412)",
  "linear-gradient(135deg,#8B5CF6,#4C1D95)",
  "linear-gradient(135deg,#06B6D4,#0E7490)",
  "linear-gradient(135deg,#D4A420,#7B4D0B)",
  "linear-gradient(135deg,#EC4899,#9D174D)",
];
function getGradient(id: string) {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ALL_COUNTRIES = Array.from(new Set(PROFILES.map((p) => p.country))).sort();
const ALL_INTERESTS = Array.from(
  new Set(PROFILES.flatMap((p) => p.interests))
).sort();

// ── Bar chart row ────────────────────────────────────────────────────────────

function StatBar({ label, value, max, color = "#3B82F6" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ width: 90, color: "var(--text-secondary)", flexShrink: 0, fontSize: 11 }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "var(--border-color)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .4s" }} />
      </div>
      <span style={{ width: 44, textAlign: "right", color: "var(--text-primary)", flexShrink: 0, fontSize: 11, fontWeight: 500 }}>
        {fmtPctDisplay(value)}
      </span>
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const photoUrl = `/api/ig-avatar?u=${encodeURIComponent(profile.username)}`;

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      {/* Gradient fallback always rendered beneath */}
      <div
        className="flex items-center justify-center w-full h-full font-bold select-none absolute inset-0"
        style={{
          background: getGradient(profile.id),
          color: "#fff",
          fontSize: size * 0.35,
          letterSpacing: "-0.5px",
          borderRadius: "50%",
        }}
      >
        {getInitials(profile.fullname)}
      </div>

      {/* Real photo on top — hides when it fails */}
      {!imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={profile.fullname}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      )}
    </div>
  );
}

// ── Social link icon ─────────────────────────────────────────────────────────

function SocialIcon({ type }: { type: string }) {
  const s = 16;
  switch (type) {
    case "instagram":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
    case "youtube":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>;
    case "tiktok":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>;
    case "x":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>;
    case "threads":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5c-.5-1.5-2-2.5-4-2.5-2.485 0-4.5 2.015-4.5 4.5 0 1.2.47 2.287 1.237 3.09.18.19.386.363.604.514.585.405 1.276.646 2.009.646 1.58 0 2.875-.916 3.51-2.25.2-.42.354-.875.423-1.35H12v-1.5h4.85c.035.246.053.496.053.75 0 2.97-2.03 5.4-5.153 5.4-2.57 0-4.7-1.73-5.247-4.05H5v-1.5h1.47A5.97 5.97 0 0 1 6 12c0-3.314 2.686-6 6-6 2.35 0 4.381 1.352 5.393 3.324L16.5 9.5z"/></svg>;
    default:
      return null;
  }
}

// ── Creator Content Carousel ─────────────────────────────────────────────────

type LibPost = {
  id: string;
  canonicalUrl: string;
  embedUrl: string;
  externalPostId: string;
  platform: string;
  publishedAt: string | null;
  accountUsername: string | null;
};

function extractInstagramShortcode(url: string): string {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? "";
}

function extractYouTubeId(url: string): string {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? "";
}

function extractTikTokId(url: string): string {
  const m = url.match(/video\/(\d+)/);
  return m?.[1] ?? "";
}

function extractTweetId(url: string): string {
  const m = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return m?.[1] ?? "";
}

function CreatorContent({ username }: { username: string }) {
  const [posts, setPosts] = useState<LibPost[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setIdx(0);
    fetch(`/api/publications?search=${encodeURIComponent(username)}&limit=30`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = (data.publications ?? []).filter(
          (p: LibPost) => p.accountUsername?.toLowerCase() === username.toLowerCase()
        );
        setPosts(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-5">
        <span className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>
          Carregant continguts…
        </span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Sense continguts a la biblioteca
        </span>
      </div>
    );
  }

  const post = posts[idx];
  const platform = post.platform.toLowerCase();
  const igShortcode = platform === "instagram" ? extractInstagramShortcode(post.canonicalUrl) : "";
  const ytId = platform === "youtube" ? extractYouTubeId(post.embedUrl || post.canonicalUrl) : "";
  const ttId = platform === "tiktok" ? extractTikTokId(post.canonicalUrl) : "";
  const tweetId = (platform === "twitter" || platform === "x") ? extractTweetId(post.canonicalUrl) : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Continguts a la biblioteca
        </h3>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {idx + 1} / {posts.length}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
        {platform === "instagram" && igShortcode ? (
          <InstagramEmbed shortcode={igShortcode} canonicalUrl={post.canonicalUrl} />
        ) : platform === "youtube" && ytId ? (
          <YouTubeFeedEmbed videoId={ytId} embedUrl={post.embedUrl} isShort={post.canonicalUrl.includes("/shorts/")} />
        ) : platform === "tiktok" && ttId ? (
          <TikTokFeedEmbed videoId={ttId} canonicalUrl={post.canonicalUrl} />
        ) : (platform === "twitter" || platform === "x") && tweetId ? (
          <TwitterEmbed tweetId={tweetId} canonicalUrl={post.canonicalUrl} />
        ) : (
          <a href={post.canonicalUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-8"
            style={{ background: "var(--bg-input)", color: "var(--accent-blue)", textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span className="text-sm font-medium">Veure contingut</span>
          </a>
        )}
      </div>

      {posts.length > 1 && (
        <div className="flex items-center justify-between mt-2 gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              color: idx === 0 ? "var(--text-muted)" : "var(--text-primary)",
              opacity: idx === 0 ? 0.4 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Anterior
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(posts.length - 1, i + 1))}
            disabled={idx === posts.length - 1}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              color: idx === posts.length - 1 ? "var(--text-muted)" : "var(--text-primary)",
              opacity: idx === posts.length - 1 ? 0.4 : 1,
            }}
          >
            Següent
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const maxAge = Math.max(
    profile.pctAge1317 ?? 0,
    profile.pctAge1824 ?? 0,
    profile.pctAge2534 ?? 0,
    profile.pctAge3544 ?? 0,
  );
  const maxCountry = profile.topCountries.reduce((m, c) => Math.max(m, c.pct), 0);
  const maxCity = profile.topCities.reduce((m, c) => Math.max(m, c.pct), 0);

  const hasDemographics = profile.pctMale !== null || profile.topCountries.length > 0;

  const socialLinks: { type: string; url: string; label: string }[] = [
    { type: "instagram", url: profile.instagramUrl, label: "Instagram" },
    { type: "youtube", url: profile.youtubeUrl, label: "YouTube" },
    { type: "tiktok", url: profile.tiktokUrl, label: "TikTok" },
    { type: "x", url: profile.xUrl, label: "X / Twitter" },
    { type: "threads", url: profile.threadsUrl, label: "Threads" },
  ].filter((s) => s.url);

  return (
    <div
      className="flex flex-col overflow-y-auto shrink-0"
      style={{
        width: 360,
        background: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border-color)",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 sticky top-0 z-10"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Profile</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg transition-all hover:opacity-70"
          style={{ width: 28, height: 28, color: "var(--text-muted)", background: "var(--bg-input)" }}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3">
          <Avatar profile={profile} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-base leading-tight" style={{ color: "var(--text-primary)" }}>
                {profile.fullname}
              </span>
              {profile.followers >= 100000 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
              )}
            </div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>@{profile.username}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {[profile.city, profile.country].filter(Boolean).join(", ")}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {profile.bio}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {profile.instagramUrl && (
            <a
              href={profile.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Ver perfil
            </a>
          )}
        </div>

        {/* Library content carousel */}
        <div style={{ borderTop: "1px solid var(--border-color)" }} />
        <CreatorContent username={profile.username} />

        <div style={{ borderTop: "1px solid var(--border-color)" }} />

        {/* Performance stats */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
            Rendimiento
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Seguidores", value: fmtNum(profile.followers) },
              { label: "ER%", value: fmtPct(profile.er) },
              { label: "Avg. Likes", value: fmtNum(profile.avgLikes) },
              { label: "Avg. Vídeos", value: profile.avgViews > 0 ? fmtNum(profile.avgViews) : "—" },
              { label: "Avg. Comentarios", value: fmtNum(profile.avgComments) },
              ...(profile.credibility > 0 ? [{ label: "Credibilidad", value: `${(profile.credibility * 100).toFixed(0)}%` }] : []),
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg p-2.5" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Demographics */}
        {hasDemographics && (
          <>
            <div style={{ borderTop: "1px solid var(--border-color)" }} />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                Seguidores
              </h3>

              {/* Gender */}
              {profile.pctMale !== null && profile.pctFemale !== null && (
                <div className="mb-4">
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Género</div>
                  <div className="space-y-1.5">
                    <StatBar label="Femenino" value={profile.pctFemale!} max={1} color="#EC4899" />
                    <StatBar label="Masculino" value={profile.pctMale!} max={1} color="#3B82F6" />
                  </div>
                </div>
              )}

              {/* Age */}
              {profile.pctAge1824 !== null && (
                <div className="mb-4">
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Edad</div>
                  <div className="space-y-1.5">
                    {profile.pctAge1317 !== null && <StatBar label="13–17" value={profile.pctAge1317} max={maxAge} color="#8B5CF6" />}
                    {profile.pctAge1824 !== null && <StatBar label="18–24" value={profile.pctAge1824} max={maxAge} color="#8B5CF6" />}
                    {profile.pctAge2534 !== null && <StatBar label="25–34" value={profile.pctAge2534} max={maxAge} color="#8B5CF6" />}
                    {profile.pctAge3544 !== null && <StatBar label="35–44" value={profile.pctAge3544} max={maxAge} color="#8B5CF6" />}
                  </div>
                </div>
              )}

              {/* Countries */}
              {profile.topCountries.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Países</div>
                  <div className="space-y-1.5">
                    {profile.topCountries.map((c) => (
                      <StatBar key={c.name} label={c.name} value={c.pct} max={maxCountry} color="#06B6D4" />
                    ))}
                  </div>
                </div>
              )}

              {/* Cities */}
              {profile.topCities.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Ciudades</div>
                  <div className="space-y-1.5">
                    {profile.topCities.map((c) => (
                      <StatBar key={c.name} label={c.name} value={c.pct} max={maxCity} color="#52D68A" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Interests */}
        {profile.interests.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid var(--border-color)" }} />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                Intereses
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((int) => (
                  <span
                    key={int}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
                  >
                    {int}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid var(--border-color)" }} />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                Redes sociales
              </h3>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.type}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                    className="flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                    style={{ width: 32, height: 32, background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
                  >
                    <SocialIcon type={link.type} />
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Email */}
        {profile.email && (
          <>
            <div style={{ borderTop: "1px solid var(--border-color)" }} />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Email</h3>
              <a
                href={`mailto:${profile.email}`}
                className="text-sm hover:underline"
                style={{ color: "var(--accent-blue)" }}
              >
                {profile.email}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Filter label with info tooltip ───────────────────────────────────────────

function FilterLabel({ text, info }: { text: string; info: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1.5 relative">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {text}
      </span>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center justify-center rounded-full shrink-0 transition-all hover:opacity-80"
        style={{ width: 14, height: 14, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
        aria-label={`Info sobre ${text}`}
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-50 rounded-lg p-2.5 text-xs leading-relaxed shadow-lg"
          style={{
            top: "calc(100% + 6px)",
            left: 0,
            width: 190,
            background: "var(--bg-primary, #1a1a2e)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}

// ── Filter Sidebar ────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  gender: "all" | "MALE" | "FEMALE";
  countries: Set<string>;
  minFollowers: string;
  maxFollowers: string;
  minER: string;
  maxER: string;
}

function FilterSidebarPanel({
  filters,
  onChange,
  fullWidth = false,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  fullWidth?: boolean;
}) {
  function update(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }
  function toggleCountry(c: string) {
    const next = new Set(filters.countries);
    if (next.has(c)) next.delete(c); else next.add(c);
    update({ countries: next });
  }
  function reset() {
    onChange({ search: "", gender: "all", countries: new Set(), minFollowers: "", maxFollowers: "", minER: "", maxER: "" });
  }

  const active =
    filters.search ||
    filters.gender !== "all" ||
    filters.countries.size > 0 ||
    filters.minFollowers ||
    filters.maxFollowers ||
    filters.minER ||
    filters.maxER;

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{
        width: fullWidth ? "100%" : 240,
        borderRight: fullWidth ? "none" : "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
      }}
    >
      <div className="p-4 space-y-5">
        {/* Header — only shown in desktop sidebar, not in mobile sheet (sheet has its own header) */}
        {!fullWidth && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Filtros</span>
            {active && (
              <button onClick={reset} className="text-xs hover:underline" style={{ color: "var(--accent-blue)" }}>
                Limpiar
              </button>
            )}
          </div>
        )}
        {fullWidth && active && (
          <div className="flex justify-end">
            <button onClick={reset} className="text-xs hover:underline" style={{ color: "var(--accent-blue)" }}>
              Limpiar filtres
            </button>
          </div>
        )}

        {/* Search */}
        <div>
          <FilterLabel text="Buscar" info="Filtra por nombre completo, @handle o país del creador." />
          <div className="relative mt-1.5">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Nombre o @handle"
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <FilterLabel text="Género" info="Filtra por el género declarado del creador en la plataforma." />
          <div className="flex gap-1 mt-1.5">
            {(["all", "FEMALE", "MALE"] as const).map((g) => (
              <button
                key={g}
                onClick={() => update({ gender: g })}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filters.gender === g ? "var(--accent-blue)" : "var(--bg-input)",
                  color: filters.gender === g ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {g === "all" ? "Todos" : g === "FEMALE" ? "Mujer" : "Hombre"}
              </button>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div>
          <FilterLabel text="País" info="País de residencia o registro del creador. Puedes seleccionar varios a la vez." />
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1 mt-1.5">
            {ALL_COUNTRIES.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer py-0.5 group">
                <input
                  type="checkbox"
                  checked={filters.countries.has(c)}
                  onChange={() => toggleCountry(c)}
                  className="rounded"
                  style={{ accentColor: "var(--accent-blue)" }}
                />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Followers range */}
        <div>
          <FilterLabel text="Seguidores" info="Número total de seguidores en Instagram. Introduce un mínimo, un máximo, o ambos para acotar el rango." />
          <div className="flex gap-2 mt-1.5">
            <input
              type="number"
              placeholder="Mín"
              value={filters.minFollowers}
              onChange={(e) => update({ minFollowers: e.target.value })}
              className="w-0 flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
            <input
              type="number"
              placeholder="Máx"
              value={filters.maxFollowers}
              onChange={(e) => update({ maxFollowers: e.target.value })}
              className="w-0 flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* ER% range */}
        <div>
          <FilterLabel text="ER%" info="Engagement Rate: porcentaje de seguidores que interactúan (likes + comentarios) respecto al total. Un ER alto indica una comunidad muy activa. Introduce valores en % (ej: 2 para 2%)." />
          <div className="flex gap-2 mt-1.5">
            <input
              type="number"
              placeholder="Mín%"
              value={filters.minER}
              onChange={(e) => update({ minER: e.target.value })}
              className="w-0 flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
            <input
              type="number"
              placeholder="Máx%"
              value={filters.maxER}
              onChange={(e) => update({ maxER: e.target.value })}
              className="w-0 flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Profile card ─────────────────────────────────────────────────────────────

function ProfileRow({
  profile,
  selected,
  onClick,
  isMobile = false,
}: {
  profile: Profile;
  selected: boolean;
  onClick: () => void;
  isMobile?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-all rounded-xl"
      style={{
        border: selected
          ? "1.5px solid var(--accent-blue)"
          : "1px solid var(--border-color)",
        background: selected
          ? "var(--bg-input)"
          : "var(--bg-secondary)",
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,.08)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-input)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)";
        }
      }}
    >
      {isMobile ? (
        /* ── Mobile: 2-row card ── */
        <>
          {/* Top row: avatar + name + chevron */}
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
            <Avatar profile={profile} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-sm leading-tight" style={{ color: "var(--text-primary)" }}>
                  {profile.fullname}
                </span>
                {profile.followers >= 100000 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" className="shrink-0">
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                  </svg>
                )}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                @{profile.username}
                {profile.country && <span className="ml-1.5" style={{ opacity: 0.7 }}>· {profile.country}</span>}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" className="shrink-0"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>

          {/* Stats row */}
          <div className="flex" style={{ borderTop: "1px solid var(--border-color)" }}>
            {[
              { label: "Seguidores", value: fmtNum(profile.followers) },
              { label: "ER%", value: fmtPct(profile.er) },
              { label: "Avg Likes", value: fmtNum(profile.avgLikes) },
              { label: "Avg Vídeos", value: profile.avgViews > 0 ? fmtNum(profile.avgViews) : "—" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex-1 text-center py-2.5"
                style={{ borderLeft: i > 0 ? "1px solid var(--border-color)" : "none" }}>
                <div className="text-[8px] uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
                <div className="text-xs font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── Desktop: single-row card ── */
        <div className="flex items-center px-5 py-3.5">
          <Avatar profile={profile} size={40} />
          <div className="min-w-0 ml-3.5 mr-4" style={{ width: 160, flexShrink: 0 }}>
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                {profile.fullname}
              </span>
              {profile.followers >= 100000 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" className="shrink-0">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
              )}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              @{profile.username}
              {profile.country && <span className="ml-1.5" style={{ opacity: 0.7 }}>· {profile.country}</span>}
            </div>
          </div>
          <div className="flex items-center flex-1" style={{ borderLeft: "1px solid var(--border-color)" }}>
            {[
              { label: "Seguidores", value: fmtNum(profile.followers) },
              { label: "ER%", value: fmtPct(profile.er) },
              { label: "Avg Likes", value: fmtNum(profile.avgLikes) },
              { label: "Avg Vídeos", value: profile.avgViews > 0 ? fmtNum(profile.avgViews) : "—" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex-1 text-center py-0.5"
                style={{ borderLeft: i > 0 ? "1px solid var(--border-color)" : "none" }}>
                <div className="text-[9px] uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
                <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" className="shrink-0 ml-3"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = "followers" | "er" | "avgLikes";

export default function ProfilesPage() {
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    gender: "all",
    countries: new Set<string>(),
    minFollowers: "",
    maxFollowers: "",
    minER: "",
    maxER: "",
  });
  const [sortKey, setSortKey] = useState<SortKey>("followers");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/user/plan").then((r) => r.json()).then((d) => {
      const { plan, isSuperAdmin } = getEffectivePlan(d);
      setUserPlan(plan);
      setIsSuperAdmin(isSuperAdmin);
    }).catch(() => setUserPlan("free"));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = useMemo(() => {
    let list = PROFILES.filter((p) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!p.fullname.toLowerCase().includes(q) && !p.username.toLowerCase().includes(q) && !p.country.toLowerCase().includes(q)) return false;
      }
      if (filters.gender !== "all" && p.gender !== filters.gender) return false;
      if (filters.countries.size > 0 && !filters.countries.has(p.country)) return false;
      if (filters.minFollowers && p.followers < Number(filters.minFollowers)) return false;
      if (filters.maxFollowers && p.followers > Number(filters.maxFollowers)) return false;
      if (filters.minER && p.er * 100 < Number(filters.minER)) return false;
      if (filters.maxER && p.er * 100 > Number(filters.maxER)) return false;
      return true;
    });
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return list;
  }, [filters, sortKey, sortDir]);

  const selectedProfile = filtered.find((p) => p.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className="flex items-center gap-1 text-xs font-semibold transition-all hover:opacity-70"
        style={{ color: active ? "var(--accent-blue)" : "var(--text-muted)" }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {active && sortDir === "asc"
            ? <path d="M12 20V4M5 11l7-7 7 7"/>
            : <path d="M12 4v16M5 13l7 7 7-7"/>
          }
        </svg>
      </button>
    );
  }

  const activeFiltersCount =
    (filters.search ? 1 : 0) +
    (filters.gender !== "all" ? 1 : 0) +
    filters.countries.size +
    (filters.minFollowers || filters.maxFollowers ? 1 : 0) +
    (filters.minER || filters.maxER ? 1 : 0);

  const PROFILES_ALLOWED = new Set(["basic", "pro"]);
  const profilesLocked = userPlan !== null && !PROFILES_ALLOWED.has(userPlan) && !isSuperAdmin;

  return (
    <div className="flex" style={{ height: "calc(100vh - 0px)", overflow: "hidden", position: "relative" }}>
      {/* Blur overlay for locked plans */}
      {profilesLocked && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 50,
            backdropFilter: "blur(8px)",
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            className="rounded-2xl p-8 max-w-sm w-full text-center mx-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4 mx-auto"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>
              Secció Profiles
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Segueix perfils de clubs, creadors de contingut, jugadors i patrocinadors. Disponible a partir del pla Basic.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event("open-pricing-sheet"))}
              className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Veure plans
            </button>
            <a href="/feed" className="block mt-3 text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
              Torna a la biblioteca
            </a>
          </div>
        </div>
      )}

      {/* Desktop filter sidebar */}
      {!isMobile && <FilterSidebarPanel filters={filters} onChange={setFilters} />}

      {/* List — hidden on mobile when detail panel is open */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ display: isMobile && selectedProfile ? "none" : "flex" }}
      >
        {/* List header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {filtered.length} perfil{filtered.length !== 1 ? "es" : ""}
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <SortBtn col="followers" label="Seguidores" />
            {!isMobile && <SortBtn col="er" label="ER%" />}
            {!isMobile && <SortBtn col="avgLikes" label="Engagement" />}
            {/* Mobile filter button */}
            {isMobile && (
              <button
                onClick={() => setFilterOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold relative"
                style={{
                  background: activeFiltersCount > 0 ? "var(--accent-blue)" : "var(--bg-input)",
                  color: activeFiltersCount > 0 ? "#fff" : "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Filtres
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ width: 16, height: 16, background: "#fff", color: "var(--accent-blue)" }}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Profile list */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-primary, var(--bg-input))" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="text-sm">No se encontraron perfiles</span>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filtered.map((p) => (
                <ProfileRow
                  key={p.id}
                  profile={p}
                  selected={selectedId === p.id}
                  onClick={() => handleSelect(p.id)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop detail panel */}
      {selectedProfile && !isMobile && (
        <DetailPanel profile={selectedProfile} onClose={() => setSelectedId(null)} />
      )}

      {/* Mobile detail panel — full screen overlay */}
      {selectedProfile && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          style={{ background: "var(--bg-secondary)" }}>
          <DetailPanel profile={selectedProfile} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {/* Mobile filter bottom sheet */}
      {filterOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setFilterOpen(false); }}>
          <div className="flex flex-col rounded-t-2xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", maxHeight: "85vh" }}>
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--border-color)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Filtres</span>
              <button onClick={() => setFilterOpen(false)}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: "var(--bg-input)", color: "var(--text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <FilterSidebarPanel filters={filters} onChange={setFilters} fullWidth />
          </div>
        </div>
      )}
    </div>
  );
}

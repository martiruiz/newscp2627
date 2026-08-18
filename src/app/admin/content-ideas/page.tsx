"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BulkEditPanel } from "@/components/BulkActionBar";
import ReviewPanel from "@/components/ReviewPanel";

/* ── Twitter widget singleton ── */
declare global { interface Window { twttr?: { widgets: { createTweet: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLElement | undefined>; load: (el?: HTMLElement) => void; }; }; } }
let _twttrPromise: Promise<void> | null = null;
function loadTwitterScript(): Promise<void> {
  if (_twttrPromise) return _twttrPromise;
  _twttrPromise = new Promise((resolve) => {
    if (window.twttr?.widgets) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "twitter-wjs"; s.src = "https://platform.twitter.com/widgets.js"; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { _twttrPromise = null; resolve(); };
    document.head.appendChild(s);
  });
  return _twttrPromise;
}

function AdminTwitterEmbed({ tweetId, canonicalUrl }: { tweetId: string; canonicalUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) container.innerHTML = `<a href="${canonicalUrl}" target="_blank" rel="noopener noreferrer" style="color:#1d9bf0">View on X ↗</a>`; }, 8000);
    loadTwitterScript().then(() => {
      if (cancelled) return;
      if (!window.twttr?.widgets?.createTweet) { clearTimeout(timer); return; }
      window.twttr.widgets.createTweet(tweetId, container, { dnt: true, conversation: "none", cards: "visible", align: "center" })
        .then((el) => { clearTimeout(timer); if (cancelled) { container.innerHTML = ""; } else if (!el) { container.innerHTML = `<a href="${canonicalUrl}" target="_blank" style="color:#1d9bf0">View on X ↗</a>`; } })
        .catch(() => clearTimeout(timer));
    });
    return () => { cancelled = true; clearTimeout(timer); container.innerHTML = ""; };
  }, [tweetId, canonicalUrl]);
  return <div ref={containerRef} style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }} />;
}

function AdminLinkedInEmbed({ originalUrl, canonicalUrl }: { originalUrl: string; canonicalUrl: string }) {
  const embedUrl = originalUrl.includes("linkedin.com")
    ? originalUrl.replace("https://www.linkedin.com/feed/update/", "https://www.linkedin.com/embed/feed/update/").replace(/\/$/, "")
    : null;
  if (!embedUrl) return <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0A66C2" }}>View on LinkedIn ↗</a>;
  return <div style={{ overflow: "hidden", width: "100%" }}><iframe src={embedUrl} style={{ border: "none", display: "block", width: "100%", height: 700 }} scrolling="no" title="LinkedIn post" allowFullScreen /></div>;
}

function AdminFacebookEmbed({ originalUrl, canonicalUrl }: { originalUrl: string; canonicalUrl: string }) {
  const isFb = originalUrl.includes("facebook.com");
  if (!isFb) return <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1877F2" }}>View on Facebook ↗</a>;
  const embedUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(originalUrl)}&show_text=true&width=500`;
  return <iframe src={embedUrl} style={{ border: "none", display: "block", width: "100%", minHeight: 500 }} scrolling="no" title="Facebook post" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" />;
}

interface Publication {
  id: string;
  externalPostId: string;
  rawTitle: string | null;
  publishedAt: string | null;
  platform: string;
  sport: string | null;
  entity: string | null;
  entityName: string | null;
  accountUsername: string | null;
  format: string | null;
  competitions: string[];
  canonicalUrl: string;
  embedUrl: string;
  originalUrl: string | null;
  classificationIds: string[];
  classificationSlugs: string[];
  reviewStatus?: string | null;
  importStatus?: string | null;
}

interface PublicationDetail {
  id: string;
  externalPostId: string;
  rawTitle: string | null;
  publishedAt: string | null;
  embedUrl: string;
  canonicalUrl: string;
  originalUrl: string | null;
  accountUsername: string | null;
  platformId: string;
  platform: string;
  sportId: string | null;
  sport: string | null;
  entityTypeId: string | null;
  entity: string | null;
  entityName: string | null;
  contentFormatId: string | null;
  format: string | null;
  competitions: { id: string; name: string }[];
  classifications: { id: string; name: string }[];
  contentCategories: { id: string; name: string }[];
}

interface TaxOption { id: string; name: string; slug: string; }
interface FilterOption { name: string; slug: string; count?: number }

interface Filters {
  sport: string; entity: string; competition: string; club: string;
  format: string; platform: string; search: string; externalId: string;
  dateFrom: string; dateTo: string;
  incompleteOnly: boolean;
  createdAfter: string;
}

const EMPTY: Filters = {
  sport: "", entity: "", competition: "", club: "",
  format: "", platform: "", search: "", externalId: "",
  dateFrom: "", dateTo: "",
  incompleteOnly: false,
  createdAfter: "",
};

function FilterSelect({
  label, value, options, onChange, multi = false,
}: {
  label: string; value: string; options: FilterOption[]; onChange: (v: string) => void; multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // For multi mode, value is comma-separated slugs
  const selectedSlugs = multi ? value.split(",").filter(Boolean) : [];
  const current = !multi ? options.find((o) => o.slug === value) : null;
  const hasValue = multi ? selectedSlugs.length > 0 : !!value;

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => { if (!open) setSearch(""); }, [open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleMulti(slug: string) {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    onChange(next.join(","));
  }

  function triggerLabel() {
    if (multi) {
      if (selectedSlugs.length === 0) return "Select";
      if (selectedSlugs.length === 1) return options.find((o) => o.slug === selectedSlugs[0])?.name ?? "1 selected";
      return `${selectedSlugs.length} selected`;
    }
    return current?.name ?? "Select";
  }

  function fmtCount(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : n.toLocaleString();
  }

  return (
    <div ref={ref} className="relative">
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm outline-none text-left"
        style={{
          background: "var(--bg-input)",
          border: `1px solid ${hasValue ? "var(--color-charcoal)" : open ? "rgba(var(--color-charcoal-rgb, 31,41,55), 0.5)" : "var(--border-color)"}`,
          color: hasValue ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span className="truncate flex items-center gap-2">
          {triggerLabel()}
          {multi && selectedSlugs.length > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
              {selectedSlugs.length}
            </span>
          )}
        </span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, marginLeft: 6, opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", top: "100%", minWidth: 220 }}
        >
          {/* Search */}
          <div className="p-2">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
              style={{ background: "var(--bg-input)", border: `1px solid ${search ? "var(--color-charcoal)" : "var(--border-color)"}` }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                placeholder="Search…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: "var(--text-muted)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* Multi: clear selection row */}
          {multi && hasValue && (
            <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedSlugs.length} selected</span>
              <button onClick={() => onChange("")} className="text-[11px] font-medium" style={{ color: "var(--color-charcoal)" }}>Clear</button>
            </div>
          )}

          {/* Options */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {/* Single mode: "All" clear option */}
            {!multi && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="w-full flex items-center px-3 py-2 text-xs text-left"
                style={{ color: !value ? "var(--color-charcoal)" : "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}
                onMouseEnter={(e) => { if (value) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                All {label.toLowerCase()}s
                {!value && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "auto" }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>No results</div>
            ) : filtered.map((o) => {
              const isSel = multi ? selectedSlugs.includes(o.slug) : value === o.slug;
              return (
                <button
                  key={o.slug}
                  type="button"
                  onClick={() => multi ? toggleMulti(o.slug) : (onChange(o.slug), setOpen(false))}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                  style={{ background: isSel ? "var(--color-charcoal-subtle)" : "transparent", color: isSel ? "var(--color-charcoal)" : "var(--text-primary)" }}
                  onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isSel ? "var(--color-charcoal-subtle)" : "transparent"; }}
                >
                  {multi && (
                    <span
                      className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: isSel ? "var(--selected-bg)" : "transparent",
                        border: `1.5px solid ${isSel ? "var(--selected-bg)" : "var(--text-muted)"}`,
                        color: isSel ? "var(--selected-text)" : "transparent",
                      }}
                    >
                      {isSel && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  )}
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.count !== undefined && o.count > 0 && (
                    <span className="text-[10px] shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {fmtCount(o.count)}
                    </span>
                  )}
                  {!multi && isSel && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Multi mode: Done button */}
          {multi && (
            <div className="flex justify-end px-3 py-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlayButton() {
  return (
    <div
      className="flex items-center justify-center rounded-full transition-transform hover:scale-110"
      style={{ width: 56, height: 56, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  );
}

function YouTubeEmbed({ videoId, embedUrl }: { videoId: string; embedUrl: string }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (playing) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
        className="w-full rounded-xl"
        style={{ height: 300, border: "none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      className="relative w-full rounded-xl overflow-hidden cursor-pointer group"
      style={{ aspectRatio: "16/9", background: "#000" }}
    >
      <img src={thumb} alt="" className="w-full h-full object-cover" style={{ opacity: 0.9 }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <PlayButton />
      </div>
      {/* YouTube logo */}
      <div className="absolute bottom-3 right-3">
        <svg width="48" height="34" viewBox="0 0 48 34">
          <path d="M47 5.3C46.5 3.5 45 2.1 43.2 1.6 39.5.7 24 .7 24 .7s-15.5 0-19.2.9C3 2.1 1.5 3.5 1 5.3.1 9 .1 17 .1 17s0 8 .9 11.7C1.5 30.5 3 31.9 4.8 32.4c3.7.9 19.2.9 19.2.9s15.5 0 19.2-.9c1.8-.5 3.3-1.9 3.8-3.7C48 25 48 17 48 17s0-8-.9-11.7z" fill="#ff0000"/>
          <path d="M19 24l12.8-7L19 10v14z" fill="white"/>
        </svg>
      </div>
    </div>
  );
}

const TIKTOK_ICON = "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.01-8.83a8.18 8.18 0 0 0 4.78 1.52V4.56a4.85 4.85 0 0 1-1-.13z";

function TikTokEmbed({ videoId, canonicalUrl }: { videoId: string; canonicalUrl: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setThumb(null);
    setThumbLoaded(false);
    setPlaying(false);
    fetch(`/api/admin/tiktok-thumb?videoId=${videoId}`)
      .then((r) => r.json())
      .then((d) => setThumb(d.thumb ?? null))
      .catch(() => {});
  }, [videoId]);

  if (playing) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ width: 325, height: 578, background: "#000", flexShrink: 0, position: "relative" }}
      >
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title="TikTok video"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      className="relative cursor-pointer rounded-xl overflow-hidden"
      style={{ width: 325, height: 578, background: "#000", flexShrink: 0 }}
    >
      {thumb ? (
        <>
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: thumbLoaded ? 0.85 : 0 }}
            onLoad={() => setThumbLoaded(true)}
          />
          {!thumbLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#111" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white" opacity="0.3">
                <path d={TIKTOK_ICON} />
              </svg>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#111" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="white" opacity="0.25">
            <path d={TIKTOK_ICON} />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <PlayButton />
      </div>
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d={TIKTOK_ICON} />
        </svg>
        <span className="text-white text-[11px] font-semibold">TikTok</span>
      </div>
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 right-3 px-2 py-1 rounded-lg text-white text-[11px] font-semibold"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        ↗
      </a>
    </div>
  );
}

function EmbedPreview({ pub }: { pub: PublicationDetail }) {
  const platform = pub.platform.toLowerCase();

  if (platform === "youtube") {
    return <YouTubeEmbed videoId={pub.externalPostId} embedUrl={pub.embedUrl} />;
  }

  if (platform === "tiktok") {
    return <TikTokEmbed videoId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} />;
  }

  if (platform === "instagram") {
    const iframeSrc = pub.canonicalUrl.replace(/\/$/, "") + "/embed";
    return (
      <iframe
        src={iframeSrc}
        className="w-full rounded-xl"
        style={{ height: 480, border: "none", maxWidth: 360 }}
        allowFullScreen
        scrolling="no"
      />
    );
  }

  if (platform === "twitter" || platform === "x") {
    return <AdminTwitterEmbed tweetId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} />;
  }

  if (platform === "linkedin") {
    return <AdminLinkedInEmbed originalUrl={pub.originalUrl || pub.canonicalUrl} canonicalUrl={pub.canonicalUrl} />;
  }

  if (platform === "facebook") {
    return <AdminFacebookEmbed originalUrl={pub.originalUrl || pub.canonicalUrl} canonicalUrl={pub.canonicalUrl} />;
  }

  // Generic fallback
  return (
    <div
      className="rounded-xl p-6 flex flex-col items-center justify-center gap-4 text-center"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", minHeight: 200 }}
    >
      <PlatformIcon platform={platform} size={40} />
      <a
        href={pub.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
        style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
      >
        View on {pub.platform}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  );
}

function PlatformIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
    </svg>
  );
  if (p === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.01-8.83a8.18 8.18 0 0 0 4.78 1.52V4.56a4.85 4.85 0 0 1-1-.13z"/>
    </svg>
  );
  if (p === "youtube") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

/* ── Custom date range picker ── */
const MONTHS_CA = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
const WEEKDAYS_CA = ["Dl","Dt","Dc","Dj","Dv","Ds","Dg"];

function toISODate(d: Date): string { return d.toISOString().slice(0, 10); }

function AdminDateRangePicker({ from, to, onChange }: {
  from: string; to: string; onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const ref = from || to;
    return ref ? new Date(ref + "T00:00:00") : new Date();
  });
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const todayStr = toISODate(new Date());

  const days: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push({ iso: toISODate(new Date(year, month, d)), day: d });
  while (days.length % 7 !== 0) days.push(null);

  function handleDayClick(iso: string) {
    if (!from || (from && to) || iso < from) {
      onChange(iso, ""); setSelectingEnd(true);
    } else {
      onChange(from, iso); setSelectingEnd(false); setOpen(false);
    }
  }

  function inRange(iso: string) {
    const end = selectingEnd && hovered ? hovered : to;
    if (!from || !end) return false;
    const lo = from < end ? from : end;
    const hi = from < end ? end : from;
    return iso > lo && iso < hi;
  }

  const displayTo = selectingEnd && hovered ? hovered : to;

  function fmt(iso: string) { return iso ? iso.split("-").reverse().join("/") : null; }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Data</div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs outline-none text-left"
        style={{ background: "var(--bg-input)", border: `1px solid ${(from || to) ? "var(--color-charcoal)" : "var(--border-color)"}`, color: (from || to) ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        {from || to ? (
          <span>{fmt(from) ?? "—"} → {fmt(to) ?? "…"}</span>
        ) : <span>Filtra per data</span>}
        {(from || to) && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange("", ""); setSelectingEnd(false); }}
            className="ml-auto hover:opacity-70 text-base leading-none"
            style={{ color: "var(--text-muted)" }}
          >×</span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded-xl p-3 z-50"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 16px 48px rgba(0,0,0,0.4)", width: 240 }}
        >
          {/* Range chips */}
          {(from || to) && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 rounded-lg px-2 py-1 text-center text-[11px] font-semibold"
                style={{ background: from ? "var(--selected-bg)" : "var(--bg-input)", color: from ? "var(--selected-text)" : "var(--text-muted)", border: `1px solid ${from ? "var(--selected-bg)" : "var(--border-color)"}` }}>
                {fmt(from) ?? "Inici"}
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div className="flex-1 rounded-lg px-2 py-1 text-center text-[11px] font-semibold"
                style={{ background: displayTo ? "var(--selected-bg)" : "var(--bg-input)", color: displayTo ? "var(--selected-text)" : "var(--text-muted)", border: `1px solid ${displayTo ? "var(--selected-bg)" : "var(--border-color)"}` }}>
                {fmt(displayTo) ?? "Fi"}
              </div>
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex items-center justify-center rounded-lg hover:opacity-70 transition-all"
              style={{ width: 24, height: 24, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{MONTHS_CA[month]} {year}</span>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex items-center justify-center rounded-lg hover:opacity-70 transition-all"
              style={{ width: 24, height: 24, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS_CA.map(d => (
              <div key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((d, i) => {
              if (!d) return <div key={`e-${i}`} />;
              const isFrom = d.iso === from;
              const isTo = d.iso === displayTo;
              const isToday = d.iso === todayStr;
              const isInRange = inRange(d.iso);
              const isSelected = isFrom || isTo;
              return (
                <button
                  key={d.iso}
                  onClick={() => handleDayClick(d.iso)}
                  onMouseEnter={() => selectingEnd && setHovered(d.iso)}
                  onMouseLeave={() => selectingEnd && setHovered(null)}
                  className="flex items-center justify-center text-[11px] font-medium transition-all"
                  style={{
                    height: 28,
                    borderRadius: isSelected ? 7 : isInRange ? 0 : 7,
                    background: isSelected ? "var(--selected-bg)" : isInRange ? "rgba(37,99,235,0.15)" : "transparent",
                    color: isSelected ? "var(--selected-text)" : isToday ? "var(--color-charcoal)" : "var(--text-primary)",
                    fontWeight: isSelected || isToday ? 700 : 500,
                    outline: isToday && !isSelected ? "1.5px solid var(--selected-bg)" : "none",
                    outlineOffset: -1,
                  }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          {(from || to) && (
            <button
              onClick={() => { onChange("", ""); setSelectingEnd(false); setHovered(null); }}
              className="w-full mt-3 py-1.5 rounded-lg text-[11px] font-medium hover:opacity-80 transition-all"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            >
              Esborra dates
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailDrawer({
  pubId,
  onClose,
  onSaved,
  onDeleted,
  taxOptions,
}: {
  pubId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  taxOptions: {
    sports: TaxOption[];
    entities: TaxOption[];
    formats: TaxOption[];
    platforms: TaxOption[];
    competitions: TaxOption[];
    classifications: TaxOption[];
    contentCategories: TaxOption[];
  };
}) {
  const [pub, setPub] = useState<PublicationDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const [editSportId, setEditSportId] = useState("");
  const [editEntityTypeId, setEditEntityTypeId] = useState("");
  const [editContentFormatId, setEditContentFormatId] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");
  const [editEntityName, setEditEntityName] = useState("");
  const [editAccountUsername, setEditAccountUsername] = useState("");
  const [editRawTitle, setEditRawTitle] = useState("");
  const [editPublishedAt, setEditPublishedAt] = useState("");
  const [editCompetitionIds, setEditCompetitionIds] = useState<string[]>([]);
  const [editClassificationIds, setEditClassificationIds] = useState<string[]>([]);
  const [editContentCategoryIds, setEditContentCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/admin/publications?id=${pubId}`)
      .then((r) => r.json())
      .then((d: PublicationDetail) => {
        setPub(d);
        setEditSportId(d.sportId ?? "");
        setEditEntityTypeId(d.entityTypeId ?? "");
        setEditContentFormatId(d.contentFormatId ?? "");
        setEditPlatformId(d.platformId ?? "");
        setEditEntityName(d.entityName ?? "");
        setEditAccountUsername(d.accountUsername ?? "");
        setEditRawTitle(d.rawTitle ?? "");
        setEditPublishedAt(d.publishedAt ? new Date(d.publishedAt).toISOString().slice(0, 16) : "");
        setEditCompetitionIds(d.competitions.map((c) => c.id));
        setEditClassificationIds(d.classifications.map((c) => c.id));
        setEditContentCategoryIds(d.contentCategories.map((c) => c.id));
      });
  }, [pubId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publications?id=${pubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportId: editSportId || null,
          entityTypeId: editEntityTypeId || null,
          contentFormatId: editContentFormatId || null,
          platformId: editPlatformId || null,
          entityName: editEntityName || null,
          accountUsername: editAccountUsername || null,
          rawTitle: editRawTitle || null,
          publishedAt: editPublishedAt || null,
          competitionIds: editCompetitionIds,
          classificationIds: editClassificationIds,
          contentCategoryIds: editContentCategoryIds,
        }),
      });
      if (!res.ok) { setError("Error saving"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/publications?id=${pubId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteOpen) { setDeleteOpen(false); return; }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, deleteOpen]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — centered, large */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto flex flex-col overflow-hidden w-full"
          style={{
            maxWidth: 1200,
            height: "calc(100vh - 48px)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3.5 shrink-0"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0"
                style={{ width: 30, height: 30, background: "var(--bg-input)", color: "var(--text-muted)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {pub?.rawTitle
                    ? (pub.rawTitle.length > 80 ? pub.rawTitle.slice(0, 80) + "…" : pub.rawTitle)
                    : pub?.externalPostId ?? "Loading…"}
                </div>
                {pub && (
                  <div className="text-[11px] mt-0.5 font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {pub.externalPostId} · {pub.platform}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pub && (
                <a
                  href={pub.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  View original
                </a>
              )}
              <button
                onClick={() => { setDeleteInput(""); setDeleteOpen(true); }}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                style={{ background: saved ? "#22c55e" : "var(--selected-bg)", color: saved ? "#fff" : "var(--selected-text)" }}
              >
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
              </button>
            </div>
          </div>

          {!pub ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              Loading…
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* LEFT: editable fields */}
              <div
                className="overflow-y-auto p-5 shrink-0"
                style={{
                  width: 340,
                  borderRight: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                }}
              >
                {error && (
                  <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <Field label="Title">
                    <input
                      type="text"
                      value={editRawTitle}
                      onChange={(e) => setEditRawTitle(e.target.value)}
                      placeholder="Post title or caption"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </Field>

                  <Field label="Account username">
                    <input
                      type="text"
                      value={editAccountUsername}
                      onChange={(e) => setEditAccountUsername(e.target.value)}
                      placeholder="@username"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </Field>

                  <Field label="Club / Entity name">
                    <input
                      type="text"
                      value={editEntityName}
                      onChange={(e) => setEditEntityName(e.target.value)}
                      placeholder="e.g. FC Barcelona"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </Field>

                  <Field label="Published date">
                    <input
                      type="datetime-local"
                      value={editPublishedAt}
                      onChange={(e) => setEditPublishedAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: editPublishedAt ? "var(--text-primary)" : "var(--text-muted)" }}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Platform">
                      <select
                        value={editPlatformId}
                        onChange={(e) => setEditPlatformId(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg text-xs outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">—</option>
                        {taxOptions.platforms.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Format">
                      <select
                        value={editContentFormatId}
                        onChange={(e) => setEditContentFormatId(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg text-xs outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">—</option>
                        {taxOptions.formats.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Sport">
                      <select
                        value={editSportId}
                        onChange={(e) => setEditSportId(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg text-xs outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">—</option>
                        {taxOptions.sports.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Entity type">
                      <select
                        value={editEntityTypeId}
                        onChange={(e) => setEditEntityTypeId(e.target.value)}
                        className="w-full px-2 py-2 rounded-lg text-xs outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">—</option>
                        {taxOptions.entities.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <ChipsField
                    label="Competitions"
                    options={taxOptions.competitions ?? []}
                    selected={editCompetitionIds}
                    onToggle={(id) => toggleId(editCompetitionIds, setEditCompetitionIds, id)}
                  />

                  <ChipsField
                    label="Classifications"
                    options={taxOptions.classifications ?? []}
                    selected={editClassificationIds}
                    onToggle={(id) => toggleId(editClassificationIds, setEditClassificationIds, id)}
                  />

                  <ChipsField
                    label="Content categories"
                    options={taxOptions.contentCategories ?? []}
                    selected={editContentCategoryIds}
                    onToggle={(id) => toggleId(editContentCategoryIds, setEditContentCategoryIds, id)}
                    alwaysShowDropdown
                  />

                  <Field label="External ID">
                    <div
                      className="px-3 py-2 rounded-lg text-xs font-mono select-all"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                    >
                      {pub.externalPostId}
                    </div>
                  </Field>

                  <Field label="URL">
                    <div
                      className="px-3 py-2 rounded-lg text-xs font-mono break-all"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                    >
                      {pub.canonicalUrl}
                    </div>
                  </Field>
                </div>
              </div>

              {/* CENTER: embed preview */}
              <div
                className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-8 gap-6"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div style={{ width: "100%", maxWidth: 560 }}>
                  <EmbedPreview pub={pub} />
                </div>

                <div
                  className="w-full rounded-xl p-4 space-y-2"
                  style={{ maxWidth: 560, background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
                >
                  {pub.accountUsername && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span>@{pub.accountUsername}</span>
                    </div>
                  )}
                  {pub.publishedAt && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span>{new Date(pub.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                  )}
                  {pub.sport && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      <span>{pub.sport}{pub.entity ? ` · ${pub.entity}` : ""}{pub.entityName ? ` · ${pub.entityName}` : ""}</span>
                    </div>
                  )}
                  {pub.format && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                      <span>{pub.format}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteOpen(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-sm rounded-2xl p-6"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                style={{ background: "rgba(239,68,68,0.12)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>

              <h2 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                Eliminar contingut
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                Aquesta acció és irreversible. Escriu{" "}
                <span className="font-mono font-bold" style={{ color: "#ef4444" }}>DELETE</span>{" "}
                per confirmar.
              </p>

              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Escriu DELETE"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none mb-4"
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid ${deleteInput === "DELETE" ? "#ef4444" : "var(--border-color)"}`,
                  color: "var(--text-primary)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteInput === "DELETE") handleDelete();
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  Cancel·lar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteInput !== "DELETE" || deleting}
                  className="flex-1 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  {deleting ? "Eliminant…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ChipsField({
  label,
  options = [],
  selected = [],
  onToggle,
  alwaysShowDropdown = false,
}: {
  label: string;
  options?: TaxOption[];
  selected?: string[];
  onToggle: (id: string) => void;
  alwaysShowDropdown?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const selectedOptions = options.filter((o) => selected.includes(o.id));
  const q = query.toLowerCase().trim();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options;

  const showDropdown = alwaysShowDropdown ? focused : (focused && q.length > 0);

  return (
    <Field label={label}>
      {options.length === 0 ? (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>None available</span>
      ) : (
        <div className="space-y-1.5">
          {/* Selected chips */}
          {selectedOptions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onToggle(o.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: "var(--color-charcoal-subtle)",
                    color: "var(--color-charcoal)",
                    border: "1px solid rgba(var(--color-charcoal-rgb, 31,41,55), 0.5)",
                  }}
                >
                  {o.name}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            >
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none"
              style={{
                background: "var(--bg-input)",
                border: `1px solid ${focused ? "var(--color-charcoal)" : "var(--border-color)"}`,
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Dropdown results */}
          {showDropdown && (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-color)", background: "var(--bg-secondary)", maxHeight: 160, overflowY: "auto" }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No results</div>
              ) : (
                filtered.map((o) => {
                  const active = selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onToggle(o.id); if (!alwaysShowDropdown) setQuery(""); }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors"
                      style={{ color: active ? "var(--color-charcoal)" : "var(--text-primary)" }}
                    >
                      <span>{o.name}</span>
                      {active && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#010101",
  instagram: "#833ab4",
  youtube: "#ff0000",
  twitter: "#1da1f2",
  x: "#1da1f2",
  facebook: "#1877f2",
  linkedin: "#0a66c2",
};

const QUICK_CLASSIFICATIONS = [
  { slug: "top-picks",        label: "Top Picks",      shortLabel: "Top",       solidColor: "#E8567A", gradient: "linear-gradient(135deg, #E8567A 0%, #A82346 100%)" },
  { slug: "replicable-ideas", label: "Replicable",     shortLabel: "Replica",   solidColor: "#52D68A", gradient: "linear-gradient(135deg, #52D68A 0%, #1B8A4E 100%)" },
  { slug: "overperforming",   label: "Overperforming", shortLabel: "Overperf.", solidColor: "#3B82F6", gradient: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)" },
];

function AdminCardEmbed({ pub }: { pub: Publication }) {
  const platform = pub.platform.toLowerCase();
  if (platform === "youtube") return <YouTubeEmbed videoId={pub.externalPostId} embedUrl={pub.embedUrl} />;
  if (platform === "tiktok") return <div style={{ display: "flex", justifyContent: "center", background: "#000" }}><TikTokEmbed videoId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} /></div>;
  if (platform === "instagram") { const src = pub.canonicalUrl.replace(/\/$/, "") + "/embed"; return <iframe src={src} style={{ width: "100%", height: 480, border: "none" }} scrolling="no" allowFullScreen />; }
  if (platform === "twitter" || platform === "x") return <AdminTwitterEmbed tweetId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} />;
  if (platform === "linkedin") return <AdminLinkedInEmbed originalUrl={pub.originalUrl || pub.canonicalUrl} canonicalUrl={pub.canonicalUrl} />;
  if (platform === "facebook") return <AdminFacebookEmbed originalUrl={pub.originalUrl || pub.canonicalUrl} canonicalUrl={pub.canonicalUrl} />;
  return null;
}

function QuickClassRow({ pub, classOptions }: { pub: Publication; classOptions: TaxOption[] }) {
  const [classIds, setClassIds] = useState<string[]>(pub.classificationIds ?? []);
  const [classSlugs, setClassSlugs] = useState<string[]>(pub.classificationSlugs ?? []);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggle(slug: string) {
    const opt = classOptions.find((o) => o.slug === slug);
    if (!opt) return;
    setToggling(slug);
    const isActive = classSlugs.includes(slug);
    const newIds = isActive ? classIds.filter((id) => id !== opt.id) : [...classIds, opt.id];
    const newSlugs = isActive ? classSlugs.filter((s) => s !== slug) : [...classSlugs, slug];
    try {
      const res = await fetch(`/api/admin/publications?id=${pub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationIds: newIds }),
      });
      if (res.ok) { setClassIds(newIds); setClassSlugs(newSlugs); }
    } finally { setToggling(null); }
  }

  return (
    <div className="flex items-center gap-1">
      {QUICK_CLASSIFICATIONS.map((qc) => {
        const active = classSlugs.includes(qc.slug);
        const busy = toggling === qc.slug;
        return (
          <button
            key={qc.slug}
            disabled={busy}
            onClick={() => toggle(qc.slug)}
            title={active ? `Treure "${qc.label}"` : `Afegir "${qc.label}"`}
            className="flex items-center justify-center rounded-md transition-all disabled:opacity-40 active:scale-95"
            style={{
              width: 26, height: 22,
              background: active ? qc.gradient : "transparent",
              border: `1.5px solid ${active ? "transparent" : qc.solidColor + "55"}`,
            }}
          >
            {busy ? (
              <span style={{ fontSize: 8, color: qc.solidColor }}>···</span>
            ) : active ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={qc.solidColor} strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

function AdminCard({ pub, onOpen, classOptions, isSelected = false, onSelect, onDelete }: {
  pub: Publication;
  onOpen: () => void;
  classOptions: TaxOption[];
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const platformColor = PLATFORM_COLORS[pub.platform.toLowerCase()] ?? "#555";
  const [classIds, setClassIds] = useState<string[]>(pub.classificationIds ?? []);
  const [classSlugs, setClassSlugs] = useState<string[]>(pub.classificationSlugs ?? []);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/publications?id=${pub.id}`, { method: "DELETE" });
      if (res.ok) onDelete?.(pub.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function toggleClassification(slug: string) {
    const opt = classOptions.find((o) => o.slug === slug);
    if (!opt) return;
    setToggling(slug);
    const isActive = classSlugs.includes(slug);
    const newIds = isActive ? classIds.filter((id) => id !== opt.id) : [...classIds, opt.id];
    const newSlugs = isActive ? classSlugs.filter((s) => s !== slug) : [...classSlugs, slug];
    try {
      const res = await fetch(`/api/admin/publications?id=${pub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationIds: newIds }),
      });
      if (res.ok) { setClassIds(newIds); setClassSlugs(newSlugs); }
    } finally {
      setToggling(null);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:shadow-lg"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isSelected ? platformColor + "66" : "var(--border-color)"}`,
        boxShadow: isSelected ? `0 0 0 2px ${platformColor}22` : undefined,
      }}
    >
      {/* Platform color bar + icon */}
      <div
        onClick={onOpen}
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ background: platformColor + "22", borderBottom: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center gap-2">
          {/* Checkbox for bulk selection */}
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect?.(pub.id)}
              className="rounded cursor-pointer"
              style={{ width: 13, height: 13, accentColor: platformColor }}
            />
          </div>
          <PlatformIcon platform={pub.platform} size={13} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{pub.platform}</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {pub.publishedAt && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {new Date(pub.publishedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
            </span>
          )}
          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={confirmDelete ? "Clica per confirmar l'eliminació" : "Eliminar"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: confirmDelete ? "2px 6px" : "2px 4px",
              borderRadius: 6,
              border: "none",
              cursor: deleting ? "not-allowed" : "pointer",
              fontSize: 10,
              fontWeight: 700,
              transition: "all 0.15s",
              background: confirmDelete ? "#EF4444" : "transparent",
              color: confirmDelete ? "#fff" : "var(--text-muted)",
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {deleting ? (
              <span style={{ letterSpacing: 2 }}>···</span>
            ) : confirmDelete ? (
              <>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Eliminar
              </>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            )}
          </button>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
      </div>

      {/* Embed */}
      <div onClick={onOpen} className="cursor-pointer" style={{ background: "var(--bg-input)" }}>
        <AdminCardEmbed pub={pub} />
      </div>

      {/* Title + tags */}
      <div onClick={onOpen} className="px-3 pt-2 pb-2 cursor-pointer">
        <p
          className="text-xs font-medium leading-snug mb-2"
          style={{
            color: "var(--text-primary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {pub.rawTitle ?? pub.entityName ?? pub.externalPostId}
        </p>
        <div className="flex flex-wrap gap-1">
          {pub.sport && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>
              {pub.sport}
            </span>
          )}
          {pub.entity && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
              {pub.entity}
            </span>
          )}
          {pub.format && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
              {pub.format}
            </span>
          )}
          {/* Active classification badges */}
          {QUICK_CLASSIFICATIONS.filter((qc) => classSlugs.includes(qc.slug)).map((qc) => (
            <span
              key={qc.slug}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: qc.gradient, color: "#fff" }}
            >
              {qc.label}
            </span>
          ))}
          {/* Other classifications not in the quick set */}
          {classSlugs
            .filter((s) => !QUICK_CLASSIFICATIONS.some((qc) => qc.slug === s))
            .map((s) => {
              const opt = classOptions.find((o) => o.slug === s);
              return (
                <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>
                  {opt?.name ?? s}
                </span>
              );
            })}
        </div>
      </div>

      {/* Quick classification toggle buttons */}
      <div className="flex gap-1.5 px-3 pb-3" onClick={(e) => e.stopPropagation()}>
        {QUICK_CLASSIFICATIONS.map((qc) => {
          const active = classSlugs.includes(qc.slug);
          const busy = toggling === qc.slug;
          return (
            <button
              key={qc.slug}
              disabled={busy}
              onClick={() => toggleClassification(qc.slug)}
              title={active ? `Treure "${qc.label}"` : `Afegir "${qc.label}"`}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 active:scale-95"
              style={{
                background: active ? qc.gradient : "transparent",
                color: active ? "#fff" : qc.solidColor,
                border: `1.5px solid ${active ? "transparent" : qc.solidColor + "55"}`,
              }}
            >
              {busy ? (
                <span style={{ letterSpacing: 2 }}>···</span>
              ) : active ? (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {qc.shortLabel}
                </>
              ) : (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {qc.shortLabel}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Add by URL modal ── */
interface ScrapedData {
  platform: string; externalPostId: string; canonicalUrl: string;
  embedUrl: string; originalUrl: string; format: string | null;
  title: string | null; accountUsername: string | null;
}

/* Searchable competitions picker with create-new */
function CompetitionsPicker({
  options: initialOptions, value, onChange,
}: { options: TaxOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [localOpts, setLocalOpts] = useState<TaxOption[]>(initialOptions);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { setLocalOpts(initialOptions); }, [initialOptions]);

  const selectedOptions = localOpts.filter((o) => value.includes(o.id));
  const q = query.toLowerCase();
  const visible = q ? localOpts.filter((o) => o.name.toLowerCase().includes(q)) : localOpts;
  const exactMatch = localOpts.some((o) => o.name.toLowerCase() === q);
  const canCreate = q.length >= 1 && !exactMatch;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "competition", name }),
      });
      const data = await res.json();
      if (data.id) {
        const newOpt: TaxOption = { id: data.id, name: data.name, slug: data.slug };
        setLocalOpts((prev) => [...prev, newOpt]);
        onChange([...value, data.id]);
        setQuery("");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedOptions.map((o) => (
            <button key={o.id} type="button" onClick={() => toggle(o.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)", border: "1px solid rgba(var(--color-charcoal-rgb, 31,41,55), 0.5)" }}>
              {o.name}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search or create competition…"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--bg-input)", border: `1px solid ${open ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
        />
        {open && (visible.length > 0 || canCreate) && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden overflow-y-auto"
            style={{ maxHeight: 220, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {visible.map((o) => {
              const active = value.includes(o.id);
              return (
                <button key={o.id} type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { toggle(o.id); setQuery(""); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/5"
                  style={{ color: active ? "var(--color-charcoal)" : "var(--text-primary)" }}>
                  {o.name}
                  {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              );
            })}
            {canCreate && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleCreate} disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 disabled:opacity-50"
                style={{ borderTop: visible.length > 0 ? "1px solid var(--border-color)" : "none", color: "var(--color-charcoal)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {creating ? "Creating…" : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Username autocomplete */
function UsernameAutocomplete({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/publications?distinctUsernames=1")
      .then((r) => r.json())
      .then((d) => {
        const raw: string[] = d.usernames ?? [];
        const split = [...new Set(
          raw.flatMap((u: string) => u.split(",").map((s) => s.trim())).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        setAllUsernames(split);
      });
  }, []);

  const q = value.toLowerCase().replace(/^@/, "");
  const suggestions = q
    ? allUsernames.filter((u) => u.toLowerCase().includes(q))
    : allUsernames.slice(0, 30);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="@username"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "var(--bg-input)", border: `1px solid ${open ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden overflow-y-auto"
          style={{ maxHeight: 200, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {suggestions.map((u) => (
            <button key={u} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(u); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5"
              style={{ color: value === u ? "var(--color-charcoal)" : "var(--text-primary)" }}>
              <span style={{ color: "var(--text-muted)" }}>@</span>{u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Generic searchable + creatable taxonomy combobox */
function TaxCombobox({
  value, options: initialOptions, onChange, category, required = false, placeholder,
}: {
  value: string;
  options: TaxOption[];
  onChange: (id: string) => void;
  category: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [localOpts, setLocalOpts] = useState<TaxOption[]>(initialOptions);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalOpts(initialOptions); }, [initialOptions]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedName = localOpts.find((o) => o.id === value)?.name ?? "";
  const q = query.toLowerCase().trim();
  const filtered = q ? localOpts.filter((o) => o.name.toLowerCase().includes(q)) : localOpts;
  const exactMatch = localOpts.some((o) => o.name.toLowerCase() === q);
  const canCreate = q.length >= 1 && !exactMatch;

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name }),
      });
      const data = await res.json();
      if (data.id) {
        setLocalOpts((prev) => [...prev, { id: data.id, name: data.name, slug: data.slug }]);
        onChange(data.id);
        setQuery("");
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? query : selectedName}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        placeholder={placeholder ?? "Search or create…"}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          background: "var(--bg-input)",
          border: `1px solid ${required && !value ? "#ef4444" : open ? "var(--color-charcoal)" : "var(--border-color)"}`,
          color: "var(--text-primary)",
          paddingRight: value && !open ? "2rem" : undefined,
        }}
      />
      {value && !open && (
        <button type="button" onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", maxHeight: 220, overflowY: "auto" }}>
          {filtered.map((o) => (
            <button key={o.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o.id); setQuery(""); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/5"
              style={{ color: o.id === value ? "var(--color-charcoal)" : "var(--text-primary)" }}>
              <span>{o.name}</span>
              {o.id === value && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
          {canCreate && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleCreate} disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 disabled:opacity-50"
              style={{ borderTop: filtered.length > 0 ? "1px solid var(--border-color)" : "none", color: "var(--color-charcoal)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {creating ? "Creating…" : `Create "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* Club / entity name with autocomplete from existing names */
function EntityNameCombobox({
  value, onChange, existingNames,
}: { value: string; onChange: (v: string) => void; existingNames: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = value.toLowerCase().trim();
  const suggestions = q
    ? existingNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 10)
    : [];

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. FC Barcelona"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          background: "var(--bg-input)",
          border: `1px solid ${open && suggestions.length > 0 ? "var(--color-charcoal)" : "var(--border-color)"}`,
          color: "var(--text-primary)",
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map((name) => (
            <button key={name} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(name); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
              style={{ color: name === value ? "var(--color-charcoal)" : "var(--text-primary)" }}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddByUrlModal({
  onClose, taxOptions, onSaved, clubNames,
}: {
  onClose: () => void;
  onSaved: () => void;
  clubNames: string[];
  taxOptions: {
    sports: TaxOption[]; entities: TaxOption[]; formats: TaxOption[];
    platforms: TaxOption[]; competitions: TaxOption[];
    classifications: TaxOption[]; contentCategories: TaxOption[];
  };
}) {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [scraped, setScraped] = useState<ScrapedData | null>(null);

  const [rawTitle, setRawTitle] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [entityName, setEntityName] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [contentFormatId, setContentFormatId] = useState("");
  const [sportId, setSportId] = useState("");
  const [entityTypeId, setEntityTypeId] = useState("");
  const [competitionIds, setCompetitionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleExtract() {
    if (!url.trim()) return;
    setExtracting(true);
    setExtractError("");
    setScraped(null);
    try {
      const res = await fetch("/api/admin/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setExtractError(data.error || "Error extracting URL"); return; }
      setScraped(data);
      setRawTitle(data.title ?? "");
      setAccountUsername(data.accountUsername ?? "");
      const matchedPlatform = taxOptions.platforms.find(
        (p) => p.name.toLowerCase() === data.platform.toLowerCase()
      );
      if (matchedPlatform) setPlatformId(matchedPlatform.id);
      if (data.format) {
        const matchedFormat = taxOptions.formats.find(
          (f) => f.name.toLowerCase() === data.format!.toLowerCase()
        );
        if (matchedFormat) setContentFormatId(matchedFormat.id);
      }
    } catch {
      setExtractError("Network error — please try again");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!scraped || !platformId) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalPostId: scraped.externalPostId,
          canonicalUrl: scraped.canonicalUrl,
          embedUrl: scraped.embedUrl,
          originalUrl: scraped.originalUrl,
          platformId,
          sportId: sportId || null,
          entityTypeId: entityTypeId || null,
          contentFormatId: contentFormatId || null,
          entityName: entityName || null,
          accountUsername: accountUsername || null,
          rawTitle: rawTitle || null,
          publishedAt: publishedAt || null,
          competitionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || "Error saving"); return; }
      onSaved();
      onClose();
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const PLATFORM_COLORS_MAP: Record<string, string> = {
    x: "#1da1f2", twitter: "#1da1f2", instagram: "#833ab4",
    youtube: "#ff0000", tiktok: "#010101", facebook: "#1877f2", linkedin: "#0a66c2",
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col overflow-hidden w-full"
          style={{ maxWidth: 860, maxHeight: "90vh", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Add content by URL</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Paste a post URL — we'll extract the metadata automatically</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:opacity-70" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {/* URL input */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Post URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setExtractError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleExtract(); }}
                  placeholder="https://x.com/user/status/... or https://www.instagram.com/p/..."
                  autoFocus
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: `1px solid ${extractError ? "#ef4444" : "var(--border-color)"}`, color: "var(--text-primary)" }}
                />
                <button
                  onClick={handleExtract}
                  disabled={extracting || !url.trim()}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 shrink-0"
                  style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
                >
                  {extracting ? "Extracting…" : "Extract"}
                </button>
              </div>
              {extractError && <p className="text-xs mt-1.5" style={{ color: "#ef4444" }}>{extractError}</p>}
            </div>

            {scraped && (
              <>
                {/* Platform badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: (PLATFORM_COLORS_MAP[scraped.platform.toLowerCase()] ?? "#555") + "20", border: `1px solid ${PLATFORM_COLORS_MAP[scraped.platform.toLowerCase()] ?? "#555"}40` }}>
                  <span className="text-xs font-bold" style={{ color: PLATFORM_COLORS_MAP[scraped.platform.toLowerCase()] ?? "var(--text-primary)" }}>
                    {scraped.platform}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{scraped.externalPostId}</span>
                  <a href={scraped.canonicalUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
                    View ↗
                  </a>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Title / Caption</label>
                    <textarea
                      value={rawTitle}
                      onChange={(e) => setRawTitle(e.target.value)}
                      rows={3}
                      placeholder="Post caption or title..."
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Account username</label>
                    <UsernameAutocomplete value={accountUsername} onChange={setAccountUsername} />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Club / Entity name</label>
                    <EntityNameCombobox value={entityName} onChange={setEntityName} existingNames={clubNames} />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Published date</label>
                    <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: publishedAt ? "var(--text-primary)" : "var(--text-muted)" }} />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                      Platform <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <TaxCombobox value={platformId} options={taxOptions.platforms} onChange={setPlatformId} category="platform" required placeholder="Search or create platform…" />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Format</label>
                    <TaxCombobox value={contentFormatId} options={taxOptions.formats} onChange={setContentFormatId} category="format" placeholder="Search or create format…" />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Sport</label>
                    <TaxCombobox value={sportId} options={taxOptions.sports} onChange={setSportId} category="sport" placeholder="Search or create sport…" />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Entity type</label>
                    <TaxCombobox value={entityTypeId} options={taxOptions.entities} onChange={setEntityTypeId} category="entity" placeholder="Search or create entity type…" />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>Competitions</label>
                    <CompetitionsPicker
                      options={taxOptions.competitions}
                      value={competitionIds}
                      onChange={setCompetitionIds}
                    />
                  </div>
                </div>

                {saveError && <p className="text-xs" style={{ color: "#ef4444" }}>{saveError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving || !platformId}
                    className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                    style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
                    {saving ? "Saving…" : "Save content"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function ContentIdeasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => {
    const f = searchParams.get("filter");
    if (f === "new") {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      return { ...EMPTY, createdAfter: yesterday };
    }
    if (f === "incomplete") return { ...EMPTY, incompleteOnly: true };
    return EMPTY;
  });
  const [pending, setPending] = useState<Filters>(filters);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [showFilters, setShowFilters] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // URL-synced review panel
  const reviewId = searchParams.get("review");
  function openReview(id: string) {
    try { sessionStorage.setItem("ci-scroll", String(window.scrollY)); } catch {}
    const p = new URLSearchParams(searchParams.toString());
    p.set("review", id);
    router.replace(`?${p.toString()}`, { scroll: false });
  }
  function closeReview() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("review");
    router.replace(`?${p.toString()}`, { scroll: false });
    try {
      const y = parseInt(sessionStorage.getItem("ci-scroll") ?? "0");
      setTimeout(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), 50);
    } catch {}
  }
  function navigateReview(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("review", id);
    router.replace(`?${p.toString()}`, { scroll: false });
  }
  const reviewIdx = reviewId ? pubs.findIndex(p => p.id === reviewId) : -1;
  const prevReviewId = reviewIdx > 0 ? pubs[reviewIdx - 1].id : null;
  const nextReviewId = reviewIdx >= 0 && reviewIdx < pubs.length - 1 ? pubs[reviewIdx + 1].id : null;
  const [showAddByUrl, setShowAddByUrl] = useState(false);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sport: true, platform: true, published: true, externalId: false,
    account: false, entity: false, format: false, tags: true,
  });
  function toggleColumn(key: string) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  const TABLE_COLS = [
    { key: "sport", label: "Esport" }, { key: "platform", label: "Plataforma" },
    { key: "published", label: "Data publicació" }, { key: "externalId", label: "ID Extern" },
    { key: "account", label: "@Compte" }, { key: "entity", label: "Entitat" },
    { key: "format", label: "Format" }, { key: "tags", label: "Etiquetes" },
  ];

  // Tax options for filters (slug-based)
  const [sportOpts, setSportOpts] = useState<FilterOption[]>([]);
  const [entityOpts, setEntityOpts] = useState<FilterOption[]>([]);
  const [compOpts, setCompOpts] = useState<FilterOption[]>([]);
  const [platformOpts, setPlatformOpts] = useState<FilterOption[]>([]);
  const [formatOpts, setFormatOpts] = useState<FilterOption[]>([]);
  const [clubOpts, setClubOpts] = useState<FilterOption[]>([]);

  // Tax options for drawer (id-based)
  const [taxForDrawer, setTaxForDrawer] = useState<{
    sports: TaxOption[]; entities: TaxOption[]; formats: TaxOption[];
    platforms: TaxOption[]; competitions: TaxOption[];
    classifications: TaxOption[]; contentCategories: TaxOption[];
  }>({ sports: [], entities: [], formats: [], platforms: [], competitions: [], classifications: [], contentCategories: [] });

  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const scrollLastY = useRef(0);

  useEffect(() => {
    async function loadOpts() {
      const res = await fetch("/api/admin/filters");
      const data = await res.json();
      const drawerOpts: typeof taxForDrawer = { sports: [], entities: [], formats: [], platforms: [], competitions: [], classifications: [], contentCategories: [] };

      for (const cat of data.categories ?? []) {
        const r = await fetch(`/api/admin/filters?category=${cat.key}`);
        const d = await r.json();
        const opts = (d.values ?? []).map((v: { id?: string; name: string; slug?: string; count?: number }) => ({
          id: v.id ?? v.slug ?? v.name,
          name: v.name,
          slug: v.slug ?? v.name,
          count: v.count,
        }));

        if (cat.key === "sport") { setSportOpts(opts); drawerOpts.sports = opts; }
        else if (cat.key === "entity") { setEntityOpts(opts); drawerOpts.entities = opts; }
        else if (cat.key === "competition") { setCompOpts(opts); drawerOpts.competitions = opts; }
        else if (cat.key === "platform") { setPlatformOpts(opts); drawerOpts.platforms = opts; }
        else if (cat.key === "format") { setFormatOpts(opts); drawerOpts.formats = opts; }
        else if (cat.key === "club") setClubOpts(opts);
        else if (cat.key === "classification") {
          // Fetch ALL classifications (not just those with publications) so quick-toggle buttons work
          const rAll = await fetch("/api/admin/filters?category=classification&all=true");
          const dAll = await rAll.json();
          drawerOpts.classifications = (dAll.values ?? []).map((v: { id: string; name: string; slug: string }) => ({
            id: v.id, name: v.name, slug: v.slug,
          }));
        }
        else if (cat.key === "contentCategory") drawerOpts.contentCategories = opts;
      }
      setTaxForDrawer(drawerOpts);
    }
    loadOpts();
  }, []);

  const fetchPubs = useCallback(async (f: Filters, p: number, mode: "replace" | "append" = "replace") => {
    if (mode === "replace") setLoading(true);
    else setLoadingMore(true);
    const params = new URLSearchParams({ page: String(p), limit: "100" });
    if (f.sport) params.set("sport", f.sport);
    if (f.entity) params.set("entity", f.entity);
    if (f.competition) params.set("competition", f.competition);
    if (f.club) params.set("club", f.club);
    if (f.format) params.set("format", f.format);
    if (f.platform) params.set("platform", f.platform);
    if (f.search) params.set("search", f.search);
    if (f.externalId) params.set("externalId", f.externalId);
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);
    if (f.incompleteOnly) params.set("incomplete", "1");
    if (f.createdAfter) params.set("createdAfter", f.createdAfter);

    try {
      const res = await fetch(`/api/admin/publications?${params}`);
      const data = await res.json();
      if (mode === "append") {
        setPubs((prev) => [...prev, ...(data.publications ?? [])]);
      } else {
        setPubs(data.publications ?? []);
      }
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { setPage(1); fetchPubs(filters, 1); }, [filters, fetchPubs]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPubs(filters, nextPage, "append");
  }

  function applyFilters() {
    setFilters(pending);
    setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    setPending(EMPTY);
    setFilters(EMPTY);
    setPage(1);
    setSelected(new Set());
  }

  function setPendingField(key: keyof Filters, val: string) {
    const next = { ...pending, [key]: val };
    setPending(next);
    if (["sport", "entity", "competition", "club", "format", "platform", "dateFrom", "dateTo"].includes(key)) {
      setFilters(next);
      setPage(1);
    }
  }

  function onSearchInput(val: string) {
    setPending((p) => ({ ...p, search: val }));
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val }));
      setPage(1);
    }, 400);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setAllMatchingSelected(false);
    if (selected.size === pubs.length) setSelected(new Set());
    else setSelected(new Set(pubs.map((p) => p.id)));
  }

  async function selectAllMatching() {
    const params = new URLSearchParams({ page: "1", limit: "999999" });
    if (filters.sport) params.set("sport", filters.sport);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.competition) params.set("competition", filters.competition);
    if (filters.club) params.set("club", filters.club);
    if (filters.format) params.set("format", filters.format);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.search) params.set("search", filters.search);
    if (filters.externalId) params.set("externalId", filters.externalId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.incompleteOnly) params.set("incomplete", "1");
    const res = await fetch(`/api/admin/publications?${params}`);
    const data = await res.json();
    setSelected(new Set((data.publications ?? []).map((p: Publication) => p.id)));
    setAllMatchingSelected(true);
  }


  const hasActiveFilter = Object.values(filters).some(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("ca-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  async function exportCSV() {
    const params = new URLSearchParams({ page: "1", limit: "999999" });
    if (filters.sport) params.set("sport", filters.sport);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.competition) params.set("competition", filters.competition);
    if (filters.club) params.set("club", filters.club);
    if (filters.format) params.set("format", filters.format);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.search) params.set("search", filters.search);
    if (filters.externalId) params.set("externalId", filters.externalId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.incompleteOnly) params.set("incomplete", "1");

    const res = await fetch(`/api/admin/publications?${params}`);
    const data = await res.json();
    const rows = data.publications ?? [];
    const headers = ["ID", "Title", "Published", "Sport", "Entity", "Platform", "Format", "URL"];
    const csv = [
      headers.join(","),
      ...rows.map((p: Publication) =>
        [p.externalPostId, `"${(p.rawTitle || "").replace(/"/g, '""')}"`, p.publishedAt ?? "", p.sport ?? "", p.entity ?? "", p.platform, p.format ?? "", p.canonicalUrl].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "content-ideas.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="px-4 md:px-8 pt-4 md:pt-7 pb-3 md:pb-4 shrink-0">
        {/* Mobile header row */}
        <div className="flex items-center justify-between gap-2 md:hidden mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--text-primary)" }}>Content</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>~{total.toLocaleString()} resultats</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile filter button */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: hasActiveFilter ? "var(--color-charcoal)" : "var(--bg-input)", color: hasActiveFilter ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filtres
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black" style={{ background: "#F5C542", color: "#0D1421" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            {/* Mobile add button */}
            <button
              onClick={() => setShowAddByUrl(true)}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: "var(--selected-bg)", color: "var(--selected-text)", flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile search bar — always visible */}
        <div className="relative md:hidden mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={pending.search}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Cerca per títol..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--bg-input)", border: `1px solid ${pending.search ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
          />
          {pending.search && (
            <button
              onClick={() => onSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Mobile quick filter chips */}
        <div className="flex items-center gap-2 mb-1 md:hidden overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => {
              const next = { ...pending, incompleteOnly: !pending.incompleteOnly };
              setPending(next); setFilters(next); setPage(1);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
            style={{
              background: pending.incompleteOnly ? "rgba(245,158,11,0.15)" : "var(--bg-input)",
              color: pending.incompleteOnly ? "#f59e0b" : "var(--text-muted)",
              border: `1px solid ${pending.incompleteOnly ? "rgba(245,158,11,0.4)" : "var(--border-color)"}`,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Incomplets
          </button>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Netejar
            </button>
          )}
        </div>

        {/* Desktop header row */}
        <div className="hidden md:flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Content Ideas</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              ~{total.toLocaleString()} resultats
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Collapse filters toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              title={showFilters ? "Amagar filtres" : "Mostrar filtres"}
              className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{ width: 34, height: 34, background: showFilters ? "var(--color-charcoal)" : "var(--bg-input)", color: showFilters ? "#fff" : "var(--text-muted)", border: "1px solid var(--border-color)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {showFilters
                  ? <path d="M18 15l-6-6-6 6"/>
                  : <path d="M6 9l6 6 6-6"/>}
              </svg>
            </button>
            {/* View mode toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className="flex items-center justify-center px-2.5 py-2 transition-all"
                style={{ background: viewMode === "list" ? "var(--color-charcoal)" : "var(--bg-input)", color: viewMode === "list" ? "#fff" : "var(--text-muted)", borderRight: "1px solid var(--border-color)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className="flex items-center justify-center px-2.5 py-2 transition-all"
                style={{ background: viewMode === "grid" ? "var(--color-charcoal)" : "var(--bg-input)", color: viewMode === "grid" ? "#fff" : "var(--text-muted)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </button>
            </div>
            {/* Columns toggle */}
            <div className="relative">
              <button
                onClick={() => setShowColumnsMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: showColumnsMenu ? "var(--color-charcoal,#D4A420)" : "var(--bg-input)", color: showColumnsMenu ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8M12 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-8M12 3v18"/>
                  <path d="M9 7H6m3 4H6m3 4H6"/>
                </svg>
                Columnes
              </button>
              {showColumnsMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowColumnsMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 rounded-xl py-2 w-52 shadow-2xl"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Columnes de la taula</p>
                    {TABLE_COLS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                        <input type="checkbox" checked={!!visibleColumns[key]} onChange={() => toggleColumn(key)}
                          className="rounded w-3.5 h-3.5" />
                        <span className="text-xs" style={{ color: "var(--text-primary)" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowAddByUrl(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add by URL
            </button>
            <button
              onClick={exportCSV}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Desktop quick filters + collapsible filter rows */}
        <div className="hidden md:block">
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                const next = { ...pending, incompleteOnly: !pending.incompleteOnly };
                setPending(next);
                setFilters(next);
                setPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: pending.incompleteOnly ? "rgba(245,158,11,0.15)" : "var(--bg-input)",
                color: pending.incompleteOnly ? "#f59e0b" : "var(--text-muted)",
                border: `1px solid ${pending.incompleteOnly ? "rgba(245,158,11,0.4)" : "var(--border-color)"}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Informació incompleta
            </button>
          </div>
          {showFilters && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-3 md:mt-4">
                <FilterSelect label="Sport" value={pending.sport} options={sportOpts} onChange={(v) => setPendingField("sport", v)} multi />
                <FilterSelect label="Entity" value={pending.entity} options={entityOpts} onChange={(v) => setPendingField("entity", v)} multi />
                <FilterSelect label="Competition" value={pending.competition} options={compOpts} onChange={(v) => setPendingField("competition", v)} multi />
                <FilterSelect label="Club" value={pending.club} options={clubOpts} onChange={(v) => setPendingField("club", v)} multi />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-2 md:mt-3">
                <FilterSelect label="Format" value={pending.format} options={formatOpts} onChange={(v) => setPendingField("format", v)} multi />
                <FilterSelect label="Platform" value={pending.platform} options={platformOpts} onChange={(v) => setPendingField("platform", v)} multi />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Search</div>
                  <input type="text" value={pending.search} onChange={(e) => onSearchInput(e.target.value)} placeholder="Search by title..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-input)", border: `1px solid ${pending.search ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>External ID</div>
                  <input type="text" value={pending.externalId} onChange={(e) => { setPendingField("externalId", e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }} placeholder="Filter by ID..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-input)", border: `1px solid ${pending.externalId ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="mt-3">
                <AdminDateRangePicker
                  from={pending.dateFrom}
                  to={pending.dateTo}
                  onChange={(from, to) => {
                    const next = { ...pending, dateFrom: from, dateTo: to };
                    setPending(next);
                    setFilters(next);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {showMobileFilters && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--bg-card)", maxHeight: "85dvh", border: "1px solid var(--border-color)" }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Filtres</span>
              <div className="flex items-center gap-2">
                {hasActiveFilter && (
                  <button
                    onClick={() => { clearFilters(); setShowMobileFilters(false); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                  >
                    Netejar tot
                  </button>
                )}
                <button onClick={() => setShowMobileFilters(false)} style={{ color: "var(--text-muted)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            {/* Sheet body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Incomplete toggle */}
              <button
                onClick={() => {
                  const next = { ...pending, incompleteOnly: !pending.incompleteOnly };
                  setPending(next); setFilters(next); setPage(1);
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: pending.incompleteOnly ? "rgba(245,158,11,0.12)" : "var(--bg-input)",
                  color: pending.incompleteOnly ? "#f59e0b" : "var(--text-primary)",
                  border: `1px solid ${pending.incompleteOnly ? "rgba(245,158,11,0.4)" : "var(--border-color)"}`,
                }}
              >
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Informació incompleta
                </span>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: pending.incompleteOnly ? "#f59e0b" : "var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {pending.incompleteOnly && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </button>
              <FilterSelect label="Sport" value={pending.sport} options={sportOpts} onChange={(v) => setPendingField("sport", v)} multi />
              <FilterSelect label="Platform" value={pending.platform} options={platformOpts} onChange={(v) => setPendingField("platform", v)} multi />
              <FilterSelect label="Entity" value={pending.entity} options={entityOpts} onChange={(v) => setPendingField("entity", v)} multi />
              <FilterSelect label="Competition" value={pending.competition} options={compOpts} onChange={(v) => setPendingField("competition", v)} multi />
              <FilterSelect label="Club" value={pending.club} options={clubOpts} onChange={(v) => setPendingField("club", v)} multi />
              <FilterSelect label="Format" value={pending.format} options={formatOpts} onChange={(v) => setPendingField("format", v)} multi />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>External ID</div>
                <input type="text" value={pending.externalId} onChange={(e) => setPendingField("externalId", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }} placeholder="Filter by ID..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: `1px solid ${pending.externalId ? "var(--color-charcoal)" : "var(--border-color)"}`, color: "var(--text-primary)" }} />
              </div>
              <AdminDateRangePicker
                from={pending.dateFrom}
                to={pending.dateTo}
                onChange={(from, to) => {
                  const next = { ...pending, dateFrom: from, dateTo: to };
                  setPending(next); setFilters(next); setPage(1);
                }}
              />
            </div>
            {/* Sheet footer CTA */}
            <div className="shrink-0 px-5 py-4" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
              >
                Veure {total.toLocaleString()} resultats
              </button>
            </div>
          </div>
        </>
      )}

      {/* Content: List or Grid */}
      <div
        className="flex-1 overflow-auto px-4 md:px-8 pb-4"
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop;
          const delta = y - scrollLastY.current;
          if (Math.abs(delta) > 4) {
            window.dispatchEvent(new CustomEvent("admin-nav-scroll", { detail: { down: delta > 0 && y > 60 } }));
            scrollLastY.current = y;
          }
        }}
      >
        {viewMode === "list" && (
          <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 680 }}>
            <thead className="sticky top-0 z-10" style={{ background: "var(--bg-primary)" }}>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th className="w-10 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === pubs.length && pubs.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>TÍTOL</th>
                {visibleColumns.externalId && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>ID</th>}
                {visibleColumns.published && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>PUBLICAT</th>}
                {visibleColumns.sport && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>ESPORT</th>}
                {visibleColumns.platform && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>PLATAFORMA</th>}
                {visibleColumns.account && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>@COMPTE</th>}
                {visibleColumns.entity && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>ENTITAT</th>}
                {visibleColumns.format && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>FORMAT</th>}
                {visibleColumns.tags && <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider pr-4" style={{ color: "var(--text-muted)" }}>ETIQUETES</th>}
                <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>ACCIONS</th>
              </tr>
              {selected.size > 0 && selected.size === pubs.length && pubs.length < total && !allMatchingSelected && (
                <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="py-2 text-center text-xs" style={{ background: "var(--color-charcoal-subtle)", color: "var(--text-primary)" }}>
                    {pubs.length} items d&apos;aquesta pàgina seleccionats.{" "}
                    <button onClick={selectAllMatching} className="font-semibold underline" style={{ color: "var(--color-charcoal)" }}>
                      Seleccionar els {total.toLocaleString()} resultats
                    </button>
                  </td>
                </tr>
              )}
              {allMatchingSelected && (
                <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="py-2 text-center text-xs" style={{ background: "var(--color-charcoal-subtle)", color: "var(--text-primary)" }}>
                    Tots els {selected.size.toLocaleString()} resultats seleccionats.{" "}
                    <button onClick={() => { setSelected(new Set()); setAllMatchingSelected(false); }} className="font-semibold underline" style={{ color: "var(--color-charcoal)" }}>
                      Desseleccionar tot
                    </button>
                  </td>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading...
                  </td>
                </tr>
              ) : pubs.length === 0 ? (
                <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No results
                  </td>
                </tr>
              ) : (
                pubs.map((pub) => (
                  <tr
                    key={pub.id}
                    onClick={() => openReview(pub.id)}
                    style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
                    className="transition-colors hover:bg-white/5"
                  >
                    <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(pub.id)} onChange={() => toggleSelect(pub.id)} />
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        <span className="block truncate text-sm" style={{ color: "var(--text-primary)" }} title={pub.rawTitle ?? pub.entityName ?? ""}>
                          {pub.rawTitle
                            ? (pub.rawTitle.length > 60 ? pub.rawTitle.slice(0, 60) + " ..." : pub.rawTitle)
                            : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </span>
                        {(!pub.sport || !pub.accountUsername || !pub.entityName) && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {!pub.sport && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Sense esport
                              </span>
                            )}
                            {!pub.accountUsername && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Sense compte
                              </span>
                            )}
                            {!pub.entityName && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Sense entitat
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    {visibleColumns.externalId && <td className="py-3 pr-4 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{pub.externalPostId}</td>}
                    {visibleColumns.published && <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(pub.publishedAt)}</td>}
                    {visibleColumns.sport && <td className="py-3 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>{pub.sport ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>}
                    {visibleColumns.platform && <td className="py-3 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>{pub.platform ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>}
                    {visibleColumns.account && <td className="py-3 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>{pub.accountUsername ? `@${pub.accountUsername}` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>}
                    {visibleColumns.entity && <td className="py-3 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>{pub.entityName ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>}
                    {visibleColumns.format && <td className="py-3 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>{pub.format ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>}
                    {visibleColumns.tags && (
                      <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <QuickClassRow pub={pub} classOptions={taxForDrawer.classifications} />
                      </td>
                    )}
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded transition-all hover:opacity-70 inline-flex" style={{ color: "var(--text-muted)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
        {viewMode !== "list" && (
          <>
            {/* Select-all bar for grid view */}
            {pubs.length > 0 && !loading && (
              <div className="flex items-center gap-3 py-2 mb-1 px-1">
                <input
                  type="checkbox"
                  checked={selected.size === pubs.length && pubs.length > 0}
                  onChange={toggleAll}
                  className="rounded w-4 h-4"
                  style={{ accentColor: "var(--color-charcoal,#D4A420)" }}
                />
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {selected.size > 0
                    ? `${selected.size.toLocaleString()} seleccionad${selected.size === 1 ? "a" : "es"}`
                    : "Seleccionar tots"}
                </span>
                {selected.size > 0 && selected.size === pubs.length && pubs.length < total && !allMatchingSelected && (
                  <button onClick={selectAllMatching} className="text-xs font-semibold underline" style={{ color: "var(--color-charcoal,#D4A420)" }}>
                    Seleccionar els {total.toLocaleString()} resultats
                  </button>
                )}
                {allMatchingSelected && (
                  <button onClick={() => { setSelected(new Set()); setAllMatchingSelected(false); }} className="text-xs font-semibold underline" style={{ color: "var(--color-charcoal,#D4A420)" }}>
                    Desseleccionar tot ({selected.size.toLocaleString()})
                  </button>
                )}
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
            ) : pubs.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>No results</div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
                {pubs.map((pub) => (
                  <AdminCard
                    key={pub.id}
                    pub={pub}
                    onOpen={() => openReview(pub.id)}
                    classOptions={taxForDrawer.classifications}
                    isSelected={selected.has(pub.id)}
                    onSelect={toggleSelect}
                    onDelete={(id) => setPubs((prev) => prev.filter((p) => p.id !== id))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Load more */}
      {page < totalPages && (
        <div
          className="flex items-center justify-center px-8 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
          >
            {loadingMore ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Carregant…
              </>
            ) : (
              <>Carregar més <span style={{ color: "var(--text-muted)" }}>· {(total - pubs.length).toLocaleString()} restants</span></>
            )}
          </button>
        </div>
      )}

      {/* Bulk edit panel */}
      <BulkEditPanel
        selected={selected}
        onClear={() => { setSelected(new Set()); setAllMatchingSelected(false); }}
        onDone={() => { setPage(1); fetchPubs(filters, 1); }}
        onSelectAll={toggleAll}
        taxOptions={taxForDrawer}
      />

      {/* Review panel */}
      {reviewId && (
        <ReviewPanel
          pubId={reviewId}
          prevId={prevReviewId}
          nextId={nextReviewId}
          posLabel={reviewIdx >= 0 ? `${reviewIdx + 1} / ${pubs.length}` : undefined}
          onClose={closeReview}
          onSaved={() => { setPage(1); fetchPubs(filters, 1); }}
          onNavigate={navigateReview}
          taxOptions={taxForDrawer}
        />
      )}

      {/* Add by URL modal */}
      {showAddByUrl && (
        <AddByUrlModal
          onClose={() => setShowAddByUrl(false)}
          onSaved={() => { setPage(1); fetchPubs(filters, 1); }}
          taxOptions={taxForDrawer}
          clubNames={clubOpts.map((o) => o.name)}
        />
      )}
    </div>
  );
}

export default function ContentIdeasPageWrapper() {
  return <Suspense><ContentIdeasPage /></Suspense>;
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Embed helpers ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    twttr?: { widgets: { createTweet: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLElement | undefined>; }; };
  }
}
let _twttrP: Promise<void> | null = null;
function loadTwttr(): Promise<void> {
  if (_twttrP) return _twttrP;
  _twttrP = new Promise((resolve) => {
    if (window.twttr?.widgets) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "twitter-wjs"; s.src = "https://platform.twitter.com/widgets.js"; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { _twttrP = null; resolve(); };
    document.head.appendChild(s);
  });
  return _twttrP;
}

function PlayBtn() {
  return (
    <div className="flex items-center justify-center rounded-full" style={{ width: 52, height: 52, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
    </div>
  );
}

function YTEmbed({ videoId, embedUrl }: { videoId: string; embedUrl: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) return <iframe src={`${embedUrl}?autoplay=1&rel=0`} className="w-full rounded-xl" style={{ height: 280, border: "none" }} allow="autoplay; encrypted-media" allowFullScreen />;
  return (
    <div onClick={() => setPlaying(true)} className="relative w-full rounded-xl overflow-hidden cursor-pointer" style={{ aspectRatio: "16/9", background: "#000" }}>
      <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" style={{ opacity: 0.9 }} />
      <div className="absolute inset-0 flex items-center justify-center"><PlayBtn /></div>
    </div>
  );
}

const TT_PATH = "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.01-8.83a8.18 8.18 0 0 0 4.78 1.52V4.56a4.85 4.85 0 0 1-1-.13z";

function TTEmbed({ videoId, canonicalUrl }: { videoId: string; canonicalUrl: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setThumb(null); setLoaded(false); setPlaying(false);
    fetch(`/api/admin/tiktok-thumb?videoId=${videoId}`).then(r => r.json()).then(d => setThumb(d.thumb ?? null)).catch(() => {});
  }, [videoId]);
  if (playing) {
    return (
      <div className="rounded-xl overflow-hidden mx-auto" style={{ width: 300, height: 534 }}>
        <iframe src={`https://www.tiktok.com/embed/v2/${videoId}`} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="TikTok" />
      </div>
    );
  }
  return (
    <div onClick={() => setPlaying(true)} className="relative cursor-pointer rounded-xl overflow-hidden mx-auto" style={{ width: 300, height: 534, background: "#000" }}>
      {thumb
        ? <img src={thumb} alt="" className="w-full h-full object-cover" style={{ opacity: loaded ? 0.85 : 0 }} onLoad={() => setLoaded(true)} />
        : <div className="absolute inset-0 flex items-center justify-center"><svg width="40" height="40" viewBox="0 0 24 24" fill="white" opacity="0.3"><path d={TT_PATH} /></svg></div>
      }
      <div className="absolute inset-0 flex items-center justify-center"><PlayBtn /></div>
      <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="absolute bottom-3 right-3 px-2 py-1 rounded text-white text-[11px]" style={{ background: "rgba(0,0,0,0.6)" }}>↗</a>
    </div>
  );
}

function TWEmbed({ tweetId, canonicalUrl }: { tweetId: string; canonicalUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) el.innerHTML = `<a href="${canonicalUrl}" target="_blank" style="color:#1d9bf0">View on X ↗</a>`; }, 8000);
    loadTwttr().then(() => {
      if (cancelled || !window.twttr?.widgets?.createTweet) return;
      window.twttr.widgets.createTweet(tweetId, el, { dnt: true, conversation: "none" })
        .then(created => { clearTimeout(timer); if (!created && !cancelled) el.innerHTML = `<a href="${canonicalUrl}" target="_blank" style="color:#1d9bf0">View on X ↗</a>`; })
        .catch(() => clearTimeout(timer));
    });
    return () => { cancelled = true; clearTimeout(timer); if (ref.current) ref.current.innerHTML = ""; };
  }, [tweetId, canonicalUrl]);
  return <div ref={ref} style={{ minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center" }} />;
}

function EmbedBlock({ pub }: { pub: PubDetail }) {
  const plat = pub.platform.toLowerCase();
  if (plat === "youtube") return <YTEmbed videoId={pub.externalPostId} embedUrl={pub.embedUrl} />;
  if (plat === "tiktok") return <TTEmbed videoId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} />;
  if (plat === "instagram") {
    return (
      <div className="mx-auto" style={{ maxWidth: 380 }}>
        <iframe src={pub.canonicalUrl.replace(/\/$/, "") + "/embed"} style={{ border: "none", display: "block", width: "100%", height: 480 }} scrolling="no" title="Instagram" allowFullScreen />
      </div>
    );
  }
  if (plat === "twitter" || plat === "x") return <TWEmbed tweetId={pub.externalPostId} canonicalUrl={pub.canonicalUrl} />;
  if (plat === "linkedin") {
    const lnk = (pub.originalUrl ?? pub.canonicalUrl).includes("linkedin.com")
      ? (pub.originalUrl ?? pub.canonicalUrl).replace("https://www.linkedin.com/feed/update/", "https://www.linkedin.com/embed/feed/update/").replace(/\/$/, "")
      : null;
    if (!lnk) return <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0A66C2" }}>View on LinkedIn ↗</a>;
    return <iframe src={lnk} style={{ border: "none", display: "block", width: "100%", height: 600 }} scrolling="no" title="LinkedIn" allowFullScreen />;
  }
  if (plat === "facebook") {
    const ori = pub.originalUrl ?? pub.canonicalUrl;
    if (!ori.includes("facebook.com")) return <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1877F2" }}>View on Facebook ↗</a>;
    return <iframe src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(ori)}&show_text=true&width=500`} style={{ border: "none", display: "block", width: "100%", minHeight: 500 }} scrolling="no" title="Facebook" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" />;
  }
  return (
    <div className="rounded-xl p-6 flex flex-col items-center gap-4 text-center" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
      <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
        View on {pub.platform}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PubDetail {
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
  sportIds: string[];
  entityTypeId: string | null;
  entityTypeIds: string[];
  entityName: string | null;
  contentFormatId: string | null;
  format: string | null;
  competitions: { id: string; name: string }[];
  classifications: { id: string; name: string }[];
  contentCategories: { id: string; name: string }[];
  reviewStatus: string | null;
  reviewedAt: string | null;
  importStatus: string | null;
  importError: string | null;
  createdAt: string;
}

interface TaxOption { id: string; name: string; slug: string; }

interface TaxOptions {
  sports: TaxOption[];
  entities: TaxOption[];
  formats: TaxOption[];
  platforms: TaxOption[];
  competitions: TaxOption[];
  classifications: TaxOption[];
  contentCategories: TaxOption[];
}

export interface ReviewPanelProps {
  pubId: string;
  prevId?: string | null;
  nextId?: string | null;
  posLabel?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  onNavigate: (id: string) => void;
  taxOptions?: TaxOptions;
  queueType?: string;
}

// ── Helper sub-components ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      {children}
    </div>
  );
}

function InlineToggleGroup({ label, options, selected, onToggle }: {
  label: string; options: TaxOption[]; selected: string[]; onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const showSearch = options.length > 10;
  const filtered = search ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{label}</div>
      {showSearch && (
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cercar…"
          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none mb-2"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {filtered.length === 0 && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Cap resultat</span>
        )}
        {filtered.map(o => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
              style={{
                background: active ? "var(--selected-bg)" : "transparent",
                color: active ? "var(--selected-text)" : "var(--text-secondary)",
                border: `1.5px solid ${active ? "var(--selected-bg)" : "var(--border-color)"}`,
              }}
            >
              {active && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AutocompleteField({ label, value, onChange, suggestionType, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  suggestionType: "username" | "entity"; placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/suggestions?type=${suggestionType}&q=${encodeURIComponent(v)}`);
        const data = await res.json();
        const vals: string[] = data.values ?? [];
        setSuggestions(vals);
        setOpen(vals.length > 0);
      } catch { /* silent */ }
    }, 220);
  }

  function pick(val: string) {
    onChange(val);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={wrapperRef}>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="relative">
        <input
          type="text" value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}
          >
            {suggestions.map((s, i) => (
              <button
                key={s}
                onMouseDown={e => { e.preventDefault(); pick(s); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-all"
                style={{
                  background: i === activeIdx ? "var(--color-charcoal-subtle)" : "transparent",
                  color: i === activeIdx ? "var(--color-charcoal)" : "var(--text-primary)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Platform icon (for ReviewPanel button group) ──────────────────────────────
function PlatformIconBtn({ slug, active }: { slug: string; active: boolean }) {
  const c = "var(--text-muted)";
  switch (slug) {
    case "instagram":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="6" stroke={active ? "#E1306C" : c} strokeWidth="1.8" fill="none" />
          <circle cx="12" cy="12" r="4.5" stroke={active ? "#E1306C" : c} strokeWidth="1.8" fill="none" />
          <circle cx="18" cy="6" r="1.2" fill={active ? "#E1306C" : c} />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
          <path d="M19.2 4.6h-3.4V22.1a3.5 3.5 0 1 1-3.5-3.5c.4 0 .8.05 1.1.15V15.1a7.2 7.2 0 0 0-1.1-.08 7.08 7.08 0 1 0 7.08 7.08V14.3a10.3 10.3 0 0 0 6.2 2v-3.64a6.67 6.67 0 0 1-6.4-8.06z" fill={active ? "var(--text-primary)" : c} />
        </svg>
      );
    case "youtube":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill={active ? "#FF0000" : c} />
          <path d="M9.545 15.568V8.432L15.818 12z" fill={active ? "#fff" : "var(--bg-card)"} />
        </svg>
      );
    case "youtube-shorts": {
      const yc = active ? "#FF0000" : c;
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="8.5" rx="4.25" fill={yc} transform="rotate(-26 12 7.25)" />
          <rect x="2" y="12.5" width="20" height="8.5" rx="4.25" fill={yc} transform="rotate(26 12 16.75)" />
          <polygon points="9.5,9.5 9.5,14.5 16,12" fill={active ? "white" : "var(--bg-card)"} />
        </svg>
      );
    }
    case "twitter": case "x":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill={active ? "var(--text-primary)" : c} />
        </svg>
      );
    case "facebook":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill={active ? "#1877F2" : c} />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill={active ? "#0A66C2" : c} />
        </svg>
      );
    case "pinterest":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path fill={active ? "#E60023" : c} fillRule="evenodd" d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.372 12-12S18.627 0 12 0z" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
        </svg>
      );
  }
}

function FormatIconSm({ slug, active }: { slug: string; active: boolean }) {
  const color = active ? "var(--selected-text)" : "var(--text-muted)";
  const size = 18;
  switch (slug) {
    case "carousel":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="4" width="10" height="24" rx="1.5" /><rect x="16" y="4" width="5" height="24" rx="1.5" opacity="0.6" /><rect x="23" y="4" width="5" height="24" rx="1.5" opacity="0.3" /></svg>;
    case "reel":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="6" y="3" width="20" height="26" rx="2" /><path d="M6 9h20M6 15h20" strokeOpacity="0.4" /><polygon points="14,18 14,26 21,22" fill={color} stroke="none" /></svg>;
    case "image":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="6" width="24" height="20" rx="2" /><circle cx="11" cy="13" r="2.5" /><path d="M28 22l-7-7-13 11" strokeLinejoin="round" /></svg>;
    case "video":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="3" y="7" width="20" height="18" rx="2" /><path d="M23 13l6-4v14l-6-4v-6z" fill={color} fillOpacity="0.3" /></svg>;
    default:
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="4" width="24" height="24" rx="3" /></svg>;
  }
}

function PlatformButtonGroup({ options, selected, onSelect }: {
  options: TaxOption[]; selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Plataforma</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected === o.id;
          const label = o.name === "YouTube Shorts" ? "YT Shorts" : o.name.length > 10 ? o.name.slice(0, 9) + "…" : o.name;
          return (
            <button key={o.id} onClick={() => onSelect(active ? "" : o.id)}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
              style={{
                background: active ? "var(--selected-bg)" : "var(--bg-input)",
                border: `1.5px solid ${active ? "var(--selected-bg)" : "var(--border-color)"}`,
                minWidth: 44,
              }}>
              <PlatformIconBtn slug={o.slug} active={active} />
              <span className="text-[9px] font-semibold leading-none" style={{ color: active ? "var(--selected-text)" : "var(--text-muted)" }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormatButtonGroup({ options, selected, onSelect }: {
  options: TaxOption[]; selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Format</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected === o.id;
          return (
            <button key={o.id} onClick={() => onSelect(active ? "" : o.id)}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
              style={{
                background: active ? "var(--selected-bg)" : "var(--bg-input)",
                border: `1.5px solid ${active ? "var(--selected-bg)" : "var(--border-color)"}`,
                minWidth: 52,
              }}>
              <FormatIconSm slug={o.slug} active={active} />
              <span className="text-[9px] font-semibold leading-none" style={{ color: active ? "var(--selected-text)" : "var(--text-muted)" }}>{o.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SingleSelectGroup({ label, options, selected, onSelect }: {
  label: string; options: TaxOption[]; selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected === o.id;
          return (
            <button key={o.id} onClick={() => onSelect(active ? "" : o.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
              style={{
                background: active ? "var(--selected-bg)" : "transparent",
                color: active ? "var(--selected-text)" : "var(--text-secondary)",
                border: `1.5px solid ${active ? "var(--selected-bg)" : "var(--border-color)"}`,
              }}>
              {active && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompetitionSearchGroup({ options, selected, onToggle }: {
  options: TaxOption[]; selected: string[]; onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Competicions</div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(id => {
            const o = options.find(x => x.id === id);
            if (!o) return null;
            return (
              <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
                {o.name}
                <button onClick={() => onToggle(id)} className="hover:opacity-70 transition-opacity leading-none">×</button>
              </span>
            );
          })}
        </div>
      )}
      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Cercar competició…"
        className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none mb-1.5"
        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
      />
      {search.trim() && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)", maxHeight: 180, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-muted)" }}>Cap resultat</div>
          ) : (
            filtered.map(o => {
              const active = selected.includes(o.id);
              return (
                <button key={o.id} onClick={() => { onToggle(o.id); setSearch(""); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] text-left transition-all hover:opacity-80"
                  style={{ background: active ? "var(--selected-bg)" : "transparent", color: active ? "var(--selected-text)" : "var(--text-primary)", borderBottom: "1px solid var(--border-color)" }}>
                  <span>{o.name}</span>
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Review summary helpers ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b", label: "Pendent" },
  approved: { bg: "rgba(34,197,94,0.12)",   text: "#22c55e", label: "Aprovat" },
  rejected: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", label: "Rebutjat" },
};

function ReviewBanner({ pub, queueType }: { pub: PubDetail; queueType?: string }) {
  const reasons: string[] = [];
  if (pub.importStatus === "error") reasons.push("Error d'importació");
  // Only warn about missing data if not yet approved — missing entity/sport on approved = intentional
  if (pub.reviewStatus !== "approved") {
    if (!pub.accountUsername) reasons.push("Usuari desconegut");
    if (!pub.entityName) reasons.push("Entitat no assignada");
    if (pub.sportIds.length === 0) reasons.push("Esport sense classificar");
  }
  const status = pub.reviewStatus ? STATUS_STYLE[pub.reviewStatus] : null;
  const queue = queueType === "new" ? "New Content" : queueType === "missing" ? "Missing Information" : queueType === "errors" ? "Errors" : null;
  if (!status && !queue && reasons.length === 0) return null;
  return (
    <div className="rounded-xl p-3 mb-4" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {queue && <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Cua: <span style={{ color: "var(--text-secondary)" }}>{queue}</span></span>}
        {status && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.text }}>{status.label}</span>
        )}
        {!status && pub.reviewStatus == null && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280" }}>Sense revisió</span>
        )}
      </div>
      {pub.importStatus === "error" && pub.importError && (
        <div className="mt-2 text-[11px] rounded-lg px-2.5 py-1.5" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
          {pub.importError}
        </div>
      )}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {reasons.map(r => (
            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dirty guard modal ──────────────────────────────────────────────────────────

function DirtyGuard({ onSave, onDiscard, onCancel }: { onSave: () => void; onDiscard: () => void; onCancel: () => void; }) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50" onClick={onCancel} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <h2 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Canvis sense desar</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>Hi ha canvis que no has desat. Vols desar-los abans de continuar?</p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>Cancel·la</button>
            <button onClick={onDiscard} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>Descarta</button>
            <button onClick={onSave} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>Desa i continua</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReviewPanel({ pubId, prevId, nextId, posLabel, onClose, onSaved, onNavigate, taxOptions: externalTax, queueType }: ReviewPanelProps) {
  const [pub, setPub] = useState<PubDetail | null>(null);
  const [tax, setTax] = useState<TaxOptions>({ sports: [], entities: [], formats: [], platforms: [], competitions: [], classifications: [], contentCategories: [] });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guard, setGuard] = useState<{ onConfirm: () => void } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editSportIds, setEditSportIds] = useState<string[]>([]);
  const [editEntityTypeIds, setEditEntityTypeIds] = useState<string[]>([]);
  const [editFormatId, setEditFormatId] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");
  const [editEntityName, setEditEntityName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPublishedAt, setEditPublishedAt] = useState("");
  const [editCompetitionIds, setEditCompetitionIds] = useState<string[]>([]);
  const [editClassificationIds, setEditClassificationIds] = useState<string[]>([]);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);

  // Snapshot for dirty detection
  const originalRef = useRef<string>("");

  const activeTax = externalTax ?? tax;

  const currentSnapshot = () => JSON.stringify({
    editSportIds: [...editSportIds].sort(),
    editEntityTypeIds: [...editEntityTypeIds].sort(),
    editFormatId, editPlatformId,
    editEntityName, editUsername, editTitle, editPublishedAt,
    editCompetitionIds: [...editCompetitionIds].sort(),
    editClassificationIds: [...editClassificationIds].sort(),
    editCategoryIds: [...editCategoryIds].sort(),
  });
  const isDirty = pub !== null && currentSnapshot() !== originalRef.current;

  // Load tax options if not provided externally
  useEffect(() => {
    if (externalTax) return;
    async function loadTax() {
      const res = await fetch("/api/admin/filters");
      const data = await res.json();
      const opts: TaxOptions = { sports: [], entities: [], formats: [], platforms: [], competitions: [], classifications: [], contentCategories: [] };
      for (const cat of data.categories ?? []) {
        const r = await fetch(`/api/admin/filters?category=${cat.key}`);
        const d = await r.json();
        const vals = (d.values ?? []).map((v: { id?: string; name: string; slug?: string }) => ({ id: v.id ?? v.slug ?? v.name, name: v.name, slug: v.slug ?? v.name }));
        if (cat.key === "sport") opts.sports = vals;
        else if (cat.key === "entity") opts.entities = vals;
        else if (cat.key === "competition") opts.competitions = vals;
        else if (cat.key === "platform") opts.platforms = vals;
        else if (cat.key === "format") opts.formats = vals;
        else if (cat.key === "classification") {
          const rAll = await fetch("/api/admin/filters?category=classification&all=true");
          const dAll = await rAll.json();
          opts.classifications = (dAll.values ?? []).map((v: { id: string; name: string; slug: string }) => ({ id: v.id, name: v.name, slug: v.slug }));
        }
        else if (cat.key === "contentCategory") opts.contentCategories = vals;
      }
      setTax(opts);
    }
    loadTax();
  }, [externalTax]);

  // Load pub data
  const loadPub = useCallback(async (id: string) => {
    setPub(null);
    const res = await fetch(`/api/admin/publications?id=${id}`);
    if (!res.ok) return;
    const d: PubDetail = await res.json();
    setPub(d);
    const snap = JSON.stringify({
      editSportIds: (d.sportIds ?? (d.sportId ? [d.sportId] : [])).sort(),
      editEntityTypeIds: (d.entityTypeIds ?? (d.entityTypeId ? [d.entityTypeId] : [])).sort(),
      editFormatId: d.contentFormatId ?? "",
      editPlatformId: d.platformId ?? "",
      editEntityName: d.entityName ?? "",
      editUsername: d.accountUsername ?? "",
      editTitle: d.rawTitle ?? "",
      editPublishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString().slice(0, 16) : "",
      editCompetitionIds: d.competitions.map(c => c.id).sort(),
      editClassificationIds: d.classifications.map(c => c.id).sort(),
      editCategoryIds: d.contentCategories.map(c => c.id).sort(),
    });
    originalRef.current = snap;
    setEditSportIds(d.sportIds ?? (d.sportId ? [d.sportId] : []));
    setEditEntityTypeIds(d.entityTypeIds ?? (d.entityTypeId ? [d.entityTypeId] : []));
    setEditFormatId(d.contentFormatId ?? "");
    setEditPlatformId(d.platformId ?? "");
    setEditEntityName(d.entityName ?? "");
    setEditUsername(d.accountUsername ?? "");
    setEditTitle(d.rawTitle ?? "");
    setEditPublishedAt(d.publishedAt ? new Date(d.publishedAt).toISOString().slice(0, 16) : "");
    setEditCompetitionIds(d.competitions.map(c => c.id));
    setEditClassificationIds(d.classifications.map(c => c.id));
    setEditCategoryIds(d.contentCategories.map(c => c.id));
    setError(null);
    setSaved(false);
  }, []);

  useEffect(() => { loadPub(pubId); }, [pubId, loadPub]);

  // Save
  async function handleSave(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publications?id=${pubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportIds: editSportIds,
          entityTypeIds: editEntityTypeIds,
          contentFormatId: editFormatId || null,
          platformId: editPlatformId || pub?.platformId || null,
          entityName: editEntityName || null,
          accountUsername: editUsername || null,
          rawTitle: editTitle || null,
          publishedAt: editPublishedAt || null,
          competitionIds: editCompetitionIds,
          classificationIds: editClassificationIds,
          contentCategoryIds: editCategoryIds,
        }),
      });
      if (!res.ok) { setError("Error al desar"); return false; }
      // Update snapshot so isDirty = false
      originalRef.current = currentSnapshot();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved(pubId);
      return true;
    } finally {
      setSaving(false);
    }
  }

  // Approve
  async function handleApprove() {
    if (isDirty) {
      const ok = await handleSave();
      if (!ok) return;
    }
    setApproving(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pubId, reviewStatus: "approved" }),
      });
      if (!res.ok) { setError("Error en aprovar"); return; }
      onSaved(pubId);
      if (nextId) onNavigate(nextId); else onClose();
    } finally {
      setApproving(false);
    }
  }

  // Reject
  async function handleReject() {
    setRejecting(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pubId, reviewStatus: "rejected" }),
      });
      if (!res.ok) { setError("Error en rebutjar"); return; }
      onSaved(pubId);
      if (nextId) onNavigate(nextId); else onClose();
    } finally {
      setRejecting(false);
    }
  }

  // Save & next
  async function handleSaveAndNext() {
    const ok = await handleSave();
    if (ok && nextId) onNavigate(nextId);
    else if (ok && !nextId) onClose();
  }

  // Navigate with dirty guard
  function tryNavigate(id: string) {
    if (isDirty) {
      setGuard({
        onConfirm: async () => {
          setGuard(null);
          const ok = await handleSave();
          if (ok) onNavigate(id);
        },
      });
    } else {
      onNavigate(id);
    }
  }

  function tryClose() {
    if (isDirty) {
      setGuard({
        onConfirm: async () => {
          setGuard(null);
          const ok = await handleSave();
          if (ok) onClose();
        },
      });
    } else {
      onClose();
    }
  }

  // Delete
  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/publications?id=${pubId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onSaved(pubId);
      onClose();
    } catch {
      setDeleting(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (e.target as HTMLElement).isContentEditable;
      if (e.key === "Escape") { tryClose(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); return; }
      if (isInput) return;
      if (e.key === "ArrowRight" || e.key === "n") { if (nextId) tryNavigate(nextId); return; }
      if (e.key === "ArrowLeft" || e.key === "p") { if (prevId) tryNavigate(prevId); return; }
      if (e.key === "a" && !approving) { handleApprove(); return; }
      if (e.key === "x" && !rejecting) { handleReject(); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, pubId, nextId, prevId, approving, rejecting]);

  function toggleId(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  }

  const isBusy = saving || approving || rejecting || deleting;

  return (
    <>
      {/* Backdrop — click closes the panel */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
        onClick={tryClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(680px, 100vw)",
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-color)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", minHeight: 52 }}>
          {/* Close */}
          <button
            onClick={tryClose}
            className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0"
            style={{ width: 30, height: 30, background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
            title="Tanca (Esc)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {/* Prev / Next */}
          <button
            disabled={!prevId || isBusy}
            onClick={() => prevId && tryNavigate(prevId)}
            className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70 disabled:opacity-30 shrink-0"
            style={{ width: 30, height: 30, background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
            title="Anterior (←)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            disabled={!nextId || isBusy}
            onClick={() => nextId && tryNavigate(nextId)}
            className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70 disabled:opacity-30 shrink-0"
            style={{ width: 30, height: 30, background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
            title="Següent (→)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </button>

          {/* Position label */}
          {posLabel && <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>{posLabel}</span>}

          {/* Title */}
          <div className="flex-1 min-w-0 px-1">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }} title={pub?.rawTitle ?? ""}>
              {pub ? (pub.rawTitle ? (pub.rawTitle.length > 70 ? pub.rawTitle.slice(0, 70) + "…" : pub.rawTitle) : pub.externalPostId) : "Loading…"}
            </div>
          </div>

          {/* Dirty indicator */}
          {isDirty && <span className="text-[10px] font-bold shrink-0" style={{ color: "#f59e0b" }}>● canvis</span>}

          {/* External link */}
          {pub && (
            <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0" style={{ width: 30, height: 30, background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }} title="Veure original">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}

          {/* Delete */}
          {pub && (
            <button
              onClick={() => { setDeleteInput(""); setDeleteOpen(true); }}
              className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0"
              style={{ width: 30, height: 30, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              title="Eliminar"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          )}
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-primary)" }}>
          {!pub ? (
            <div className="flex items-center justify-center py-24" style={{ color: "var(--text-muted)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              Carregant…
            </div>
          ) : (
            <>
              {/* Embed section */}
              <div className="px-5 pt-5 pb-4">
                <EmbedBlock pub={pub} />
              </div>

              {/* Form section */}
              <div className="px-5 pb-24 space-y-4">
                {/* Review summary */}
                <ReviewBanner pub={pub} queueType={queueType} />

                {error && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</div>
                )}

                {/* Title */}
                <Field label="Títol">
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Títol o caption" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </Field>

                {/* Username */}
                <AutocompleteField
                  label="Usuari del compte"
                  value={editUsername}
                  onChange={setEditUsername}
                  suggestionType="username"
                  placeholder="@username"
                />

                {/* Entity name */}
                <AutocompleteField
                  label="Club / Entitat"
                  value={editEntityName}
                  onChange={setEditEntityName}
                  suggestionType="entity"
                  placeholder="ex. FC Barcelona"
                />

                {/* Published date */}
                <Field label="Data de publicació">
                  <input type="datetime-local" value={editPublishedAt} onChange={e => setEditPublishedAt(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: editPublishedAt ? "var(--text-primary)" : "var(--text-muted)" }} />
                </Field>

                {/* Platform + Format */}
                <PlatformButtonGroup options={activeTax.platforms} selected={editPlatformId} onSelect={setEditPlatformId} />
                <FormatButtonGroup options={activeTax.formats} selected={editFormatId} onSelect={setEditFormatId} />

                {/* Sport + Entity type */}
                <InlineToggleGroup label="Esport" options={activeTax.sports} selected={editSportIds} onToggle={id => toggleId(editSportIds, setEditSportIds, id)} />
                <InlineToggleGroup label="Tipus d'entitat" options={activeTax.entities} selected={editEntityTypeIds} onToggle={id => toggleId(editEntityTypeIds, setEditEntityTypeIds, id)} />

                {/* Competitions — search only */}
                <CompetitionSearchGroup options={activeTax.competitions} selected={editCompetitionIds} onToggle={id => toggleId(editCompetitionIds, setEditCompetitionIds, id)} />

                {/* Classifications */}
                <InlineToggleGroup label="Classificacions editorials" options={activeTax.classifications} selected={editClassificationIds} onToggle={id => toggleId(editClassificationIds, setEditClassificationIds, id)} />

                {/* Content categories */}
                <InlineToggleGroup label="Categories de contingut" options={activeTax.contentCategories} selected={editCategoryIds} onToggle={id => toggleId(editCategoryIds, setEditCategoryIds, id)} />

                {/* Read-only info */}
                <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Info</div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID:</span>
                    <span className="text-[10px] font-mono select-all" style={{ color: "var(--text-secondary)" }}>{pub.externalPostId}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Afegit:</span>
                    <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{new Date(pub.createdAt).toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Fixed action bar ───────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isBusy || !pub}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:opacity-80"
            style={{ background: saved ? "#22c55e" : "var(--selected-bg)", color: saved ? "#fff" : "var(--selected-text)", minWidth: 80 }}
          >
            {saving ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Desant…</>
            ) : saved ? "✓ Desat" : "Desa"}
          </button>

          <div className="flex-1" />

          {/* Reject */}
          <button
            onClick={handleReject}
            disabled={isBusy || !pub || pub.reviewStatus === "rejected"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition-all hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
            title="Rebutja (X)"
          >
            {rejecting ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
            Rebutja
          </button>

          {/* Approve */}
          <button
            onClick={handleApprove}
            disabled={isBusy || !pub || pub.reviewStatus === "approved"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition-all hover:opacity-80"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
            title="Aprova (A)"
          >
            {approving ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
            Aprova
          </button>

          {/* Save & next */}
          {nextId && (
            <button
              onClick={handleSaveAndNext}
              disabled={isBusy || !pub}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              title="Desa i seguent (→)"
            >
              Desa i seguent
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Dirty guard */}
      {guard && (
        <DirtyGuard
          onSave={guard.onConfirm}
          onDiscard={() => { setGuard(null); /* caller handles navigation */ }}
          onCancel={() => setGuard(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => !deleting && setDeleteOpen(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: "rgba(239,68,68,0.12)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <h2 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Eliminar contingut</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                Acció irreversible. Escriu <span className="font-mono font-bold" style={{ color: "#ef4444" }}>DELETE</span> per confirmar.
              </p>
              <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="DELETE" className="w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none font-mono" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>Cancel·la</button>
                <button onClick={handleDelete} disabled={deleteInput !== "DELETE" || deleting} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: "#ef4444", color: "#fff" }}>
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

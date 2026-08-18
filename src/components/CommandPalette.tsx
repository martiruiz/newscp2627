"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ResultItem {
  id: string;
  label: string;
  sub: string;
  href: string;
  external?: boolean;
  type: "news" | "blog" | "job" | "content";
}

interface Results {
  news: ResultItem[];
  blog: ResultItem[];
  jobs: ResultItem[];
  content: ResultItem[];
}

const SECTION_LABELS: Record<string, string> = {
  news: "Novetats",
  blog: "Blog",
  jobs: "Oportunitats",
  content: "Contingut",
};

const TypeIcon = ({ type }: { type: string }) => {
  if (type === "news")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 10h16M4 14h10" />
      </svg>
    );
  if (type === "blog")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    );
  if (type === "job")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Keyboard shortcut to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
      setActiveIdx(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results);
        setActiveIdx(0);
      } catch {}
      finally { setLoading(false); }
    }, 280);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    search(e.target.value);
  }

  // Flatten results for keyboard nav
  const flat: ResultItem[] = results
    ? [...results.news, ...results.blog, ...results.jobs, ...results.content]
    : [];

  function navigate(item: ResultItem) {
    setOpen(false);
    if (item.external) {
      window.open(item.href, "_blank", "noopener");
    } else {
      router.push(item.href);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && flat[activeIdx]) navigate(flat[activeIdx]);
  }

  if (!open) return null;

  const sections = results
    ? (["news", "blog", "jobs", "content"] as const).filter((k) => results[k].length > 0)
    : [];

  let globalIdx = 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ width: "100%", maxWidth: 560, borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-color)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            placeholder="Cerca novetats, blog, oportunitats, contingut..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, color: "var(--text-primary)", fontFamily: "inherit" }}
          />
          {loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0, animation: "spin 1s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          <kbd style={{ fontSize: 11, padding: "2px 6px", borderRadius: 5, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)", flexShrink: 0 }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {!results && !loading && (
            <p style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--text-muted)" }}>
              Escriu per cercar arreu de l&apos;app
            </p>
          )}
          {results && sections.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--text-muted)" }}>
              Sense resultats per a &ldquo;{query}&rdquo;
            </p>
          )}

          {sections.map((section) => {
            const items = section === "jobs" ? results!.jobs : results![section];
            return (
              <div key={section}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "10px 16px 4px", color: "var(--text-muted)" }}>
                  {SECTION_LABELS[section]}
                </p>
                {items.map((item) => {
                  const idx = globalIdx++;
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{
                        width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 16px", border: "none", cursor: "pointer", transition: "background 0.1s",
                        background: isActive ? "var(--bg-hover, rgba(31,41,55,0.08))" : "transparent",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                        <TypeIcon type={item.type} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.label}
                        </span>
                        {item.sub && (
                          <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.sub}
                          </span>
                        )}
                      </span>
                      {item.external && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
          <span><kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>↑↓</kbd> navegar</span>
          <span><kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>↵</kbd> obrir</span>
          <span><kbd style={{ padding: "1px 5px", borderRadius: 4, background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>esc</kbd> tancar</span>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FilterSidebar, { type SelectedFilters } from "@/components/FilterSidebar";
import PublicationCard from "@/components/PublicationCard";
import LibraryTutorialOverlay from "@/components/LibraryTutorialOverlay";

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  originalUrl: string | null;
  sports: string[];
  entityTypes: string[];
  entityName: string | null;
  contentFormat: string | null;
  competitions: string[];
  classifications: string[];
  isSaved: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const DEFAULT_FILTERS: SelectedFilters = {
  sport: [],
  competition: [],
  entityType: [],
  entityName: [],
  format: [],
  platform: [],
  classification: [],
  contentCategory: [],
  saved: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  order: "latest",
};

const BATCH_SIZE = 9; // cards per page

function getActiveChips(filters: SelectedFilters) {
  const chips: { label: string; key: string; filterKey: string; value: string }[] = [];
  const entityDisplayName: Record<string, string> = {
    brands: "Brand", clubs: "Club", competitions: "Competition",
    "content-creators": "Creator", media: "Media", players: "Athlete",
  };
  for (const v of filters.sport) chips.push({ label: v, key: `s-${v}`, filterKey: "sport", value: v });
  for (const v of filters.entityType) chips.push({ label: entityDisplayName[v] || v, key: `et-${v}`, filterKey: "entityType", value: v });
  for (const v of filters.entityName) chips.push({ label: v, key: `en-${v}`, filterKey: "entityName", value: v });
  for (const v of filters.format) chips.push({ label: v, key: `f-${v}`, filterKey: "format", value: v });
  for (const v of filters.platform) chips.push({ label: v, key: `p-${v}`, filterKey: "platform", value: v });
  for (const v of filters.classification) chips.push({ label: v, key: `c-${v}`, filterKey: "classification", value: v });
  for (const v of filters.contentCategory) chips.push({ label: v, key: `cc-${v}`, filterKey: "contentCategory", value: v });
  if (filters.saved) chips.push({ label: "Saved", key: "saved", filterKey: "saved", value: "" });
  if (filters.dateFrom || filters.dateTo) {
    const label = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom ? `From ${filters.dateFrom}` : `Until ${filters.dateTo}`;
    chips.push({ label, key: "date", filterKey: "dateRange", value: "" });
  }
  return chips;
}

const SMART_CHIPS = [
  {
    label: "Top Picks",
    filterKey: "classification" as const,
    value: "top-picks",
    gradient: "linear-gradient(135deg, #E8567A 0%, #A82346 100%)",
    description: "Trending content handpicked by the SCP team.",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    label: "Overperforming",
    filterKey: "classification" as const,
    value: "overperforming",
    gradient: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)",
    description: "Posts performing above the profile's average.",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  },
  {
    label: "Content Creators",
    filterKey: "entityType" as const,
    value: "content-creators",
    gradient: "linear-gradient(135deg, #D4A420 0%, #7B4D0B 100%)",
    description: "Content published by individual content creators.",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: "Replicable Ideas",
    filterKey: "classification" as const,
    value: "replicable-ideas",
    gradient: "linear-gradient(135deg, #52D68A 0%, #1B8A4E 100%)",
    description: "Low-budget ideas that are easy to adapt and apply to your club, brand, or project.",
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  },
];

function SmartFilters({
  filters,
  setFilters,
}: {
  filters: SelectedFilters;
  setFilters: React.Dispatch<React.SetStateAction<SelectedFilters>>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [infoOpen]);

  return (
    <div className="mb-3">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Smart filters
        </span>
        {/* Info button */}
        <div className="relative" ref={infoRef}>
          <button
            onClick={() => setInfoOpen((o) => !o)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all"
            style={{
              background: infoOpen ? "var(--selected-bg)" : "var(--bg-card)",
              color: infoOpen ? "var(--selected-text)" : "var(--text-muted)",
              border: `1px solid ${infoOpen ? "transparent" : "var(--border-color)"}`,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="8.01"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
            </svg>
            Selection criteria
          </button>

          {/* Dropdown */}
          {infoOpen && (
            <div
              className="absolute left-0 top-full mt-2 z-50 rounded-2xl p-5"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                width: "min(288px, calc(100vw - 2rem))",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Selection criteria
                </h3>
                <button onClick={() => setInfoOpen(false)} style={{ color: "var(--text-muted)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                {SMART_CHIPS.map((chip) => (
                  <div key={chip.value} className="flex gap-3">
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5"
                      style={{ background: chip.gradient }}
                    >
                      <span style={{ color: "#fff" }}>{chip.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{chip.label}</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{chip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: 2×2 grid / Desktop: pill row */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {SMART_CHIPS.map((chip) => {
          const isSelected = (filters[chip.filterKey] as string[]).includes(chip.value);
          return (
            <button
              key={chip.value}
              onClick={() => {
                const arr = filters[chip.filterKey] as string[];
                const updated = arr.includes(chip.value)
                  ? arr.filter((v) => v !== chip.value)
                  : [...arr, chip.value];
                setFilters((f) => ({ ...f, [chip.filterKey]: updated }));
              }}
              className="flex flex-col items-start gap-2 px-3 pt-3 pb-2.5 rounded-2xl text-left transition-all active:scale-95"
              style={{
                background: isSelected ? chip.gradient : "var(--bg-card)",
                border: `1.5px solid ${isSelected ? "transparent" : "var(--border-color)"}`,
                minHeight: 72,
              }}
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-xl"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.22)" : chip.gradient,
                }}
              >
                <span style={{ color: "#fff" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {chip.value === "top-picks" && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>}
                    {chip.value === "overperforming" && <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>}
                    {chip.value === "content-creators" && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>}
                    {chip.value === "replicable-ideas" && <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}
                  </svg>
                </span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span
                  className="text-xs font-bold leading-tight"
                  style={{ color: isSelected ? "#fff" : "var(--text-primary)" }}
                >
                  {chip.label}
                </span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop: pill row */}
      <div className="hidden sm:flex flex-wrap items-center gap-1.5">
        {SMART_CHIPS.map((chip) => {
          const isSelected = (filters[chip.filterKey] as string[]).includes(chip.value);
          return (
            <button
              key={chip.value}
              onClick={() => {
                const arr = filters[chip.filterKey] as string[];
                const updated = arr.includes(chip.value)
                  ? arr.filter((v) => v !== chip.value)
                  : [...arr, chip.value];
                setFilters((f) => ({ ...f, [chip.filterKey]: updated }));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isSelected ? chip.gradient : "var(--bg-card)",
                color: isSelected ? "#fff" : "var(--text-secondary)",
                border: `1.5px solid ${isSelected ? "transparent" : "var(--border-color)"}`,
              }}
            >
              <span style={{ color: isSelected ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>{chip.icon}</span>
              {chip.label}
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams.get("order") === "random" ? "random" : "latest";

  const [publications, setPublications] = useState<Publication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<SelectedFilters>({ ...DEFAULT_FILTERS, order: initialOrder });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [readyPubs, setReadyPubs] = useState(new Set<string>());

  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  // Sync URL ?order=random param into filter state (handles Discover tab clicks while already on /feed)
  useEffect(() => {
    const urlOrder = searchParams.get("order") === "random" ? "random" : "latest";
    setFilters((f) => {
      if (f.order === urlOrder) return f;
      return { ...f, order: urlOrder };
    });
  }, [searchParams]);

  const handleEmbedLoaded = useCallback((pubKey: string) => {
    setReadyPubs((prev) => {
      if (prev.has(pubKey)) return prev;
      const next = new Set(prev);
      next.add(pubKey);
      return next;
    });
  }, []);

  const fetchPublications = useCallback(
    async (page: number, append = false) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(BATCH_SIZE));

      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          if (value.length > 0) params.set(key, value.join(","));
        } else if (value) {
          params.set(key, value);
        }
      }

      try {
        if (!append) setLoading(true);
        else setLoadingMore(true);

        const res = await fetch(`/api/publications?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        const newPubs: Publication[] = data.publications;

        if (append) {
          setPublications((prev) => [...prev, ...newPubs]);
        } else {
          setReadyPubs(new Set());
          setPublications(newPubs);
        }
        setPagination(data.pagination);
        pageRef.current = page;
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Failed to fetch publications:", e);
          setLoading(false);
          setLoadingMore(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters]
  );

  useEffect(() => {
    pageRef.current = 1;
    setPublications([]);
    fetchPublications(1);
  }, [fetchPublications]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !loadingMore && !loading) {
          fetchPublications(pageRef.current + 1, true);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pagination, loadingMore, loading, fetchPublications]);

  const activeFilterCount =
    filters.sport.length +
    filters.competition.length +
    filters.entityType.length +
    filters.entityName.length +
    filters.format.length +
    filters.platform.length +
    filters.classification.length +
    filters.contentCategory.length +
    (filters.saved ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <Suspense>
        <LibraryTutorialOverlay />
      </Suspense>
      <div className="flex-1 flex">
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          resultCount={pagination?.total}
        />

        <main className="flex-1 min-w-0 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm lg:hidden"
                style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--selected-bg)", color: "#fff" }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {pagination && (
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  <span className="sm:hidden">{pagination.total >= 1000 ? `${(pagination.total / 1000).toFixed(0)} K` : pagination.total} ideas</span>
                  <span className="hidden sm:inline">{pagination.total.toLocaleString()} ideas</span>
                </span>
              )}
            </div>
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-color)" }}
            >
              {[
                { value: "latest", label: "Latest", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { value: "random", label: "Random", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="16 3 21 3 21 8"/><polyline points="16 21 21 21 21 16"/><line x1="4" y1="4" x2="21" y2="21"/><line x1="21" y1="4" x2="4" y2="21"/></svg> },
              ].map((opt, i) => {
                const active = filters.order === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilters({ ...filters, order: opt.value })}
                    className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs font-semibold transition-all"
                    style={{
                      background: active ? "var(--selected-bg)" : "var(--bg-input)",
                      color: active ? "#fff" : "var(--text-muted)",
                      borderRight: i === 0 ? "1px solid var(--border-color)" : "none",
                    }}
                  >
                    {opt.icon}
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart filters */}
          <SmartFilters filters={filters} setFilters={setFilters} />

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {getActiveChips(filters).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "var(--color-charcoal-subtle)", color: "var(--selected-bg)", border: "1px solid rgba(31,41,55,0.3)" }}
                >
                  {chip.label}
                  <button
                    onClick={() => {
                      if (chip.filterKey === "saved") {
                        setFilters({ ...filters, saved: "" });
                      } else if (chip.filterKey === "dateRange") {
                        setFilters({ ...filters, dateFrom: "", dateTo: "" });
                      } else {
                        const arr = filters[chip.filterKey as keyof SelectedFilters] as string[];
                        setFilters({ ...filters, [chip.filterKey]: arr.filter((v) => v !== chip.value) });
                      }
                    }}
                    className="ml-0.5 hover:opacity-70"
                    style={{ color: "var(--selected-bg)" }}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: "var(--text-muted)" }}
              >
                Clear all
              </button>
            </div>
          )}

          {loading ? (
            <MasonryGrid>
              {Array.from({ length: BATCH_SIZE }).map((_, i) => (
                <SkeletonCard key={`sk-init-${i}`} index={i} />
              ))}
            </MasonryGrid>
          ) : publications.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <style>{`
                @keyframes floatA { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-10px) rotate(-6deg)} }
                @keyframes floatB { 0%,100%{transform:translateY(0) rotate(0deg)}  50%{transform:translateY(-12px) rotate(0deg)} }
                @keyframes floatC { 0%,100%{transform:translateY(0) rotate(5deg)}  50%{transform:translateY(-8px) rotate(5deg)} }
                @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
              `}</style>

              {/* Floating cards illustration */}
              <div style={{ position: "relative", width: 220, height: 155, marginBottom: 28 }}>
                {/* Back-left card */}
                <div style={{
                  position: "absolute", left: 0, top: 28, width: 110, height: 120,
                  borderRadius: 14, background: "var(--bg-card)",
                  border: "1.5px solid var(--border-color)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                  animation: "floatA 3.4s ease-in-out infinite", animationDelay: "0.6s",
                }}>
                  <div style={{ padding: "10px 10px 0" }}>
                    <div style={{ height: 55, borderRadius: 8, background: "var(--bg-input)", marginBottom: 8 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "70%", marginBottom: 5 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "45%" }} />
                  </div>
                </div>

                {/* Center card (main, no rotation) */}
                <div style={{
                  position: "absolute", left: 55, top: 0, width: 110, height: 135,
                  borderRadius: 14, background: "var(--bg-card)",
                  border: "1.5px solid var(--border-color)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  zIndex: 2,
                  animation: "floatB 2.9s ease-in-out infinite",
                }}>
                  <div style={{ padding: "10px 10px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-input)" }} />
                      <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", flex: 1 }} />
                    </div>
                    <div style={{ height: 62, borderRadius: 8, background: "var(--bg-input)", marginBottom: 8 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "80%", marginBottom: 5 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "55%" }} />
                  </div>
                </div>

                {/* Front-right card */}
                <div style={{
                  position: "absolute", right: 0, top: 32, width: 110, height: 115,
                  borderRadius: 14, background: "var(--bg-card)",
                  border: "1.5px solid var(--border-color)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                  animation: "floatC 3.8s ease-in-out infinite", animationDelay: "1.1s",
                }}>
                  <div style={{ padding: "10px 10px 0" }}>
                    <div style={{ height: 50, borderRadius: 8, background: "var(--bg-input)", marginBottom: 8 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "60%", marginBottom: 5 }} />
                    <div style={{ height: 7, borderRadius: 4, background: "var(--bg-input)", width: "35%" }} />
                  </div>
                </div>

                {/* Search badge */}
                <div style={{
                  position: "absolute", right: 14, bottom: -8, zIndex: 3,
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--bg-card)", border: "1.5px solid var(--border-color)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7.5"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                    <line x1="8.5" y1="11" x2="13.5" y2="11"/>
                  </svg>
                </div>
              </div>

              <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)", animation: "fadeSlideUp 0.4s ease both", animationDelay: "0.1s" }}>
                Sense resultats
              </p>
              {activeFilterCount > 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)", animation: "fadeSlideUp 0.4s ease both", animationDelay: "0.2s" }}>
                  Prova a eliminar algun filtre per veure contingut.
                </p>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)", animation: "fadeSlideUp 0.4s ease both", animationDelay: "0.2s" }}>
                  <a href="/admin/import" style={{ color: "var(--accent-blue)" }}>Importa contingut</a>{" "}
                  per començar.
                </p>
              )}
            </div>
          ) : (
            <div data-tutorial="feed-content">
            <MasonryGrid>
              {publications.map((pub, i) => {
                const pubKey = `${pub.platform}-${pub.externalPostId}`;
                const isReady = readyPubs.has(pubKey);
                return (
                  <CardSlot key={pubKey}>
                    {!isReady && <SkeletonCard index={i % BATCH_SIZE} />}
                    <div style={{
                      position: isReady ? "relative" : "absolute",
                      left: isReady ? undefined : "-9999px",
                      width: isReady ? undefined : "400px",
                    }}>
                      <PublicationCard
                        publication={pub}
                        animationDelay={0}
                        shouldAnimate={isReady}
                        onLoaded={() => handleEmbedLoaded(pubKey)}
                        eager={true}
                      />
                    </div>
                  </CardSlot>
                );
              })}
              {loadingMore && Array.from({ length: BATCH_SIZE }).map((_, i) => (
                <SkeletonCard key={`sk-more-${i}`} index={i} />
              ))}
            </MasonryGrid>
            </div>
          )}

          {publications.length > 0 && !loading && !pagination?.hasMore && (
            <div className="text-center py-8">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>No more publications</span>
            </div>
          )}

          <div ref={sentinelRef} className="h-4" />
        </main>
      </div>
    </div>
  );
}

function CardSlot({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>;
}

function MasonryGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const cols: React.ReactNode[][] = [[], [], []];
  items.forEach((item, i) => {
    cols[i % 3].push(item);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start mb-4">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4">
          {col}
        </div>
      ))}
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        animation: `skeletonFadeIn 0.3s ease-out ${index * 60}ms both`,
      }}
    >
      {/* Header: avatar + username + bookmark */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full skeleton-shimmer" style={{ background: "var(--bg-input)" }} />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 rounded-md skeleton-shimmer" style={{ background: "var(--bg-input)", width: "90px" }} />
            <div className="h-2 rounded-md skeleton-shimmer" style={{ background: "var(--bg-input)", width: "55px" }} />
          </div>
        </div>
        <div className="w-5 h-5 rounded skeleton-shimmer" style={{ background: "var(--bg-input)" }} />
      </div>

      {/* Image area */}
      <div className="px-1">
        <div className="rounded-md skeleton-shimmer" style={{ background: "var(--bg-input)", paddingBottom: "100%" }} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-4 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full skeleton-shimmer" style={{ background: "var(--bg-input)" }} />
          <div className="w-6 h-6 rounded-full skeleton-shimmer" style={{ background: "var(--bg-input)" }} />
          <div className="w-6 h-6 rounded-full skeleton-shimmer" style={{ background: "var(--bg-input)" }} />
        </div>
      </div>

      {/* Likes + caption */}
      <div className="px-3 pb-1">
        <div className="h-3 rounded-md skeleton-shimmer" style={{ background: "var(--bg-input)", width: "70px" }} />
      </div>
      <div className="px-3 pb-3">
        <div className="h-2.5 rounded-md skeleton-shimmer mt-2" style={{ background: "var(--bg-input)", width: "60%" }} />
      </div>

      <style jsx>{`
        @keyframes skeletonFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }
        .skeleton-shimmer::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.04) 40%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.04) 60%,
            transparent 100%
          );
          animation: shimmer 1.8s infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

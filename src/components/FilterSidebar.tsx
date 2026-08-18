"use client";

import { useState, useEffect, useCallback } from "react";

interface FilterOption {
  name: string;
  slug: string;
  count: number;
}

interface EntityNameOption {
  name: string;
  count: number;
}

interface Filters {
  sports: FilterOption[];
  entityTypes: FilterOption[];
  formats: FilterOption[];
  platforms: FilterOption[];
  classifications: FilterOption[];
  contentCategories: FilterOption[];
  entityNames: EntityNameOption[];
}

export interface SelectedFilters {
  sport: string[];
  competition: string[];
  entityType: string[];
  entityName: string[];
  format: string[];
  platform: string[];
  classification: string[];
  contentCategory: string[];
  saved: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  order: string;
}

interface FilterSidebarProps {
  filters: SelectedFilters;
  onFiltersChange: (filters: SelectedFilters) => void;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  resultCount?: number;
  userPlan?: string;
}

const FREE_RESTRICTED_CLASSIFICATIONS = new Set([
  "top-picks", "replicable-ideas", "overperforming",
  "collabs-partnerships", "merchandising", "transfers",
]);
const FREE_RESTRICTED_ENTITY_TYPES = new Set(["content-creators"]);

interface SearchResult {
  label: string;
  category: string;
  filterKey: "sport" | "competition" | "entityType" | "entityName" | "format" | "platform" | "classification" | "contentCategory";
  value: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const ENTITY_DISPLAY: Record<string, string> = {
  Brands: "Brand",
  Clubs: "Club",
  Competitions: "Competition",
  "Content Creators": "Creator",
  Media: "Media",
  Players: "Athlete",
};

const HIDDEN_ENTITY_SLUGS = new Set(["meme", "clubs-meme", "content-creators", "ia"]);

const ENTITY_PLURAL: Record<string, string> = {
  brands: "brands",
  clubs: "clubs",
  competitions: "competitions",
  "content-creators": "creators",
  media: "media",
  players: "athletes",
};

type SectionId = "date" | "sport" | "published" | "account" | "contentCategory" | null;

function SkeletonBar({ w = "100%", h = 10, r = 6, opacity = 1 }: { w?: string | number; h?: number; r?: number; opacity?: number }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: r, opacity,
        background: "var(--border-color)",
        animation: "scp-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

function FilterSkeleton() {
  return (
    <>
      <style>{`
        @keyframes scp-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>

      {/* Search bar */}
      <SkeletonBar h={32} r={8} />

      {/* Section: Discover */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <SkeletonBar w={60} h={8} r={4} opacity={0.6} />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <SkeletonBar h={36} r={10} />
        </div>
      ))}

      {/* Section: Content Categories */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <SkeletonBar w={100} h={8} r={4} opacity={0.6} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <SkeletonBar h={36} r={10} />
        </div>
      ))}

      {/* Section: Explore By */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <SkeletonBar w={72} h={8} r={4} opacity={0.6} />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <SkeletonBar h={40} r={10} />
        </div>
      ))}

      {/* Section: Format */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <SkeletonBar w={50} h={8} r={4} opacity={0.6} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBar key={i} h={60} r={10} />
        ))}
      </div>

      {/* Section: Platform */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <SkeletonBar w={60} h={8} r={4} opacity={0.6} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <SkeletonBar key={i} h={52} r={10} />
        ))}
      </div>
    </>
  );
}

export default function FilterSidebar({ filters, onFiltersChange, isOpen, onClose, collapsed, onToggleCollapse, resultCount, userPlan }: FilterSidebarProps) {
  const isFree = !userPlan || userPlan === "free";
  const [filterData, setFilterData] = useState<Filters | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filteredAccounts, setFilteredAccounts] = useState<EntityNameOption[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [showAllSports, setShowAllSports] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId>(null);
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  function guardFree(action: () => void) {
    if (isFree) { setShowUpgradeModal(true); return; }
    action();
  }

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const SELECTOR_TO_SECTION: Record<string, SectionId> = {
      '[data-tutorial="filter-date"]': "date",
      '[data-tutorial="filter-sport"]': "sport",
      '[data-tutorial="filter-published"]': "published",
      '[data-tutorial="filter-account"]': "account",
      '[data-tutorial="filter-contentCategory"]': "contentCategory",
    };
    function onTutorialStep(e: Event) {
      const selector = (e as CustomEvent<{ selector: string | null }>).detail.selector;
      const section = selector ? SELECTOR_TO_SECTION[selector] : null;
      setOpenSection(section ?? null);
    }
    window.addEventListener("tutorial-step", onTutorialStep);
    return () => window.removeEventListener("tutorial-step", onTutorialStep);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.sport.length > 0) params.set("sport", filters.sport.join(","));
    if (filters.entityType.length > 0) params.set("entityType", filters.entityType.join(","));
    if (filters.format.length > 0) params.set("format", filters.format.join(","));
    if (filters.platform.length > 0) params.set("platform", filters.platform.join(","));
    if (filters.classification.length > 0) params.set("classification", filters.classification.join(","));
    if (filters.contentCategory.length > 0) params.set("contentCategory", filters.contentCategory.join(","));
    const qs = params.toString();
    setFiltersLoading(true);
    fetch(`/api/filters${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setFilterData(data);
        setFilteredAccounts(data.entityNames || []);
      })
      .catch(() => {})
      .finally(() => setFiltersLoading(false));
  }, [filters.sport, filters.entityType, filters.format, filters.platform, filters.classification, filters.contentCategory]);

  const toggleArrayFilter = useCallback(
    (key: "sport" | "competition" | "entityType" | "entityName" | "format" | "platform" | "classification" | "contentCategory", value: string) => {
      const current = filters[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ ...filters, [key]: updated });
    },
    [filters, onFiltersChange]
  );

  const clearAll = useCallback(() => {
    onFiltersChange({
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
      order: filters.order,
    });
  }, [onFiltersChange, filters.order]);

  const hasActiveFilters =
    filters.sport.length > 0 ||
    filters.competition.length > 0 ||
    filters.entityType.length > 0 ||
    filters.entityName.length > 0 ||
    filters.format.length > 0 ||
    filters.platform.length > 0 ||
    filters.classification.length > 0 ||
    filters.contentCategory.length > 0 ||
    filters.saved ||
    filters.dateFrom ||
    filters.dateTo;

  const activeFilterCount =
    filters.sport.length +
    filters.competition.length +
    filters.entityType.length +
    filters.entityName.length +
    filters.format.length +
    filters.platform.length +
    filters.classification.length +
    filters.contentCategory.length +
    (filters.saved ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  const filteredEntityNames =
    filteredAccounts.filter(
      (e) => !entitySearch || e.name.toLowerCase().includes(entitySearch.toLowerCase())
    );

  const sportsSorted = filterData?.sports
    ? [...filterData.sports].sort((a, b) => b.count - a.count)
    : [];
  const filteredSports = sportsSorted.filter(
    (s) => !sportSearch || s.name.toLowerCase().includes(sportSearch.toLowerCase())
  );
  const visibleSports = showAllSports || sportSearch ? filteredSports : filteredSports.slice(0, 5);
  const hasHiddenSports = !showAllSports && !sportSearch && filteredSports.length > 5;

  const globalSearchGroups = (() => {
    if (!globalSearch || globalSearch.length < 2 || !filterData) return [];
    const q = globalSearch.toLowerCase();
    const groups: { title: string; results: SearchResult[] }[] = [];

    const accounts: SearchResult[] = [];
    for (const e of filterData.entityNames) {
      if (e.name.toLowerCase().includes(q)) accounts.push({ label: e.name, category: "Account", filterKey: "entityName", value: e.name });
    }
    if (accounts.length > 0) groups.push({ title: "Accounts", results: accounts.slice(0, 5) });

    const topics: SearchResult[] = [];
    for (const c of filterData.classifications) {
      if (c.name.toLowerCase().includes(q)) topics.push({ label: c.name, category: "Topic", filterKey: "classification", value: c.slug });
    }
    for (const s of filterData.sports) {
      if (s.name.toLowerCase().includes(q)) topics.push({ label: s.name, category: "Sport", filterKey: "sport", value: s.slug });
    }
    for (const e of filterData.entityTypes) {
      if (!HIDDEN_ENTITY_SLUGS.has(e.slug) && (e.name.toLowerCase().includes(q) || (ENTITY_DISPLAY[e.name] || "").toLowerCase().includes(q)))
        topics.push({ label: ENTITY_DISPLAY[e.name] || e.name, category: "Publisher type", filterKey: "entityType", value: e.slug });
    }
    for (const f of filterData.formats) {
      if (f.name.toLowerCase().includes(q)) topics.push({ label: f.name, category: "Format", filterKey: "format", value: f.slug });
    }
    for (const cc of filterData.contentCategories) {
      if (cc.name.toLowerCase().includes(q)) topics.push({ label: cc.name, category: "Category", filterKey: "contentCategory", value: cc.slug });
    }
    if (topics.length > 0) groups.push({ title: "Topics", results: topics.slice(0, 8) });

    return groups;
  })();

  const selectSearchResult = useCallback((result: SearchResult) => {
    const current = filters[result.filterKey];
    if (!current.includes(result.value)) {
      onFiltersChange({ ...filters, [result.filterKey]: [...current, result.value] });
    }
    setGlobalSearch("");
  }, [filters, onFiltersChange]);

  // Summaries for closed accordion sections
  const dateSummary = (() => {
    if (!filters.dateFrom && !filters.dateTo) return undefined;
    const presetLabels: Record<string, string> = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 3 months", "365": "Last year" };
    if (filters.dateTo === today()) {
      for (const [days, label] of Object.entries(presetLabels)) {
        if (filters.dateFrom === daysAgo(Number(days))) return label;
      }
    }
    return `${filters.dateFrom || "..."} – ${filters.dateTo || "..."}`;
  })();

  const sportSummary = filters.sport.length > 0
    ? filterData?.sports
        .filter((s) => filters.sport.includes(s.slug))
        .map((s) => s.name)
        .join(", ")
    : "Any sport";

  const publishedSummary = filters.entityType.length > 0
    ? filterData?.entityTypes
        .filter((e) => filters.entityType.includes(e.slug))
        .map((e) => ENTITY_DISPLAY[e.name] || e.name)
        .join(", ")
    : undefined;

  const FIXED_PLATFORMS = [
    { slug: "instagram",      name: "Instagram" },
    { slug: "tiktok",         name: "TikTok" },
    { slug: "youtube",        name: "YouTube" },
    { slug: "youtube-shorts", name: "YT Shorts" },
    { slug: "x",              name: "X" },
    { slug: "facebook",       name: "Facebook" },
    { slug: "pinterest",      name: "Pinterest" },
    { slug: "linkedin",       name: "LinkedIn" },
  ];
  const apiPlatformCounts = new Map((filterData?.platforms ?? []).map((p) => [p.slug, p.count]));
  const allPlatforms = FIXED_PLATFORMS.map((p) => ({ ...p, count: apiPlatformCounts.get(p.slug) ?? 0 }));

  // Content Creators chip
  const ccSlug = "content-creators";
  const ccIsSelected = filters.entityType.includes(ccSlug);

  // Account accordion context
  const typePlurals = filters.entityType.map((slug) => ENTITY_PLURAL[slug]).filter(Boolean);
  const accountSearchPlaceholder = typePlurals.length > 0 ? `Search ${typePlurals.join(", ")}...` : "Search accounts...";
  const contextParts: string[] = [];
  if (filters.sport.length > 0) {
    const sportNames = filterData?.sports?.filter((s) => filters.sport.includes(s.slug)).map((s) => s.name) || [];
    if (sportNames.length > 0) contextParts.push(sportNames.join(", "));
  }
  if (filters.entityType.length > 0) {
    const typeNames = filters.entityType.map((slug) => ENTITY_PLURAL[slug]).filter(Boolean);
    if (typeNames.length > 0) contextParts.push(typeNames.join(", "));
  }
  const accountContextLabel = contextParts.length > 0 ? `Showing ${contextParts.join(" · ")}` : undefined;

  return (
    <>
      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="rounded-2xl p-7 max-w-sm w-full relative"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4 mx-auto"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 className="text-lg font-black text-center mb-2" style={{ color: "var(--text-primary)" }}>
              Funció de pagament
            </h3>
            <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              Aquesta funció requereix un pla Weekly, Basic o Pro. Accedeix a tots els filtres avançats i molt més.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event("open-pricing-sheet"))}
              className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Veure plans
            </button>
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="block w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              Ara no
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      {collapsed && (
        <div
          className="hidden lg:flex sticky top-0 h-screen flex-col items-center py-3"
          style={{
            width: "48px",
            minWidth: "48px",
            background: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ background: "var(--bg-input)" }}
            title="Expand filters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          {hasActiveFilters && (
            <div
              className="mt-2 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full"
              style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
            >
              {activeFilterCount}
            </div>
          )}
        </div>
      )}

      <aside
        data-tutorial="filter-sidebar"
        className={`fixed lg:sticky top-0 left-0 h-screen flex flex-col z-50 lg:z-auto transition-all ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:hidden" : "lg:translate-x-0"}`}
        style={{
          width: "280px",
          minWidth: "280px",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Filters
              {activeFilterCount > 0 && (
                <span className="text-xs font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
                  · {activeFilterCount} active
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="text-[11px] px-2 py-0.5 rounded"
                  style={{ color: "var(--color-charcoal)", background: "rgba(31,41,55,0.1)" }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={onToggleCollapse}
                className="hidden lg:block p-1 rounded transition-colors hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
                title="Collapse filters"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="lg:hidden text-lg"
                style={{ color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>
          </div>

          {!filterData && <FilterSkeleton />}
          <div style={{ display: filterData ? undefined : "none" }}>
          <div data-tutorial="filter-search" className="mb-4 relative">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search clubs, creators or competitions..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setGlobalSearchFocused(true)}
                onBlur={() => setTimeout(() => setGlobalSearchFocused(false), 200)}
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch("")} className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                  &times;
                </button>
              )}
            </div>
            {globalSearchFocused && globalSearchGroups.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10 max-h-72 overflow-y-auto shadow-lg"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                {globalSearchGroups.map((group) => (
                  <div key={group.title}>
                    <div
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
                    >
                      {group.title}
                    </div>
                    {group.results.map((r, i) => {
                      const isActive = filters[r.filterKey].includes(r.value);
                      return (
                        <button
                          key={`${r.filterKey}-${r.value}-${i}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSearchResult(r)}
                          className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors hover:brightness-110"
                          style={{
                            background: isActive ? "rgba(31,41,55,0.15)" : "transparent",
                            color: "var(--text-primary)",
                            borderBottom: "1px solid var(--border-color)",
                          }}
                        >
                          <span className="truncate">{r.label}</span>
                          <span className="shrink-0 ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                            {r.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Discover ──────────────────────────────── */}
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}>Discover</p>

          {/* Quick filter chips — accordion style */}
          {filterData && (
            <div data-tutorial="filter-classification" className="flex flex-col gap-1 mb-3">
              {(["top-picks", "replicable-ideas"] as const).map((slug) => {
                const opt = filterData.classifications.find((c) => c.slug === slug);
                if (!opt) return null;
                const chipConfig: Record<string, { gradient: string; icon: React.ReactNode }> = {
                  "top-picks": {
                    gradient: "linear-gradient(135deg, #E8567A 0%, #A82346 100%)",
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                  },
                  "replicable-ideas": {
                    gradient: "linear-gradient(135deg, #52D68A 0%, #1B8A4E 100%)",
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
                  },
                };
                const { gradient, icon } = chipConfig[slug];
                const isRestricted = isFree && FREE_RESTRICTED_CLASSIFICATIONS.has(slug);
                return (
                  <QuickFilterButton
                    key={opt.slug}
                    label={opt.name}
                    icon={icon}
                    isSelected={filters.classification.includes(opt.slug)}
                    gradient={gradient}
                    locked={isRestricted}
                    onClick={() => isRestricted ? setShowUpgradeModal(true) : toggleArrayFilter("classification", opt.slug)}
                  />
                );
              })}
              <QuickFilterButton
                label="Content Creators"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                isSelected={ccIsSelected}
                gradient="linear-gradient(135deg, #D4A420 0%, #7B4D0B 100%)"
                locked={isFree && FREE_RESTRICTED_ENTITY_TYPES.has(ccSlug)}
                onClick={() => guardFree(() => toggleArrayFilter("entityType", ccSlug))}
              />
              {(() => {
                const opt = filterData.classifications.find((c) => c.slug === "overperforming");
                if (!opt) return null;
                const isRestricted = isFree;
                return (
                  <QuickFilterButton
                    label="Overperforming"
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
                    isSelected={filters.classification.includes("overperforming")}
                    gradient="linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)"
                    locked={isRestricted}
                    onClick={() => isRestricted ? setShowUpgradeModal(true) : toggleArrayFilter("classification", "overperforming")}
                  />
                );
              })()}
            </div>
          )}

          {/* ── Content Categories ────────────────────── */}
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}>Content Categories</p>

          {filterData && (
            <div className="flex flex-col gap-1 mb-3">
              {(["collabs-partnerships", "merchandising", "transfers"] as const).map((slug) => {
                const opt = filterData.classifications.find((c) => c.slug === slug);
                if (!opt) return null;
                const cfg: Record<string, { gradient: string; icon: React.ReactNode; tutorialId: string }> = {
                  "collabs-partnerships": {
                    gradient: "linear-gradient(135deg, #A855F7 0%, #6D28D9 100%)",
                    tutorialId: "filter-collabs",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 11l-4-4-4 4M19 7v8"/>
                      </svg>
                    ),
                  },
                  "merchandising": {
                    gradient: "linear-gradient(135deg, #F97316 0%, #B45309 100%)",
                    tutorialId: "filter-merchandising",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                      </svg>
                    ),
                  },
                  "transfers": {
                    gradient: "linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)",
                    tutorialId: "filter-transfers",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 16V4m0 0L3 8m4-4 4 4"/>
                        <path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
                      </svg>
                    ),
                  },
                };
                const { gradient, icon, tutorialId } = cfg[slug];
                const isRestricted = isFree && FREE_RESTRICTED_CLASSIFICATIONS.has(slug);
                return (
                  <div key={slug} data-tutorial={tutorialId}>
                    <QuickFilterButton
                      label={opt.name}
                      icon={icon}
                      isSelected={filters.classification.includes(slug)}
                      gradient={gradient}
                      locked={isRestricted}
                      onClick={() => isRestricted ? setShowUpgradeModal(true) : toggleArrayFilter("classification", slug)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Explore By ────────────────────────────── */}
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}>Explore By</p>

          {/* Sport — accordion */}
          {filterData?.sports && (
            <AccordionSection
              id="sport"
              tutorialId="filter-sport"
              title="Sport"
              icon="sport"
              open={openSection === "sport"}
              onToggle={() => toggleSection("sport")}
              badge={filters.sport.length}
              summary={sportSummary}
              summaryTags={filters.sport.length > 0
                ? filterData.sports
                    .filter((s) => filters.sport.includes(s.slug))
                    .map((s) => ({ label: s.name, onRemove: () => toggleArrayFilter("sport", s.slug) }))
                : undefined
              }
            >
              <input
                type="text"
                placeholder="Search sport..."
                value={sportSearch}
                onChange={(e) => setSportSearch(e.target.value)}
                className="w-full rounded-md px-2.5 py-1.5 text-xs mb-2"
                style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
              />
              <div className="space-y-0.5">
                {visibleSports.map((opt) => {
                  const isSelected = filters.sport.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("sport", opt.slug)}
                      className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all"
                      style={{
                        background: isSelected ? "var(--selected-bg)" : "transparent",
                        color: isSelected ? "var(--selected-text)" : "var(--text-primary)",
                        border: isSelected ? `1px solid var(--selected-bg)` : "1px solid transparent",
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                        {opt.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
                          color: isSelected ? "rgba(255,255,255,0.9)" : "var(--text-secondary)",
                        }}
                      >
                        {opt.count >= 1000 ? `${(opt.count / 1000).toFixed(1).replace(/\.0$/, "")}K` : opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hasHiddenSports && (
                <button
                  onClick={() => setShowAllSports(true)}
                  className="w-full text-center text-xs mt-2 py-1.5 rounded-md transition-colors"
                  style={{ color: "var(--color-charcoal)", background: "rgba(31,41,55,0.08)" }}
                >
                  Show all sports
                </button>
              )}
            </AccordionSection>
          )}

          {/* Publisher type — accordion */}
          {filterData?.entityTypes && (
            <AccordionSection
              id="published"
              tutorialId="filter-published"
              title="Publisher type"
              icon="entity"
              open={openSection === "published"}
              onToggle={() => toggleSection("published")}
              badge={filters.entityType.length}
              summary={publishedSummary}
            >
              <div className="space-y-0.5">
                {filterData.entityTypes.filter((opt) => !HIDDEN_ENTITY_SLUGS.has(opt.slug)).map((opt) => {
                  const isSelected = filters.entityType.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("entityType", opt.slug)}
                      className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all"
                      style={{
                        background: isSelected ? "var(--selected-bg)" : "transparent",
                        color: isSelected ? "var(--selected-text)" : "var(--text-primary)",
                        border: isSelected ? `1px solid var(--selected-bg)` : "1px solid transparent",
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                        {ENTITY_DISPLAY[opt.name] || opt.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
                          color: isSelected ? "rgba(255,255,255,0.9)" : "var(--text-secondary)",
                        }}
                      >
                        {opt.count >= 1000 ? `${(opt.count / 1000).toFixed(1).replace(/\.0$/, "")}K` : opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* Account — accordion (contextual to sport + publisher type) */}
          <AccordionSection
            id="account"
            tutorialId="filter-account"
            title="Account"
            icon="search"
            open={openSection === "account"}
            onToggle={() => toggleSection("account")}
            badge={filters.entityName.length}
            summary={filters.entityName.length > 0 ? filters.entityName.join(", ") : undefined}
          >
            {accountContextLabel && (
              <div
                className="flex items-center gap-1.5 text-[10px] mb-2 px-2 py-1.5 rounded-md"
                style={{ background: "rgba(31,41,55,0.08)", color: "var(--color-charcoal)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                </svg>
                {accountContextLabel}
              </div>
            )}
            <input
              type="text"
              placeholder={accountSearchPlaceholder}
              value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full rounded-md px-2.5 py-1.5 text-xs mb-2"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                />
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {filteredEntityNames.slice(0, 50).map((e) => {
                    const isSelected = filters.entityName.includes(e.name);
                    return (
                      <button
                        key={e.name}
                        onClick={() => toggleArrayFilter("entityName", e.name)}
                        className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all"
                        style={{
                          background: isSelected ? "var(--selected-bg)" : "transparent",
                          color: isSelected ? "var(--selected-text)" : "var(--text-primary)",
                        }}
                      >
                        <span className="truncate">{e.name}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-1 font-medium"
                          style={{
                            background: isSelected ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
                            color: isSelected ? "rgba(255,255,255,0.9)" : "var(--text-secondary)",
                          }}
                        >
                          {e.count >= 1000 ? `${(e.count / 1000).toFixed(1).replace(/\.0$/, "")}K` : e.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
          </AccordionSection>

          {/* Date range — accordion */}
          <AccordionSection
            id="date"
            tutorialId="filter-date"
            title="Date range"
            icon="calendar"
            open={openSection === "date"}
            onToggle={() => isFree ? setShowUpgradeModal(true) : toggleSection("date")}
            summary={dateSummary}
            badge={filters.dateFrom || filters.dateTo ? 1 : 0}
            locked={isFree}
          >
            <DateRangePresets filters={filters} onFiltersChange={onFiltersChange} />
          </AccordionSection>

          {/* Content category — accordion */}
          {filterData?.contentCategories && filterData.contentCategories.length > 0 && (
            <AccordionSection
              tutorialId="filter-contentCategory"
              id="contentCategory"
              title="Content category"
              icon="category"
              open={openSection === "contentCategory"}
              onToggle={() => toggleSection("contentCategory")}
              badge={filters.contentCategory.length}
              summary={filters.contentCategory.length > 0
                ? filterData.contentCategories
                    .filter((c) => filters.contentCategory.includes(c.slug))
                    .map((c) => c.name)
                    .join(", ")
                : undefined
              }
            >
              <div className="space-y-0.5">
                {filterData.contentCategories.map((opt) => {
                  const isSelected = filters.contentCategory.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("contentCategory", opt.slug)}
                      className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all"
                      style={{
                        background: isSelected ? "var(--selected-bg)" : "transparent",
                        color: isSelected ? "var(--selected-text)" : "var(--text-primary)",
                        border: isSelected ? `1px solid var(--selected-bg)` : "1px solid transparent",
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                        {opt.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
                          color: isSelected ? "rgba(255,255,255,0.9)" : "var(--text-secondary)",
                        }}
                      >
                        {opt.count >= 1000 ? `${(opt.count / 1000).toFixed(1).replace(/\.0$/, "")}K` : opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* Format */}
          {filterData?.formats && (
            <div data-tutorial="filter-format" className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}>Format</p>
              <div className="grid grid-cols-4 gap-2">
                {filterData.formats.map((f) => {
                  const isSelected = filters.format.includes(f.slug);
                  return (
                    <button
                      key={f.slug}
                      onClick={() => toggleArrayFilter("format", f.slug)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
                      style={{
                        background: isSelected ? "rgba(31,41,55,0.08)" : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? "var(--selected-bg)" : "var(--border-color)"}`,
                        transition: "background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(31,41,55,0.06)";
                          e.currentTarget.style.borderColor = "rgba(31,41,55,0.4)";
                        }
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(31,41,55,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? "rgba(31,41,55,0.08)" : "var(--bg-card)";
                        e.currentTarget.style.borderColor = isSelected ? "var(--selected-bg)" : "var(--border-color)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <FormatIcon slug={f.slug} selected={isSelected} />
                      <span className="text-[10px] font-medium" style={{ color: isSelected ? "var(--selected-bg)" : "var(--text-muted)" }}>
                        {f.name}
                      </span>
                    </button>
                  );
                })}
                {/* IA — entity type displayed as a format chip */}
                {(() => {
                  const iaType = filterData.entityTypes.find((e) => e.slug === "ia");
                  const isSelected = filters.entityType.includes("ia");
                  return (
                    <button
                      onClick={() => toggleArrayFilter("entityType", "ia")}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
                      style={{
                        background: isSelected ? "rgba(31,41,55,0.08)" : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? "var(--selected-bg)" : "var(--border-color)"}`,
                        transition: "background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(31,41,55,0.06)";
                          e.currentTarget.style.borderColor = "rgba(31,41,55,0.4)";
                        }
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(31,41,55,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? "rgba(31,41,55,0.08)" : "var(--bg-card)";
                        e.currentTarget.style.borderColor = isSelected ? "var(--selected-bg)" : "var(--border-color)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <FormatIcon slug="ia" selected={isSelected} />
                      <span className="text-[10px] font-medium" style={{ color: isSelected ? "var(--selected-bg)" : "var(--text-muted)" }}>
                        IA
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Platform */}
          <div data-tutorial="platform-filter" className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.14em" }}>Platform</p>
            <div className="grid grid-cols-4 gap-2">
              {allPlatforms.map((p) => {
                  const isSelected = filters.platform.includes(p.slug);
                  const brandColor = PLATFORM_BRAND_COLORS[p.slug] ?? "#1F2937";
                  return (
                    <button
                      key={p.slug}
                      onClick={() => toggleArrayFilter("platform", p.slug)}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl aspect-square"
                      style={{
                        background: isSelected ? `${brandColor}18` : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? brandColor : "var(--border-color)"}`,
                        transition: "background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        setHoveredPlatform(p.slug);
                        e.currentTarget.style.background = `${brandColor}18`;
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = `0 4px 14px ${brandColor}40`;
                      }}
                      onMouseLeave={(e) => {
                        setHoveredPlatform(null);
                        e.currentTarget.style.background = isSelected ? `${brandColor}18` : "var(--bg-card)";
                        e.currentTarget.style.borderColor = isSelected ? brandColor : "var(--border-color)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                    <PlatformIcon slug={p.slug} selected={isSelected} isHovered={hoveredPlatform === p.slug} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saved — below platform icons */}
          <div className="mt-2">
            <button
              onClick={() => isFree ? setShowUpgradeModal(true) : onFiltersChange({ ...filters, saved: filters.saved === "true" ? "" : "true" })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all w-full justify-center relative"
              style={{
                background: filters.saved === "true" ? "var(--selected-bg)" : "var(--bg-card)",
                color: filters.saved === "true" ? "var(--selected-text)" : "var(--text-secondary)",
                border: `1.5px solid ${filters.saved === "true" ? "var(--selected-bg)" : "var(--border-color)"}`,
                opacity: isFree ? 0.6 : 1,
              }}
            >
              {filters.saved === "true" && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill={filters.saved === "true" ? "#fff" : "none"} stroke={filters.saved === "true" ? "#fff" : "var(--text-secondary)"} strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Saved
              {isFree && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 2, opacity: 0.7 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </button>
          </div>
          </div>{/* end display:none wrapper */}

        </div>

        {/* Fixed footer */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
        >
          {hasActiveFilters ? (
            <button
              onClick={clearAll}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{ color: "var(--text-secondary)", background: "var(--bg-input)" }}
            >
              Reset
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-1.5 rounded-md lg:pointer-events-none lg:cursor-default"
            style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
          >
            Show {resultCount !== undefined ? resultCount.toLocaleString() : "..."} ideas
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── Quick Filter Button ─── */

function QuickFilterButton({ label, icon, isSelected, gradient, onClick, locked }: {
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  gradient: string;
  onClick: () => void;
  locked?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const showGradient = !locked && (isSelected || hovered);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all"
      style={{
        background: showGradient ? gradient : "var(--bg-secondary)",
        color: showGradient ? "#fff" : "var(--text-primary)",
        border: `1px solid ${showGradient ? "transparent" : "var(--border-color)"}`,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: showGradient ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>
          {icon}
        </span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      {locked ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ) : isSelected ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hovered ? "rgba(255,255,255,0.7)" : "var(--text-muted)"} strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  );
}

/* ─── Accordion Section ─── */

function AccordionSection({
  title,
  icon,
  badge,
  summary,
  summaryTags,
  open,
  onToggle,
  children,
  tutorialId,
  locked,
}: {
  id: string;
  tutorialId?: string;
  title: string;
  icon?: string;
  badge?: number;
  summary?: string;
  summaryTags?: { label: string; onRemove: () => void }[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  locked?: boolean;
}) {
  const iconSvg = (() => {
    switch (icon) {
      case "sport":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" /></svg>;
      case "entity":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
      case "search":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
      case "sparkles":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>;
      case "calendar":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
      case "category":
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
      default:
        return null;
    }
  })();

  return (
    <div
      className="mb-1 rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border-color)" }}
      {...(tutorialId ? { "data-tutorial": tutorialId } : {})}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors"
        style={{ background: open ? "var(--bg-card)" : "var(--bg-secondary)", opacity: locked ? 0.6 : 1 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {iconSvg && <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{iconSvg}</span>}
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{title}</span>
          {locked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
          {!locked && badge !== undefined && badge > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
              {badge}
            </span>
          )}
          {!open && summaryTags && summaryTags.length > 0 && (
            <div className="flex items-center gap-1 ml-auto pl-2 overflow-hidden">
              {summaryTags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  style={{ background: "rgba(31,41,55,0.15)", color: "var(--color-charcoal)" }}
                >
                  {tag.label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); tag.onRemove(); }}
                    className="hover:opacity-70 ml-0.5 cursor-pointer"
                    style={{ color: "var(--color-charcoal)" }}
                  >
                    &times;
                  </span>
                </span>
              ))}
            </div>
          )}
          {!open && !summaryTags?.length && summary && (
            <span className="text-[10px] truncate ml-auto pl-2" style={{ color: "var(--text-muted)" }}>
              {summary}
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          className="shrink-0 ml-1"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-3 py-2.5" style={{ background: "var(--bg-card)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Format Icons ─── */

function FormatIcon({ slug, selected }: { slug: string; selected: boolean }) {
  const color = selected ? "var(--color-charcoal)" : "var(--text-muted)";
  const size = 28;
  switch (slug) {
    case "carousel":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="4" width="10" height="24" rx="1.5" /><rect x="16" y="4" width="5" height="24" rx="1.5" opacity="0.6" /><rect x="23" y="4" width="5" height="24" rx="1.5" opacity="0.3" /></svg>;
    case "reel":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="6" y="3" width="20" height="26" rx="2" /><path d="M6 9h20M6 15h20" strokeOpacity="0.4" /><polygon points="14,18 14,26 21,22" fill={color} stroke="none" /></svg>;
    case "image":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="6" width="24" height="20" rx="2" /><circle cx="11" cy="13" r="2.5" /><path d="M28 22l-7-7-13 11" strokeLinejoin="round" /></svg>;
    case "video":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="3" y="7" width="20" height="18" rx="2" /><path d="M23 13l6-4v14l-6-4v-6z" fill={color} fillOpacity="0.3" /></svg>;
    case "story":
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="8" y="3" width="16" height="26" rx="3" /><circle cx="16" cy="25" r="1.5" fill={color} stroke="none" /></svg>;
    case "ia":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          {/* Robot/AI head */}
          <rect x="8" y="10" width="16" height="14" rx="3" />
          {/* Eyes */}
          <circle cx="12" cy="16" r="2" fill={color} stroke="none" />
          <circle cx="20" cy="16" r="2" fill={color} stroke="none" />
          {/* Mouth */}
          <path d="M12 21h8" strokeLinecap="round" />
          {/* Antenna */}
          <path d="M16 10V6" strokeLinecap="round" />
          <circle cx="16" cy="5" r="1.5" fill={color} stroke="none" />
          {/* Ears */}
          <path d="M8 16H5M24 16h3" strokeLinecap="round" />
        </svg>
      );
    default:
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="4" width="24" height="24" rx="3" /></svg>;
  }
}

/* ─── Platform brand colors ─── */

const PLATFORM_BRAND_COLORS: Record<string, string> = {
  instagram:      "#E1306C",
  tiktok:         "#010101",
  facebook:       "#1877F2",
  twitter:        "#000000",
  x:              "#000000",
  linkedin:       "#0A66C2",
  youtube:        "#FF0000",
  "youtube-shorts": "#FF0000",
  snapchat:       "#FFFC00",
  reddit:         "#FF4500",
  threads:        "#000000",
  pinterest:      "#E60023",
};

/* ─── Platform Icons ─── */

function PlatformIcon({ slug, selected, isHovered }: { slug: string; selected: boolean; isHovered?: boolean }) {
  const muted = "var(--text-muted)";
  const active = selected || isHovered;
  switch (slug) {
    case "instagram":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id={`ig-g-${active}`} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#dc2743" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" stroke={active ? `url(#ig-g-${active})` : muted} strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="4.5" stroke={active ? `url(#ig-g-${active})` : muted} strokeWidth="2" fill="none" />
          <circle cx="18" cy="6" r="1.2" fill={active ? `url(#ig-g-${active})` : muted} />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          {active ? (
            <>
              <path d="M18.6 4h-3.4v17.5a3.5 3.5 0 1 1-3.5-3.5c.4 0 .8.05 1.1.15V14.5a7.2 7.2 0 0 0-1.1-.08 7.08 7.08 0 1 0 7.08 7.08V13.7A10.3 10.3 0 0 0 25 15.7v-3.64a6.67 6.67 0 0 1-6.4-8.06z" fill="#25F4EE" />
              <path d="M19.8 5.2h-3.4V22.7a3.5 3.5 0 1 1-3.5-3.5c.4 0 .8.05 1.1.15V15.7a7.2 7.2 0 0 0-1.1-.08A7.08 7.08 0 1 0 20 22.7V14.9a10.3 10.3 0 0 0 6.2 2v-3.64a6.67 6.67 0 0 1-6.4-8.06z" fill="#FE2C55" />
              <path d="M19.2 4.6h-3.4V22.1a3.5 3.5 0 1 1-3.5-3.5c.4 0 .8.05 1.1.15V15.1a7.2 7.2 0 0 0-1.1-.08 7.08 7.08 0 1 0 7.08 7.08V14.3a10.3 10.3 0 0 0 6.2 2v-3.64a6.67 6.67 0 0 1-6.4-8.06z" fill="var(--text-primary)" />
            </>
          ) : (
            <path d="M19.2 4.6h-3.4V22.1a3.5 3.5 0 1 1-3.5-3.5c.4 0 .8.05 1.1.15V15.1a7.2 7.2 0 0 0-1.1-.08 7.08 7.08 0 1 0 7.08 7.08V14.3a10.3 10.3 0 0 0 6.2 2v-3.64a6.67 6.67 0 0 1-6.4-8.06z" fill={muted} />
          )}
        </svg>
      );
    case "facebook":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill={active ? "#1877F2" : muted} />
        </svg>
      );
    case "twitter":
    case "x":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill={active ? "var(--text-primary)" : muted} />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill={active ? "#0A66C2" : muted} />
        </svg>
      );
    case "youtube":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill={active ? "#FF0000" : muted} />
          <path d="M9.545 15.568V8.432L15.818 12z" fill={active ? "#fff" : "var(--bg-card)"} />
        </svg>
      );
    case "youtube-shorts": {
      const c = active ? "#FF0000" : muted;
      const pw = active ? "white" : "var(--bg-card)";
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="8.5" rx="4.25" fill={c} transform="rotate(-26 12 7.25)" />
          <rect x="2" y="12.5" width="20" height="8.5" rx="4.25" fill={c} transform="rotate(26 12 16.75)" />
          <polygon points="9.5,9.5 9.5,14.5 16,12" fill={pw} />
        </svg>
      );
    }
    case "pinterest":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            fill={active ? "#E60023" : muted}
            fillRule="evenodd"
            d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.372 12-12S18.627 0 12 0z"
          />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--text-primary)" : muted} strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
        </svg>
      );
  }
}

/* ─── Custom Calendar ─── */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function CustomCalendar({ dateFrom, dateTo, onChange }: {
  dateFrom: string; dateTo: string;
  onChange: (from: string, to: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const ref = dateFrom || dateTo;
    return ref ? new Date(ref + "T00:00:00") : new Date();
  });
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-start: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const todayStr = toISO(new Date());

  const days: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ iso: toISO(new Date(year, month, d)), day: d });
  }
  while (days.length % 7 !== 0) days.push(null);

  function handleDayClick(iso: string) {
    if (!dateFrom || (dateFrom && dateTo) || iso < dateFrom) {
      onChange(iso, "");
      setSelectingEnd(true);
    } else {
      onChange(dateFrom, iso);
      setSelectingEnd(false);
    }
  }

  function inRange(iso: string) {
    const end = selectingEnd && hovered ? hovered : dateTo;
    if (!dateFrom || !end) return false;
    const lo = dateFrom < end ? dateFrom : end;
    const hi = dateFrom < end ? end : dateFrom;
    return iso > lo && iso < hi;
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const displayTo = selectingEnd && hovered ? hovered : dateTo;

  return (
    <div style={{ userSelect: "none" }}>
      {/* Selected range display */}
      {(dateFrom || dateTo) && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold"
            style={{ background: dateFrom ? "var(--selected-bg)" : "var(--bg-input)", color: dateFrom ? "var(--selected-text)" : "var(--text-muted)", border: `1px solid ${dateFrom ? "var(--selected-bg)" : "var(--border-color)"}` }}>
            {dateFrom ? dateFrom.split("-").reverse().join("/") : "From"}
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          <div className="flex-1 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold"
            style={{ background: displayTo ? "var(--selected-bg)" : "var(--bg-input)", color: displayTo ? "var(--selected-text)" : "var(--text-muted)", border: `1px solid ${displayTo ? "var(--selected-bg)" : "var(--border-color)"}` }}>
            {displayTo ? displayTo.split("-").reverse().join("/") : "To"}
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="flex items-center justify-center rounded-lg transition-all hover:opacity-70"
          style={{ width: 26, height: 26, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="flex items-center justify-center rounded-lg transition-all hover:opacity-70"
          style={{ width: 26, height: 26, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const isFrom = d.iso === dateFrom;
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
                borderRadius: isSelected ? 8 : isInRange ? 0 : 8,
                background: isSelected ? "var(--selected-bg)" : isInRange ? "rgba(31,41,55,0.1)" : "transparent",
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

      {/* Clear */}
      {(dateFrom || dateTo) && (
        <button
          onClick={() => { onChange("", ""); setSelectingEnd(false); setHovered(null); }}
          className="w-full mt-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
        >
          Clear dates
        </button>
      )}
    </div>
  );
}

/* ─── Date Range Presets (compact 2-col grid) ─── */

function DateRangePresets({ filters, onFiltersChange }: { filters: SelectedFilters; onFiltersChange: (f: SelectedFilters) => void }) {
  const [mounted, setMounted] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  useEffect(() => setMounted(true), []);

  const presets = mounted
    ? [
        { label: "Any time", from: "", to: "" },
        { label: "Last 7 days", from: daysAgo(7), to: today() },
        { label: "Last 30 days", from: daysAgo(30), to: today(), recommended: true },
        { label: "Last 3 months", from: daysAgo(90), to: today() },
        { label: "Last year", from: daysAgo(365), to: today() },
      ]
    : [{ label: "Any time", from: "", to: "", recommended: false }];

  const isCustom = mounted && (filters.dateFrom || filters.dateTo) && !presets.some((p) => p.from === filters.dateFrom && p.to === filters.dateTo);

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {presets.map((preset) => {
          const isActive = filters.dateFrom === preset.from && filters.dateTo === preset.to;
          return (
            <button
              key={preset.label}
              onClick={() => {
                onFiltersChange({ ...filters, dateFrom: preset.from, dateTo: preset.to });
                setShowCustom(false);
              }}
              className="relative px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-center"
              style={{
                background: isActive ? "var(--selected-bg)" : "var(--bg-input)",
                color: isActive ? "var(--selected-text)" : "var(--text-primary)",
                border: `1px solid ${isActive ? "var(--selected-bg)" : "var(--border-color)"}`,
              }}
            >
              {preset.label}
              {preset.recommended && !isActive && (
                <span className="absolute -top-1.5 -right-1 text-[8px] px-1 rounded-full" style={{ background: "rgba(31,41,55,0.2)", color: "var(--color-charcoal)" }}>
                  rec
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-center"
          style={{
            background: isCustom || showCustom ? "var(--selected-bg)" : "var(--bg-input)",
            color: isCustom || showCustom ? "var(--selected-text)" : "var(--text-primary)",
            border: `1px solid ${isCustom || showCustom ? "var(--selected-bg)" : "var(--border-color)"}`,
          }}
        >
          Custom
        </button>
      </div>
      {(showCustom || isCustom) && (
        <div className="rounded-xl p-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
          <CustomCalendar
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(from, to) => onFiltersChange({ ...filters, dateFrom: from, dateTo: to })}
          />
        </div>
      )}
    </>
  );
}

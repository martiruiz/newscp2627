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
}

interface SearchResult {
  label: string;
  category: string;
  filterKey: "sport" | "competition" | "entityType" | "entityName" | "format" | "platform" | "classification";
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

const HIDDEN_ENTITY_SLUGS = new Set(["meme", "clubs-meme"]);

const ENTITY_PLURAL: Record<string, string> = {
  brands: "brands",
  clubs: "clubs",
  competitions: "competitions",
  "content-creators": "creators",
  media: "media",
  players: "athletes",
};

type SectionId = "date" | "smart" | "sport" | "published" | "account" | null;

export default function FilterSidebar({ filters, onFiltersChange, isOpen, onClose, collapsed, onToggleCollapse, resultCount }: FilterSidebarProps) {
  const [filterData, setFilterData] = useState<Filters | null>(null);
  const [filteredAccounts, setFilteredAccounts] = useState<EntityNameOption[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [showAllSports, setShowAllSports] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId>(null);

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.sport.length > 0) params.set("sport", filters.sport.join(","));
    if (filters.entityType.length > 0) params.set("entityType", filters.entityType.join(","));
    if (filters.format.length > 0) params.set("format", filters.format.join(","));
    if (filters.platform.length > 0) params.set("platform", filters.platform.join(","));
    if (filters.classification.length > 0) params.set("classification", filters.classification.join(","));
    const qs = params.toString();
    fetch(`/api/filters${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setFilterData(data);
        setFilteredAccounts(data.entityNames || []);
      })
      .catch(() => {});
  }, [filters.sport, filters.entityType, filters.format, filters.platform, filters.classification]);

  const toggleArrayFilter = useCallback(
    (key: "sport" | "competition" | "entityType" | "entityName" | "format" | "platform" | "classification", value: string) => {
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

  return (
    <>
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
              style={{ background: "#c89028", color: "#fff" }}
            >
              {activeFilterCount}
            </div>
          )}
        </div>
      )}

      <aside
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
                  style={{ color: "#c89028", background: "rgba(200,144,40,0.1)" }}
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

          {/* Global search */}
          <div className="mb-4 relative">
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
                placeholder="Search accounts, topics or ideas..."
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
                            background: isActive ? "rgba(200,144,40,0.15)" : "transparent",
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

          {/* Date range — accordion */}
          <AccordionSection
            id="date"
            title="Date range"
            icon="calendar"
            open={openSection === "date"}
            onToggle={() => toggleSection("date")}
            summary={dateSummary}
            badge={filters.dateFrom || filters.dateTo ? 1 : 0}
          >
            <DateRangePresets filters={filters} onFiltersChange={onFiltersChange} />
          </AccordionSection>

          {/* Smart Filters */}
          {filterData?.classifications && filterData.classifications.length > 0 && (
            <AccordionSection
              id="smart"
              title="Smart Filters"
              icon="sparkles"
              open={openSection === "smart"}
              onToggle={() => toggleSection("smart")}
              badge={filters.classification.length}
            >
              <div className="flex flex-wrap gap-1.5">
                {filterData.classifications.map((opt) => {
                  const colors: Record<string, string> = {
                    "top-picks": "var(--badge-top)",
                    "replicable-ideas": "var(--badge-replicable)",
                    overperforming: "var(--badge-overperforming)",
                  };
                  const isSelected = filters.classification.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("classification", opt.slug)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: isSelected ? colors[opt.slug] || "#c89028" : "var(--bg-input)",
                        color: isSelected ? "#fff" : "var(--text-secondary)",
                        border: `1.5px solid ${isSelected ? "rgba(255,255,255,0.3)" : "var(--border-color)"}`,
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* Sport — accordion */}
          {filterData?.sports && (
            <AccordionSection
              id="sport"
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
                        background: isSelected ? "#c89028" : "transparent",
                        color: isSelected ? "#fff" : "var(--text-primary)",
                        border: isSelected ? "1px solid #e0a832" : "1px solid transparent",
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
                  style={{ color: "#c89028", background: "rgba(200,144,40,0.08)" }}
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
              title="Publisher type"
              icon="entity"
              open={openSection === "published"}
              onToggle={() => toggleSection("published")}
              badge={filters.entityType.length}
              summary={publishedSummary}
            >
              <div className="flex flex-wrap gap-1.5">
                {filterData.entityTypes.filter((opt) => !HIDDEN_ENTITY_SLUGS.has(opt.slug)).map((opt) => {
                  const isSelected = filters.entityType.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("entityType", opt.slug)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: isSelected ? "#c89028" : "var(--bg-input)",
                        color: isSelected ? "#fff" : "var(--text-secondary)",
                        border: `1.5px solid ${isSelected ? "#e0a832" : "var(--border-color)"}`,
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                      {ENTITY_DISPLAY[opt.name] || opt.name}
                    </button>
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* Account — accordion (contextual to sport + publisher type) */}
          {(() => {
            const typePlurals = filters.entityType
              .map((slug) => ENTITY_PLURAL[slug])
              .filter(Boolean);
            const searchPlaceholder = typePlurals.length > 0
              ? `Search ${typePlurals.join(", ")}...`
              : "Search accounts...";

            const contextParts: string[] = [];
            if (filters.sport.length > 0) {
              const sportNames = filterData?.sports
                ?.filter((s) => filters.sport.includes(s.slug))
                .map((s) => s.name) || [];
              if (sportNames.length > 0) contextParts.push(sportNames.join(", "));
            }
            if (filters.entityType.length > 0) {
              const typeNames = filters.entityType
                .map((slug) => ENTITY_PLURAL[slug])
                .filter(Boolean);
              if (typeNames.length > 0) contextParts.push(typeNames.join(", "));
            }
            const contextLabel = contextParts.length > 0
              ? `Showing ${contextParts.join(" · ")}`
              : undefined;

            return (
              <AccordionSection
                id="account"
                title="Account"
                icon="search"
                open={openSection === "account"}
                onToggle={() => toggleSection("account")}
                badge={filters.entityName.length}
                summary={filters.entityName.length > 0 ? filters.entityName.join(", ") : undefined}
              >
                {contextLabel && (
                  <div
                    className="flex items-center gap-1.5 text-[10px] mb-2 px-2 py-1.5 rounded-md"
                    style={{ background: "rgba(200,144,40,0.08)", color: "#c89028" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                    </svg>
                    {contextLabel}
                  </div>
                )}
                <input
                  type="text"
                  placeholder={searchPlaceholder}
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
                          background: isSelected ? "#c89028" : "transparent",
                          color: isSelected ? "#fff" : "var(--text-primary)",
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
            );
          })()}

          {/* Format */}
          {filterData?.formats && (
            <div className="mb-3">
              <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Format</h3>
              <div className="grid grid-cols-4 gap-2">
                {filterData.formats.map((f) => {
                  const isSelected = filters.format.includes(f.slug);
                  return (
                    <button
                      key={f.slug}
                      onClick={() => toggleArrayFilter("format", f.slug)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all"
                      style={{
                        background: isSelected ? "var(--bg-hover)" : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? "#c89028" : "var(--border-color)"}`,
                      }}
                    >
                      <FormatIcon slug={f.slug} selected={isSelected} />
                      <span className="text-[10px] font-medium" style={{ color: isSelected ? "#c89028" : "var(--text-muted)" }}>
                        {f.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform */}
          {filterData?.platforms && (
            <div className="mb-3">
              <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Platform</h3>
              <div className="grid grid-cols-4 gap-2">
                {filterData.platforms.map((p) => {
                  const isSelected = filters.platform.includes(p.slug);
                  return (
                    <button
                      key={p.slug}
                      onClick={() => toggleArrayFilter("platform", p.slug)}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl transition-all aspect-square"
                      style={{
                        background: isSelected ? "var(--bg-hover)" : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? "#c89028" : "var(--border-color)"}`,
                      }}
                    >
                      <PlatformIcon slug={p.slug} selected={isSelected} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved toggle */}
          <div className="mt-3 mb-2">
            <button
              onClick={() => onFiltersChange({ ...filters, saved: filters.saved === "true" ? "" : "true" })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
            >
              <div
                className="relative shrink-0 rounded-full transition-all"
                style={{ width: "36px", height: "20px", background: filters.saved === "true" ? "#c89028" : "var(--border-color)" }}
              >
                <div
                  className="absolute top-[2px] rounded-full bg-white transition-all"
                  style={{ width: "16px", height: "16px", left: filters.saved === "true" ? "18px" : "2px" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={filters.saved === "true" ? "#c89028" : "none"} stroke={filters.saved === "true" ? "#c89028" : "var(--text-secondary)"} strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ color: "var(--text-primary)" }}>Saved content only</span>
              </div>
            </button>
          </div>
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
            style={{ background: "#c89028", color: "#fff" }}
          >
            Show {resultCount !== undefined ? resultCount.toLocaleString() : "..."} ideas
          </button>
        </div>
      </aside>
    </>
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
}: {
  id: string;
  title: string;
  icon?: string;
  badge?: number;
  summary?: string;
  summaryTags?: { label: string; onRemove: () => void }[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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
      default:
        return null;
    }
  })();

  return (
    <div className="mb-1 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors"
        style={{ background: open ? "var(--bg-card)" : "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {iconSvg && <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{iconSvg}</span>}
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#c89028", color: "#fff" }}>
              {badge}
            </span>
          )}
          {!open && summaryTags && summaryTags.length > 0 && (
            <div className="flex items-center gap-1 ml-auto pl-2 overflow-hidden">
              {summaryTags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  style={{ background: "rgba(200,144,40,0.15)", color: "#c89028" }}
                >
                  {tag.label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); tag.onRemove(); }}
                    className="hover:opacity-70 ml-0.5 cursor-pointer"
                    style={{ color: "#c89028" }}
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
  const color = selected ? "#c89028" : "var(--text-muted)";
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
    default:
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5"><rect x="4" y="4" width="24" height="24" rx="3" /></svg>;
  }
}

/* ─── Platform Icons ─── */

function PlatformIcon({ slug, selected }: { slug: string; selected: boolean }) {
  const muted = "var(--text-muted)";
  switch (slug) {
    case "instagram":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id={`ig-g-${selected}`} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#dc2743" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" stroke={selected ? `url(#ig-g-${selected})` : muted} strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="4.5" stroke={selected ? `url(#ig-g-${selected})` : muted} strokeWidth="2" fill="none" />
          <circle cx="18" cy="6" r="1.2" fill={selected ? `url(#ig-g-${selected})` : muted} />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          {selected ? (
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
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill={selected ? "#1877F2" : muted} />
        </svg>
      );
    case "twitter":
    case "x":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill={selected ? "var(--text-primary)" : muted} />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" fill={selected ? "#0A66C2" : muted} />
        </svg>
      );
    case "youtube":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill={selected ? "#FF0000" : muted} />
          <path d="M9.545 15.568V8.432L15.818 12z" fill={selected ? "#fff" : "var(--bg-card)"} />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={selected ? "var(--text-primary)" : muted} strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
        </svg>
      );
  }
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
      <div className="grid grid-cols-2 gap-1.5 mb-2">
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
                background: isActive ? "#c89028" : "var(--bg-input)",
                color: isActive ? "#fff" : "var(--text-primary)",
                border: `1px solid ${isActive ? "#e0a832" : "var(--border-color)"}`,
              }}
            >
              {preset.label}
              {preset.recommended && !isActive && (
                <span className="absolute -top-1.5 -right-1 text-[8px] px-1 rounded-full" style={{ background: "rgba(200,144,40,0.2)", color: "#c89028" }}>
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
            background: isCustom ? "#c89028" : "var(--bg-input)",
            color: isCustom ? "#fff" : "var(--text-primary)",
            border: `1px solid ${isCustom ? "#e0a832" : "var(--border-color)"}`,
          }}
        >
          Custom
        </button>
      </div>
      {(showCustom || isCustom) && (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="w-full rounded-md px-2.5 py-2 text-xs"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="w-full rounded-md px-2.5 py-2 text-xs"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
            />
          </div>
        </div>
      )}
    </>
  );
}

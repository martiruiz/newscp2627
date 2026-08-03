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
}

interface SearchResult {
  label: string;
  category: string;
  filterKey: "sport" | "competition" | "entityType" | "entityName" | "format" | "platform" | "classification";
  value: string;
}

export default function FilterSidebar({ filters, onFiltersChange, isOpen, onClose, collapsed, onToggleCollapse }: FilterSidebarProps) {
  const [filterData, setFilterData] = useState<Filters | null>(null);
  const [filteredAccounts, setFilteredAccounts] = useState<EntityNameOption[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [showAllSports, setShowAllSports] = useState(false);

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

  const setFilter = useCallback(
    (key: keyof SelectedFilters, value: string) => {
      onFiltersChange({ ...filters, [key]: value });
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
      order: "latest",
    });
  }, [onFiltersChange]);

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

  const globalSearchResults = (() => {
    if (!globalSearch || globalSearch.length < 2 || !filterData) return [];
    const q = globalSearch.toLowerCase();
    const results: SearchResult[] = [];

    for (const s of filterData.sports) {
      if (s.name.toLowerCase().includes(q)) results.push({ label: s.name, category: "Sport", filterKey: "sport", value: s.slug });
    }
    for (const e of filterData.entityNames) {
      if (e.name.toLowerCase().includes(q)) results.push({ label: e.name, category: "Account", filterKey: "entityName", value: e.name });
    }
    for (const e of filterData.entityTypes) {
      const dn: Record<string, string> = { "Brands": "Brand", "Clubs": "Club", "Competitions": "Competition", "Content Creators": "Creator", "Media": "Media", "Meme": "Meme", "Players": "Athlete" };
      if (e.name.toLowerCase().includes(q) || (dn[e.name] || "").toLowerCase().includes(q)) results.push({ label: dn[e.name] || e.name, category: "Published by", filterKey: "entityType", value: e.slug });
    }
    for (const f of filterData.formats) {
      if (f.name.toLowerCase().includes(q)) results.push({ label: f.name, category: "Format", filterKey: "format", value: f.slug });
    }
    for (const c of filterData.classifications) {
      if (c.name.toLowerCase().includes(q)) results.push({ label: c.name, category: "Category", filterKey: "classification", value: c.slug });
    }

    return results.slice(0, 15);
  })();

  const selectSearchResult = useCallback((result: SearchResult) => {
    const current = filters[result.filterKey];
    if (!current.includes(result.value)) {
      onFiltersChange({ ...filters, [result.filterKey]: [...current, result.value] });
    }
    setGlobalSearch("");
  }, [filters, onFiltersChange]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Collapsed sidebar — desktop only */}
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
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              {
                filters.sport.length +
                filters.competition.length +
                filters.entityType.length +
                filters.entityName.length +
                filters.format.length +
                filters.platform.length +
                filters.classification.length +
                (filters.saved ? 1 : 0)
              }
            </div>
          )}
        </div>
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen overflow-y-auto z-50 lg:z-auto transition-all ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:hidden" : "lg:translate-x-0"}`}
        style={{
          width: "280px",
          minWidth: "280px",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Filters
            </h2>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--accent-blue)", background: "rgba(59,130,246,0.1)" }}
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
          <div className="mb-5 relative">
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
                placeholder="Search clubs, creators or ideas..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setGlobalSearchFocused(true)}
                onBlur={() => setTimeout(() => setGlobalSearchFocused(false), 200)}
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="shrink-0 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  &times;
                </button>
              )}
            </div>
            {globalSearchFocused && globalSearchResults.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10 max-h-64 overflow-y-auto shadow-lg"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                {globalSearchResults.map((r, i) => {
                  const isActive = filters[r.filterKey].includes(r.value);
                  return (
                    <button
                      key={`${r.filterKey}-${r.value}-${i}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSearchResult(r)}
                      className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors hover:brightness-110"
                      style={{
                        background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <span className="truncate">{r.label}</span>
                      <span
                        className="shrink-0 ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                      >
                        {r.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sort by */}
          <div className="mb-5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Sort by
            </label>
            <div className="flex gap-1.5">
              {["random", "latest"].map((o) => (
                <button
                  key={o}
                  onClick={() => setFilter("order", o)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: filters.order === o ? "var(--accent-blue)" : "var(--bg-input)",
                    color: filters.order === o ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${filters.order === o ? "var(--accent-blue)" : "var(--border-color)"}`,
                  }}
                >
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <CollapsibleSection title="Date range" defaultOpen={false} icon="calendar">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="w-full rounded-md px-2 py-1.5 text-xs"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="w-full rounded-md px-2 py-1.5 text-xs"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Smart Filters */}
          {filterData?.classifications && filterData.classifications.length > 0 && (
            <CollapsibleSection title="Smart Filters" icon="sparkles" badge={filters.classification.length}>
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
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: isSelected ? colors[opt.slug] || "var(--accent-blue)" : "var(--bg-input)",
                        color: isSelected ? "#fff" : "var(--text-secondary)",
                        border: `1px solid ${isSelected ? "transparent" : "var(--border-color)"}`,
                      }}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Sport */}
          {filterData?.sports && (
            <CollapsibleSection
              title="Sport"
              icon="sport"
              badge={filters.sport.length}
              defaultOpen={false}
              summary={filters.sport.length > 0
                ? filterData.sports
                    .filter((s) => filters.sport.includes(s.slug))
                    .map((s) => s.name)
                    .join(", ")
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
                        background: isSelected ? "var(--accent-blue)" : "transparent",
                        color: isSelected ? "#fff" : "var(--text-primary)",
                      }}
                    >
                      <span>{opt.name}</span>
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
                  style={{ color: "var(--accent-blue)", background: "rgba(59,130,246,0.08)" }}
                >
                  Show all sports
                </button>
              )}
            </CollapsibleSection>
          )}

          {/* Published by */}
          {filterData?.entityTypes && (
            <CollapsibleSection title="Published by" icon="entity" badge={filters.entityType.length}>
              <div className="flex flex-wrap gap-1.5">
                {filterData.entityTypes.map((opt) => {
                  const displayName: Record<string, string> = {
                    "Brands": "Brand",
                    "Clubs": "Club",
                    "Competitions": "Competition",
                    "Content Creators": "Creator",
                    "Media": "Media",
                    "Meme": "Meme",
                    "Players": "Athlete",
                  };
                  const isSelected = filters.entityType.includes(opt.slug);
                  return (
                    <button
                      key={opt.slug}
                      onClick={() => toggleArrayFilter("entityType", opt.slug)}
                      className="px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: isSelected ? "var(--accent-blue)" : "var(--bg-input)",
                        color: isSelected ? "#fff" : "var(--text-secondary)",
                        border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-color)"}`,
                      }}
                    >
                      {displayName[opt.name] || opt.name}
                      {isSelected && " ×"}
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Account */}
          <CollapsibleSection title="Account" icon="search" badge={filters.entityName.length} defaultOpen={false}>
            {(filters.sport.length > 0 || filters.entityType.length > 0) && (
              <div className="text-[10px] mb-2 px-1" style={{ color: "var(--text-muted)" }}>
                Filtered by {[
                  filters.sport.length > 0 && filterData?.sports
                    ?.filter((s) => filters.sport.includes(s.slug))
                    .map((s) => s.name)
                    .join(", "),
                  filters.entityType.length > 0 && filterData?.entityTypes
                    ?.filter((e) => filters.entityType.includes(e.slug))
                    .map((e) => {
                      const dn: Record<string, string> = { "Brands": "Brand", "Clubs": "Club", "Competitions": "Competition", "Content Creators": "Creator", "Media": "Media", "Meme": "Meme", "Players": "Athlete" };
                      return dn[e.name] || e.name;
                    })
                    .join(", "),
                ].filter(Boolean).join(" + ")}
              </div>
            )}
            <input
              type="text"
              placeholder="Search account..."
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
                      background: isSelected ? "var(--accent-blue)" : "transparent",
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
          </CollapsibleSection>

          {/* Format */}
          {filterData?.formats && (
            <div className="mb-3">
              <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Format
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {filterData.formats.map((f) => {
                  const isSelected = filters.format.includes(f.slug);
                  return (
                    <button
                      key={f.slug}
                      onClick={() => toggleArrayFilter("format", f.slug)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                      style={{
                        background: isSelected ? "var(--bg-hover)" : "var(--bg-card)",
                        border: `1.5px solid ${isSelected ? "#c89028" : "var(--border-color)"}`,
                      }}
                    >
                      <FormatIcon slug={f.slug} selected={isSelected} />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: isSelected ? "#c89028" : "var(--text-muted)" }}
                      >
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
              <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Platform
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {filterData.platforms.map((p) => {
                  const isSelected = filters.platform.includes(p.slug);
                  return (
                    <button
                      key={p.slug}
                      onClick={() => toggleArrayFilter("platform", p.slug)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl transition-all aspect-square"
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

          {/* Saved */}
          <div className="mt-4 mb-2">
            <button
              onClick={() => setFilter("saved", filters.saved === "true" ? "" : "true")}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: filters.saved === "true" ? "var(--accent-blue)" : "var(--bg-input)",
                color: filters.saved === "true" ? "#fff" : "var(--text-primary)",
                border: `1px solid ${filters.saved === "true" ? "var(--accent-blue)" : "var(--border-color)"}`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={filters.saved === "true" ? "#fff" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Saved only
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = true,
  summary,
  children,
}: {
  title: string;
  icon?: string;
  badge?: number;
  defaultOpen?: boolean;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const iconSvg = (() => {
    switch (icon) {
      case "sport":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
          </svg>
        );
      case "entity":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "trophy":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V8M14 22V8M8 6h8a2 2 0 0 0 2-2V2H6v2a2 2 0 0 0 2 2z" />
          </svg>
        );
      case "search":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        );
      case "format":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        );
      case "platform":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
        );
      case "sparkles":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
          </svg>
        );
      case "calendar":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className="mb-1 rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border-color)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors"
        style={{ background: open ? "var(--bg-card)" : "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2">
          {iconSvg && <span style={{ color: "var(--text-muted)" }}>{iconSvg}</span>}
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              {badge}
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!open && summary && (
        <div className="px-3 py-1.5" style={{ background: "var(--bg-secondary)" }}>
          <span className="text-[10px] truncate block" style={{ color: "var(--text-muted)" }}>
            {summary}
          </span>
        </div>
      )}
      {open && (
        <div className="px-3 py-2.5" style={{ background: "var(--bg-card)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FormatIcon({ slug, selected }: { slug: string; selected: boolean }) {
  const color = selected ? "#c89028" : "var(--text-muted)";
  const size = 32;
  switch (slug) {
    case "carousel":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="4" y="4" width="10" height="24" rx="1.5" />
          <rect x="16" y="4" width="5" height="24" rx="1.5" opacity="0.6" />
          <rect x="23" y="4" width="5" height="24" rx="1.5" opacity="0.3" />
        </svg>
      );
    case "reel":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="6" y="3" width="20" height="26" rx="2" />
          <path d="M6 9h20M6 15h20" strokeOpacity="0.4" />
          <polygon points="14,18 14,26 21,22" fill={color} stroke="none" />
        </svg>
      );
    case "image":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="4" y="6" width="24" height="20" rx="2" />
          <circle cx="11" cy="13" r="2.5" />
          <path d="M28 22l-7-7-13 11" strokeLinejoin="round" />
        </svg>
      );
    case "video":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="3" y="7" width="20" height="18" rx="2" />
          <path d="M23 13l6-4v14l-6-4v-6z" fill={color} fillOpacity="0.3" />
        </svg>
      );
    case "story":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="8" y="3" width="16" height="26" rx="3" />
          <circle cx="16" cy="25" r="1.5" fill={color} stroke="none" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
          <rect x="4" y="4" width="24" height="24" rx="3" />
        </svg>
      );
  }
}

function PlatformIcon({ slug, selected }: { slug: string; selected: boolean }) {
  const borderColor = selected ? "#c89028" : "none";
  const size = 34;
  void borderColor;
  switch (slug) {
    case "instagram":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <defs>
            <radialGradient id={`ig-${selected}`} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#dc2743" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="4" y="4" width="26" height="26" rx="7" stroke={selected ? `url(#ig-${selected})` : "var(--text-muted)"} strokeWidth="2" />
          <circle cx="17" cy="17" r="6" stroke={selected ? `url(#ig-${selected})` : "var(--text-muted)"} strokeWidth="2" />
          <circle cx="24.5" cy="9.5" r="1.8" fill={selected ? `url(#ig-${selected})` : "var(--text-muted)"} />
        </svg>
      );
    case "tiktok":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <path d="M12 28c-3.3 0-6-2.7-6-6s2.7-6 6-6v4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2V6h4c0 3.3 2.7 6 6 6v4c-2.2 0-4.2-.7-6-2v8c0 3.3-2.7 6-6 6z"
            fill={selected ? "var(--text-primary)" : "var(--text-muted)"} />
        </svg>
      );
    case "facebook":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <circle cx="17" cy="17" r="13" fill={selected ? "#1877F2" : "var(--text-muted)"} />
          <path d="M22 12h-2.5c-1.4 0-2.5 1.1-2.5 2.5V17h4l-.5 4H17v8h-4v-8h-3v-4h3v-2.5c0-3 2.5-5.5 5.5-5.5H22v3z" fill={selected ? "#fff" : "var(--bg-card)"} />
        </svg>
      );
    case "twitter":
    case "x":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <path d="M7 7l8 10.5L7 27h2.5l6.5-7.5L22 27h5l-8.5-11L26 7h-2.5l-6 7L12 7H7z"
            fill={selected ? "var(--text-primary)" : "var(--text-muted)"} />
        </svg>
      );
    case "linkedin":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <rect x="4" y="4" width="26" height="26" rx="4" fill={selected ? "#0A66C2" : "var(--text-muted)"} />
          <path d="M11 15v8M11 11v.01M14 23v-5c0-1.7 1.3-3 3-3s3 1.3 3 3v5M14 15v8"
            stroke={selected ? "#fff" : "var(--bg-card)"} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "youtube":
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
          <rect x="4" y="8" width="26" height="18" rx="5" fill={selected ? "#FF0000" : "var(--text-muted)"} />
          <polygon points="14,12 14,22 22,17" fill={selected ? "#fff" : "var(--bg-card)"} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 34 34" fill="none" stroke={selected ? "var(--text-primary)" : "var(--text-muted)"} strokeWidth="1.5">
          <circle cx="17" cy="17" r="12" />
          <path d="M17 5a18 18 0 0 1 0 24M17 5a18 18 0 0 0 0 24M5 17h24" />
        </svg>
      );
  }
}

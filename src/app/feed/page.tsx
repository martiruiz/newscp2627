"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import FilterSidebar, { type SelectedFilters } from "@/components/FilterSidebar";
import PublicationCard from "@/components/PublicationCard";

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  sport: string | null;
  entityType: string | null;
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

const BATCH_SIZE = 9;

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

export default function FeedPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<SelectedFilters>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [readyUpTo, setReadyUpTo] = useState(0);
  const loadedSetRef = useRef(new Set<string>());
  const currentBatchRef = useRef<{ start: number; size: number }>({ start: 0, size: 0 });

  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const handleEmbedLoaded = useCallback((pubKey: string) => {
    loadedSetRef.current.add(pubKey);
    const { start, size } = currentBatchRef.current;
    if (loadedSetRef.current.size >= size) {
      setReadyUpTo(start + size);
    }
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
          setPublications((prev) => {
            const prevLen = prev.length;
            loadedSetRef.current = new Set();
            currentBatchRef.current = { start: prevLen, size: newPubs.length };
            return [...prev, ...newPubs];
          });
        } else {
          loadedSetRef.current = new Set();
          currentBatchRef.current = { start: 0, size: newPubs.length };
          setReadyUpTo(0);
          setPublications(newPubs);
        }
        setPagination(data.pagination);
        pageRef.current = page;
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Failed to fetch publications:", e);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    pageRef.current = 1;
    const timeout = setTimeout(() => {
      fetchPublications(1);
    }, 200);
    return () => clearTimeout(timeout);
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
      <Navbar />

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
                    style={{ background: "#c89028", color: "#fff" }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {pagination && (
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  {pagination.total.toLocaleString()} ideas
                </span>
              )}
            </div>
            <div className="relative">
              <select
                value={filters.order}
                onChange={(e) => setFilters({ ...filters, order: e.target.value })}
                className="appearance-none text-xs font-medium pl-3 pr-7 py-1.5 rounded-lg cursor-pointer"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <option value="latest">Latest</option>
                <option value="random">Random</option>
              </select>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {getActiveChips(filters).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "rgba(200,144,40,0.15)", color: "#c89028", border: "1px solid rgba(200,144,40,0.3)" }}
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
                    style={{ color: "#c89028" }}
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

          {loading && publications.length === 0 ? (
            <MasonryGrid>
              {Array.from({ length: BATCH_SIZE }).map((_, i) => (
                <SkeletonCard key={`sk-init-${i}`} index={i} />
              ))}
            </MasonryGrid>
          ) : publications.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ background: "var(--bg-input)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                  <path d="M8 11h6" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                No results
              </p>
              {activeFilterCount > 0 ? (
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  Remove one or more filters to see content.
                </p>
              ) : (
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  <a href="/admin/import" style={{ color: "var(--accent-blue)" }}>
                    Import some content
                  </a>{" "}
                  to get started.
                </p>
              )}
            </div>
          ) : (
            <MasonryGrid>
              {publications.map((pub, i) => {
                const isReady = i < readyUpTo;
                const batchIndex = i % BATCH_SIZE;
                const pubKey = `${pub.platform}-${pub.externalPostId}`;
                return (
                  <CardSlot key={pubKey}>
                    {!isReady && <SkeletonCard index={batchIndex} />}
                    <div style={{
                      position: isReady ? "relative" : "absolute",
                      left: isReady ? undefined : "-9999px",
                      width: isReady ? undefined : "400px",
                    }}>
                      <PublicationCard
                        publication={pub}
                        animationDelay={batchIndex * 80}
                        shouldAnimate={isReady}
                        onLoaded={() => handleEmbedLoaded(pubKey)}
                        eager={!isReady}
                      />
                    </div>
                  </CardSlot>
                );
              })}
            </MasonryGrid>
          )}

          {publications.length > 0 && !loading && readyUpTo >= publications.length && !pagination?.hasMore && (
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

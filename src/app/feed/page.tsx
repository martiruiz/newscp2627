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
  saved: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  order: "latest",
};

export default function FeedPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<SelectedFilters>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [animatedCount, setAnimatedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const fetchPublications = useCallback(
    async (page: number, append = false) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "9");

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

        if (append) {
          setAnimatedCount(publications.length);
          setPublications((prev) => [...prev, ...data.publications]);
        } else {
          setAnimatedCount(0);
          setPublications(data.publications);
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
        />

        <main className="flex-1 min-w-0 p-4">
          <div className="flex items-center justify-between mb-4">
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
                    style={{ background: "var(--accent-blue)", color: "#fff" }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "var(--accent-blue)", color: "#fff" }}
              >
                All posts
              </button>
              {pagination && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {pagination.total.toLocaleString()} publications
                </span>
              )}
            </div>
          </div>

          {loading && publications.length === 0 ? (
            <MasonryGrid>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </MasonryGrid>
          ) : publications.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg" style={{ color: "var(--text-muted)" }}>
                No publications found
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                Try adjusting your filters or{" "}
                <a href="/admin/import" style={{ color: "var(--accent-blue)" }}>
                  import some content
                </a>
              </p>
            </div>
          ) : (
            <MasonryGrid>
              {publications.map((pub, i) => (
                <PublicationCard
                  key={`${pub.platform}-${pub.externalPostId}`}
                  publication={pub}
                  animationDelay={i >= animatedCount ? (i - animatedCount) * 80 : 0}
                  shouldAnimate={i >= animatedCount}
                />
              ))}
            </MasonryGrid>
          )}

          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="flex justify-center py-6">
              <div
                className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent-blue)" }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MasonryGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const cols: React.ReactNode[][] = [[], [], []];
  items.forEach((item, i) => {
    cols[i % 3].push(item);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4">
          {col}
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "var(--bg-card)", height: "380px", border: "1px solid var(--border-color)" }}
    >
      <div className="animate-pulse flex flex-col items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.3">
          <defs>
            <radialGradient id="sk-ig" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#dc2743" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#sk-ig)" strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="12" r="5" stroke="url(#sk-ig)" strokeWidth="1.5" fill="none" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="url(#sk-ig)" />
        </svg>
        <div className="h-2 w-20 rounded" style={{ background: "var(--bg-input)" }} />
      </div>
    </div>
  );
}

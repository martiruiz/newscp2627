"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import PublicationCard from "@/components/PublicationCard";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  originalUrl: string | null;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
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

/* ─── Sport label lookup ─────────────────────────────────────────────── */

const SPORT_LABELS: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  handball: "Handball",
  tennis: "Tennis",
  motorsport: "Motorsport",
  volleyball: "Volleyball",
  rugby: "Rugby",
  hockey: "Hockey",
  aquatics: "Aquatics",
  golf: "Golf",
  cycling: "Cycling",
  athletics: "Athletics",
  boxing: "Boxing",
  mma: "MMA / UFC",
  esports: "Esports",
  fitness: "Fitness / Gym",
  surf: "Surf",
  padel: "Padel",
  skiing: "Skiing",
  climbing: "Climbing",
  gymnastics: "Gymnastics",
  badminton: "Badminton",
  table_tennis: "Table Tennis",
  triathlon: "Triathlon",
  rowing: "Rowing",
  baseball: "Baseball",
  weightlifting: "Weightlifting",
  horse_racing: "Horse Racing",
  field_hockey: "Field Hockey",
};

function sportLabel(slug: string): string {
  return SPORT_LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── UI helpers ─────────────────────────────────────────────────────── */

function MasonryGrid({ children }: { children: React.ReactNode }) {
  const items = Array.from({ length: 3 }).map((_, ci) =>
    (Array.isArray(children) ? children : [children]).filter((_, i) => i % 3 === ci)
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start mb-4">
      {items.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4">{col}</div>
      ))}
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", animation: `skeletonFadeIn 0.3s ease-out ${index * 60}ms both` }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full" style={{ background: "var(--bg-input)" }} />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 rounded-md" style={{ background: "var(--bg-input)", width: 90 }} />
            <div className="h-2 rounded-md" style={{ background: "var(--bg-input)", width: 55 }} />
          </div>
        </div>
        <div className="w-5 h-5 rounded" style={{ background: "var(--bg-input)" }} />
      </div>
      <div className="px-1">
        <div className="rounded-md" style={{ background: "var(--bg-input)", paddingBottom: "100%" }} />
      </div>
      <div className="flex items-center gap-4 px-3 py-2.5">
        {[0, 1, 2].map((j) => <div key={j} className="w-6 h-6 rounded-full" style={{ background: "var(--bg-input)" }} />)}
      </div>
      <div className="px-3 pb-3">
        <div className="h-3 rounded-md mb-2" style={{ background: "var(--bg-input)", width: 70 }} />
        <div className="h-2.5 rounded-md" style={{ background: "var(--bg-input)", width: "60%" }} />
      </div>
      <style>{`@keyframes skeletonFadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export default function FavsPage() {
  const router = useRouter();

  /* preferences */
  const [allSports, setAllSports] = useState<string[]>([]);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsError, setPrefsError] = useState(false);

  /* feed */
  const [publications, setPublications] = useState<Publication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [readyPubs, setReadyPubs] = useState<Set<string>>(new Set());

  const sentinelRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(1);
  const fetchingRef = useRef(false);

  /* load preferences on mount */
  useEffect(() => {
    fetch("/api/user/onboarding")
      .then((r) => {
        if (!r.ok) throw new Error("auth");
        return r.json();
      })
      .then((d) => {
        const sports: string[] = d.userSports ?? [];
        setAllSports(sports);
        setActiveChips(sports);
        setPrefsLoaded(true);
      })
      .catch(() => {
        setPrefsError(true);
        setPrefsLoaded(true);
      });
  }, []);

  /* fetch publications */
  const fetchPublications = useCallback(
    async (page: number, chips: string[], reset: boolean) => {
      if (chips.length === 0) {
        if (reset) { setPublications([]); setPagination(null); }
        return;
      }
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setFeedError(false);
      try {
        const params = new URLSearchParams({
          sport: chips.join(","),
          order: "recommended",
          page: String(page),
          limit: "18",
        });
        const res = await fetch(`/api/publications?${params}`);
        if (!res.ok) throw new Error("fetch");
        const data = await res.json();
        setPublications((prev) => reset ? data.publications : [...prev, ...data.publications]);
        setPagination(data.pagination);
        currentPageRef.current = page;
      } catch {
        setFeedError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    []
  );

  /* refetch when chips change */
  useEffect(() => {
    if (!prefsLoaded) return;
    currentPageRef.current = 1;
    fetchPublications(1, activeChips, true);
  }, [activeChips, prefsLoaded, fetchPublications]);

  /* infinite scroll */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !fetchingRef.current) {
          fetchingRef.current = true;
          fetchPublications(currentPageRef.current + 1, activeChips, false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pagination, activeChips, fetchPublications]);

  function toggleChip(slug: string) {
    setActiveChips((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function handleEmbedLoaded(key: string) {
    setReadyPubs((prev) => new Set([...prev, key]));
  }

  /* ── Loading preferences ─────────────────────────────────────────── */
  if (!prefsLoaded) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="mb-6">
          <div className="h-7 w-24 rounded-lg mb-2" style={{ background: "var(--bg-input)" }} />
          <div className="h-4 w-56 rounded-lg" style={{ background: "var(--bg-input)" }} />
        </div>
        <div className="flex gap-2 mb-6">
          {[80, 100, 70, 90, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-full" style={{ background: "var(--bg-input)", width: w }} />
          ))}
        </div>
        <MasonryGrid>
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} index={i} />)}
        </MasonryGrid>
      </div>
    );
  }

  /* ── No preferences ──────────────────────────────────────────────── */
  if (allSports.length === 0 && !prefsError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: "60vh" }}>
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
          style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="0">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
          Create your personalized feed
        </h1>
        <p className="text-sm mb-8 max-w-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Selecciona els esports, formats i plataformes que més t&apos;interessen per veure contingut adaptat a tu.
        </p>
        <button
          onClick={() => router.push("/onboarding")}
          className="px-8 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#fff" }}
        >
          Choose preferences
        </button>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────── */
  if (prefsError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: "60vh" }}>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Error carregant les preferències.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const allChipsDisabled = activeChips.length === 0;

  return (
    <div className="flex-1 p-4 md:p-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-2xl font-black mb-0.5" style={{ color: "var(--text-primary)" }}>Favs</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Contingut seleccionat segons les teves preferències.
        </p>
      </div>

      {/* ── Chips ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {allSports.map((slug) => {
          const active = activeChips.includes(slug);
          return (
            <button
              key={slug}
              onClick={() => toggleChip(slug)}
              aria-pressed={active}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
              style={{
                background: active ? "var(--selected-bg)" : "var(--bg-input)",
                color: active ? "var(--selected-text, #fff)" : "var(--text-secondary)",
                border: active ? "1.5px solid transparent" : "1.5px solid var(--border-color)",
              }}
            >
              {active && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              )}
              {sportLabel(slug)}
            </button>
          );
        })}

        {/* Edit preferences */}
        <button
          onClick={() => router.push("/onboarding")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-70 ml-1"
          style={{ color: "var(--text-muted)", background: "transparent", border: "1.5px dashed var(--border-color)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit preferences
        </button>
      </div>

      {/* ── Result count ──────────────────────────────────────────── */}
      {pagination && !loading && (
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {pagination.total.toLocaleString()} idea{pagination.total !== 1 ? "s" : ""} trobades
        </p>
      )}

      {/* ── Loading ───────────────────────────────────────────────── */}
      {loading && (
        <MasonryGrid>
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} index={i} />)}
        </MasonryGrid>
      )}

      {/* ── All chips disabled ────────────────────────────────────── */}
      {!loading && allChipsDisabled && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Tots els filtres estan desactivats
          </p>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Activa algun esport per veure contingut.
          </p>
          <button
            onClick={() => setActiveChips(allSports)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
          >
            Activa tots
          </button>
        </div>
      )}

      {/* ── No results ────────────────────────────────────────────── */}
      {!loading && !allChipsDisabled && publications.length === 0 && !feedError && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            No content matches all your preferences yet.
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Intenta eliminar alguns filtres o edita les teves preferències.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setActiveChips([allSports[0]])}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
            >
              Remove some filters
            </button>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
            >
              Edit preferences
            </button>
            <button
              onClick={() => router.push("/feed")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--selected-bg)", color: "#fff" }}
            >
              Explore all content
            </button>
          </div>
        </div>
      )}

      {/* ── Feed error ────────────────────────────────────────────── */}
      {feedError && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Error carregant el contingut.
          </p>
          <button
            onClick={() => fetchPublications(1, activeChips, true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Feed grid ─────────────────────────────────────────────── */}
      {!loading && publications.length > 0 && (
        <MasonryGrid>
          {publications.map((pub, i) => {
            const pubKey = `${pub.platform}-${pub.externalPostId}`;
            const isReady = readyPubs.has(pubKey);
            return (
              <div key={pubKey} style={{ position: "relative" }}>
                {!isReady && <SkeletonCard index={i % 9} />}
                <div
                  style={{
                    position: isReady ? "relative" : "absolute",
                    left: isReady ? undefined : "-9999px",
                    width: isReady ? undefined : "400px",
                  }}
                >
                  <PublicationCard
                    publication={pub}
                    animationDelay={0}
                    shouldAnimate={isReady}
                    onLoaded={() => handleEmbedLoaded(pubKey)}
                    eager={i < 6}
                  />
                </div>
              </div>
            );
          })}
        </MasonryGrid>
      )}

      {/* ── Infinite scroll sentinel ──────────────────────────────── */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* ── Loading more ──────────────────────────────────────────── */}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      )}
    </div>
  );
}

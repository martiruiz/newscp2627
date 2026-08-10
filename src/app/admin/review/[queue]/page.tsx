"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BulkActionBar from "@/components/BulkActionBar";
import ReviewPanel from "@/components/ReviewPanel";

interface QueueItem {
  id: string;
  externalPostId: string;
  rawTitle: string | null;
  publishedAt: string | null;
  createdAt: string;
  platform: string;
  accountUsername: string | null;
  sport: string | null;
  entity: string | null;
  entityName: string | null;
  format: string | null;
  competitions: string[];
  canonicalUrl: string;
  embedUrl: string;
  originalUrl: string | null;
  importStatus: string | null;
  importError: string | null;
  reviewStatus: string | null;
  classificationIds: string[];
  classificationSlugs: string[];
}

const QUEUE_META: Record<string, { label: string; color: string; description: string }> = {
  new: { label: "New Content", color: "#3b82f6", description: "Publicacions pendents de revisió" },
  missing: { label: "Missing Information", color: "#f59e0b", description: "Publicacions amb camps obligatoris buits" },
  errors: { label: "Errors", color: "#ef4444", description: "Publicacions amb errors d'importació" },
};

function MissingFields({ item }: { item: QueueItem }) {
  const missing: string[] = [];
  if (!item.accountUsername) missing.push("Usuari");
  if (!item.sport) missing.push("Esport");
  if (!item.entityName) missing.push("Entitat");
  if (missing.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {missing.map((f) => (
        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
          {f}
        </span>
      ))}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export default function QueueListPage() {
  const { queue } = useParams<{ queue: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = QUEUE_META[queue] ?? { label: queue, color: "#6b7280", description: "" };

  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length && items.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  const load = useCallback(async (cursor?: string) => {
    const url = `/api/admin/review/queue?queue=${queue}${cursor ? `&cursor=${cursor}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    if (cursor) {
      setItems((prev) => [...prev, ...data.items]);
    } else {
      setItems(data.items);
    }
    setTotal(data.total);
    setNextCursor(data.nextCursor);
  }, [queue]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }

  const reviewId = searchParams.get("review");
  function openReview(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("review", id);
    router.replace(`?${p.toString()}`, { scroll: false });
  }
  function closeReview() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("review");
    router.replace(`?${p.toString()}`, { scroll: false });
  }
  const reviewIdx = reviewId ? items.findIndex(i => i.id === reviewId) : -1;
  const prevReviewId = reviewIdx > 0 ? items[reviewIdx - 1].id : null;
  const nextReviewId = reviewIdx >= 0 && reviewIdx < items.length - 1 ? items[reviewIdx + 1].id : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/review" className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{meta.label}</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
              {loading ? "—" : fmt(total)}
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{meta.description}</p>
        </div>
        {!loading && items.length > 0 && (
          <button
            onClick={() => openReview(items[0].id)}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
            style={{ background: meta.color, color: "#fff" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start review
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24" style={{ color: "var(--text-muted)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Carregant…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>All caught up</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>There are no contents pending in this queue.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={toggleAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Publicació</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Plataforma</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Esport</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Afegit</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-white/5 cursor-pointer"
                    style={{ borderBottom: idx < items.length - 1 ? "1px solid var(--border-color)" : "none" }}
                    onClick={() => openReview(item.id)}
                  >
                    <td className="px-4 py-3 w-8" onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", maxWidth: 280 }}>
                        {item.rawTitle || item.entityName || item.externalPostId}
                      </p>
                      {item.accountUsername && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>@{item.accountUsername}</p>
                      )}
                      {queue === "missing" && <MissingFields item={item} />}
                      {queue === "errors" && item.importError && (
                        <p className="text-[10px] mt-1 truncate" style={{ color: "#ef4444", maxWidth: 280 }}>{item.importError}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{item.platform}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: item.sport ? "var(--text-secondary)" : "var(--text-muted)" }}>
                        {item.sport ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(item.createdAt).toLocaleDateString("ca-ES", { day: "numeric", month: "short" })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openReview(item.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
                      >
                        Revisar
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                {loadingMore ? "Carregant…" : `Carregar més (${fmt(total - items.length)} restants)`}
              </button>
            </div>
          )}
        </>
      )}

      <BulkActionBar
        selected={selected}
        onClear={() => setSelected(new Set())}
        onDone={() => { setSelected(new Set()); load(); }}
      />

      {/* Review panel */}
      {reviewId && (
        <ReviewPanel
          pubId={reviewId}
          prevId={prevReviewId}
          nextId={nextReviewId}
          posLabel={reviewIdx >= 0 ? `${reviewIdx + 1} / ${items.length}` : undefined}
          onClose={closeReview}
          onSaved={() => load()}
          onNavigate={(id) => { const p = new URLSearchParams(searchParams.toString()); p.set("review", id); router.replace(`?${p.toString()}`, { scroll: false }); }}
          queueType={queue}
        />
      )}
    </div>
  );
}

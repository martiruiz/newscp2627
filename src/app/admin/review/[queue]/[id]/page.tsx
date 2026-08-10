"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

/* ── Types ── */
interface PubDetail {
  id: string;
  externalPostId: string;
  rawTitle: string | null;
  publishedAt: string | null;
  createdAt: string;
  embedUrl: string;
  canonicalUrl: string;
  originalUrl: string | null;
  accountUsername: string | null;
  platformId: string;
  platform: string;
  sportId: string | null;
  sport: string | null;
  entityTypeId: string | null;
  entity: string | null;
  entityName: string | null;
  contentFormatId: string | null;
  format: string | null;
  competitions: { id: string; name: string }[];
  classifications: { id: string; name: string; slug: string }[];
  contentCategories: { id: string; name: string }[];
  importStatus: string | null;
  importError: string | null;
  reviewStatus: string | null;
}

interface QueueIndex {
  ids: string[];
  total: number;
}

const QUEUE_META: Record<string, { label: string; color: string }> = {
  new: { label: "New Content", color: "#3b82f6" },
  missing: { label: "Missing Information", color: "#f59e0b" },
  errors: { label: "Errors", color: "#ef4444" },
};

const QUICK_CLASSIFICATIONS = [
  { slug: "top-picks", label: "Top Picks", shortcut: "T", color: "#E8567A", gradient: "linear-gradient(135deg,#E8567A,#A82346)" },
  { slug: "replicable-ideas", label: "Replicable", shortcut: "P", color: "#52D68A", gradient: "linear-gradient(135deg,#52D68A,#1B8A4E)" },
  { slug: "overperforming", label: "Overperforming", shortcut: "O", color: "#3B82F6", gradient: "linear-gradient(135deg,#3B82F6,#1E3A8A)" },
];

/* ── Embed ── */
function EmbedPreview({ pub }: { pub: PubDetail }) {
  const pl = pub.platform.toLowerCase();
  if (pl === "youtube") {
    const vid = pub.embedUrl.match(/embed\/([^?]+)/)?.[1] ?? pub.externalPostId;
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000", borderRadius: 8, overflow: "hidden" }}>
        <iframe src={`https://www.youtube.com/embed/${vid}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
      </div>
    );
  }
  if (pl === "tiktok") {
    return (
      <div style={{ display: "flex", justifyContent: "center", background: "#000", borderRadius: 8, overflow: "hidden" }}>
        <blockquote className="tiktok-embed" cite={pub.canonicalUrl} data-video-id={pub.externalPostId} style={{ maxWidth: 325 }}>
          <section><a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer">TikTok</a></section>
        </blockquote>
      </div>
    );
  }
  if (pl === "instagram") {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <iframe src={pub.canonicalUrl.replace(/\/$/, "") + "/embed"} style={{ width: "100%", maxWidth: 480, height: 560, border: "none", borderRadius: 8 }} scrolling="no" allowFullScreen />
      </div>
    );
  }
  return (
    <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl py-8 transition-all hover:opacity-80"
       style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)", textDecoration: "none", gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      <span className="text-sm font-medium">Obrir a {pub.platform}</span>
    </a>
  );
}

/* ── Missing fields ── */
function MissingBadge({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
      {label} buit
    </span>
  );
}

/* ── Main page ── */
export default function ReviewItemPage() {
  const { queue, id } = useParams<{ queue: string; id: string }>();
  const router = useRouter();
  const meta = QUEUE_META[queue] ?? { label: queue, color: "#6b7280" };

  const [pub, setPub] = useState<PubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queue index for Save & Next / Skip
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const currentIdx = queueIds.indexOf(id);

  // Classification state (local optimistic)
  const [classIds, setClassIds] = useState<string[]>([]);
  const [classSlugs, setClassSlugs] = useState<string[]>([]);

  // Keyboard shortcuts enabled
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);

  const isEditingRef = useRef(false);

  /* Load publication detail */
  const loadPub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publications?id=${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setPub(data);
      setClassIds(data.classifications?.map((c: { id: string }) => c.id) ?? []);
      setClassSlugs(data.classifications?.map((c: { slug: string }) => c.slug) ?? []);
    } catch {
      setError("No s'ha pogut carregar la publicació.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* Load queue index for navigation */
  useEffect(() => {
    fetch(`/api/admin/review/queue?queue=${queue}`)
      .then((r) => r.json())
      .then((d) => {
        setQueueIds(d.items.map((i: { id: string }) => i.id));
        setQueueTotal(d.total);
      })
      .catch(() => {});
  }, [queue]);

  useEffect(() => { loadPub(); }, [loadPub]);

  /* Navigate to adjacent item in queue */
  function goNext() {
    const nextId = queueIds[currentIdx + 1];
    if (nextId) router.push(`/admin/review/${queue}/${nextId}`);
    else router.push(`/admin/review/${queue}`);
  }

  function goPrev() {
    const prevId = queueIds[currentIdx - 1];
    if (prevId) router.push(`/admin/review/${queue}/${prevId}`);
  }

  /* Actions */
  async function setReviewStatus(status: "approved" | "rejected") {
    setSaving(true);
    try {
      await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewStatus: status }),
      });
      goNext();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/admin/publications?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationIds: classIds }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndNext() {
    await save();
    goNext();
  }

  /* Toggle classification */
  async function toggleClass(slug: string) {
    if (!pub) return;
    const opt = pub.classifications.find((c) => c.slug === slug) ??
      { id: slug, name: slug, slug }; // fallback
    const isActive = classSlugs.includes(slug);
    const newIds = isActive ? classIds.filter((x) => x !== opt.id) : [...classIds, opt.id];
    const newSlugs = isActive ? classSlugs.filter((s) => s !== slug) : [...classSlugs, slug];

    // Optimistic update
    setClassIds(newIds);
    setClassSlugs(newSlugs);

    try {
      // Fetch real classification options to get the correct id
      const opts = await fetch("/api/admin/filters?category=classification&all=true").then((r) => r.json());
      const found = opts.find((o: { slug: string; id: string }) => o.slug === slug);
      const finalIds = isActive
        ? classIds.filter((x) => x !== (found?.id ?? opt.id))
        : [...classIds, found?.id ?? opt.id];

      await fetch(`/api/admin/publications?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationIds: finalIds }),
      });
      setClassIds(finalIds);
    } catch {
      // Revert on error
      setClassIds(classIds);
      setClassSlugs(classSlugs);
    }
  }

  /* Keyboard shortcuts */
  useEffect(() => {
    if (!shortcutsEnabled) return;
    function onKey(e: KeyboardEvent) {
      if (isEditingRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).contentEditable === "true")) return;

      switch (e.key.toLowerCase()) {
        case "a": e.preventDefault(); setReviewStatus("approved"); break;
        case "r": e.preventDefault(); setReviewStatus("rejected"); break;
        case "s": e.preventDefault(); save(); break;
        case "n": e.preventDefault(); saveAndNext(); break;
        case "k": e.preventDefault(); goNext(); break;
        case "t": e.preventDefault(); toggleClass("top-picks"); break;
        case "p": e.preventDefault(); toggleClass("replicable-ideas"); break;
        case "o": e.preventDefault(); toggleClass("overperforming"); break;
        case "arrowleft": e.preventDefault(); goPrev(); break;
        case "arrowright": e.preventDefault(); goNext(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcutsEnabled, classIds, classSlugs, queueIds, currentIdx]);

  /* ── Render ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-muted)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Carregant…
      </div>
    );
  }

  if (error || !pub) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{error ?? "No s'ha trobat la publicació."}</p>
        <button onClick={() => router.push(`/admin/review/${queue}`)} className="text-sm hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          ← Tornar a la cua
        </button>
      </div>
    );
  }

  const posInQueue = currentIdx >= 0 ? currentIdx + 1 : "?";
  const missingFields: string[] = [];
  if (!pub.accountUsername) missingFields.push("Usuari");
  if (!pub.sport) missingFields.push("Esport");
  if (!pub.entityName) missingFields.push("Entitat");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}
      >
        {/* Back */}
        <button
          onClick={() => router.push(`/admin/review/${queue}`)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70 shrink-0"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
          title="Tornar a la cua"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        {/* Queue label + progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {posInQueue} of {queueTotal > 0 ? queueTotal : "?"}
          </span>
        </div>

        {/* Nav arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            disabled={currentIdx <= 0}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-70 disabled:opacity-30"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            title="Anterior (←)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            onClick={goNext}
            disabled={currentIdx >= queueIds.length - 1 && !queueIds[currentIdx + 1]}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-70 disabled:opacity-30"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            title="Següent (→)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <div className="flex-1" />

        {/* Shortcuts toggle */}
        <button
          onClick={() => setShortcutsEnabled((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all hover:opacity-70"
          style={{ background: shortcutsEnabled ? "rgba(59,130,246,0.12)" : "var(--bg-input)", color: shortcutsEnabled ? "#3b82f6" : "var(--text-muted)", border: `1px solid ${shortcutsEnabled ? "rgba(59,130,246,0.3)" : "var(--border-color)"}` }}
          title="Dreceres de teclat"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
          {shortcutsEnabled ? "Dreceres ON" : "Dreceres OFF"}
        </button>

        {/* Actions */}
        <button
          onClick={() => goNext()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-70"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
          title="Saltar (K)"
        >
          Skip
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: saved ? "rgba(34,197,94,0.12)" : "var(--bg-input)", border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "var(--border-color)"}`, color: saved ? "#22c55e" : "var(--text-secondary)" }}
          title="Desar (S)"
        >
          {saved ? "✓ Desat" : "Save"}
        </button>

        <button
          onClick={saveAndNext}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          title="Desar i Següent (N)"
        >
          Save & next
        </button>

        <button
          onClick={() => setReviewStatus("rejected")}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
          title="Rebutjar (R)"
        >
          Reject
        </button>

        <button
          onClick={() => setReviewStatus("approved")}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
          title="Aprovar (A)"
        >
          Approve
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: embed */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: "var(--bg-primary)" }}>
          {missingFields.length > 0 && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>Camps obligatoris buits:</span>
              <div className="flex gap-1">
                {missingFields.map((f) => <MissingBadge key={f} label={f} />)}
              </div>
            </div>
          )}

          {pub.importError && (
            <div className="mb-4 px-4 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "#ef4444" }}>Error d'importació</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{pub.importError}</p>
            </div>
          )}

          <div className="max-w-2xl mx-auto">
            <EmbedPreview pub={pub} />
          </div>

          {/* Quick classifications */}
          <div className="max-w-2xl mx-auto mt-6">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Classificació ràpida</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CLASSIFICATIONS.map((qc) => {
                const active = classSlugs.includes(qc.slug);
                return (
                  <button
                    key={qc.slug}
                    onClick={() => toggleClass(qc.slug)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{
                      background: active ? qc.gradient : "var(--bg-input)",
                      color: active ? "#fff" : "var(--text-muted)",
                      border: active ? "none" : "1px solid var(--border-color)",
                    }}
                    title={`${qc.label} (${qc.shortcut})`}
                  >
                    {qc.label}
                    <kbd className="text-[9px] opacity-60 font-mono">{qc.shortcut}</kbd>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: metadata panel */}
        <div
          className="shrink-0 w-72 overflow-y-auto p-5 space-y-4"
          style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-color)" }}
        >
          {/* Title */}
          {pub.rawTitle && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Títol</p>
              <p className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{pub.rawTitle}</p>
            </div>
          )}

          {/* Author */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Autor</p>
            {pub.accountUsername ? (
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>@{pub.accountUsername}</p>
            ) : (
              <p className="text-sm" style={{ color: "#f59e0b" }}>— buit</p>
            )}
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Plataforma</p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pub.platform}</p>
          </div>

          {/* Published at */}
          {pub.publishedAt && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Publicat</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {new Date(pub.publishedAt).toLocaleDateString("ca-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}

          {/* Sport */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Esport</p>
            {pub.sport ? (
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pub.sport}</p>
            ) : (
              <p className="text-sm" style={{ color: "#f59e0b" }}>— buit</p>
            )}
          </div>

          {/* Entity */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Entitat</p>
            <p className="text-sm" style={{ color: pub.entity ? "var(--text-primary)" : "var(--text-muted)" }}>
              {pub.entity ?? "—"}
            </p>
          </div>

          {/* Club */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Club / Entitat</p>
            {pub.entityName ? (
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{pub.entityName}</p>
            ) : (
              <p className="text-sm" style={{ color: "#f59e0b" }}>— buit</p>
            )}
          </div>

          {/* Competitions */}
          {pub.competitions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Competicions</p>
              <div className="flex flex-wrap gap-1">
                {pub.competitions.map((c) => (
                  <span key={c.name} className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>{c.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Format */}
          {pub.format && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Format</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{pub.format}</p>
            </div>
          )}

          {/* Review status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Estat revisió</p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: pub.reviewStatus === "approved" ? "rgba(34,197,94,0.12)" : pub.reviewStatus === "rejected" ? "rgba(239,68,68,0.12)" : pub.reviewStatus === "pending" ? "rgba(59,130,246,0.12)" : "var(--bg-input)",
                color: pub.reviewStatus === "approved" ? "#22c55e" : pub.reviewStatus === "rejected" ? "#ef4444" : pub.reviewStatus === "pending" ? "#3b82f6" : "var(--text-muted)",
              }}
            >
              {pub.reviewStatus ?? "legacy"}
            </span>
          </div>

          {/* Link */}
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
            <a href={pub.canonicalUrl} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 text-xs hover:opacity-70" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Veure publicació original
            </a>
          </div>

          {/* Shortcut reference */}
          {shortcutsEnabled && (
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Dreceres</p>
              <div className="space-y-1">
                {[
                  ["A", "Approve"],
                  ["R", "Reject"],
                  ["S", "Save"],
                  ["N", "Save & next"],
                  ["K", "Skip"],
                  ["T", "Top Picks"],
                  ["P", "Replicable"],
                  ["O", "Overperforming"],
                  ["← →", "Navegar"],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{action}</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

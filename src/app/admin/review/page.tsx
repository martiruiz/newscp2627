"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReviewCounts {
  newContent: number;
  missingInfo: number;
  withErrors: number;
}

function fmt(n: number) {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const QUEUES = [
  {
    id: "new",
    label: "New Content",
    description: "Publicacions importades que encara no han estat revisades per un administrador",
    priority: "Alta",
    priorityColor: "#ef4444",
    countKey: "newContent" as keyof ReviewCounts,
    color: "#3b82f6",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
    available: true,
  },
  {
    id: "missing",
    label: "Missing Information",
    description: "Publicacions sense esport, usuari o entitat assignada",
    priority: "Mitjana",
    priorityColor: "#f59e0b",
    countKey: "missingInfo" as keyof ReviewCounts,
    color: "#f59e0b",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    available: true,
  },
  {
    id: "highlights",
    label: "Potential Highlights",
    description: "Contenidors candidats a Top Picks, Replicable o Overperforming (disponible amb mètriques d'engagement)",
    priority: "Baixa",
    priorityColor: "#8b5cf6",
    countKey: null,
    color: "#8b5cf6",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    available: false,
    comingSoon: true,
  },
  {
    id: "errors",
    label: "Errors",
    description: "Publicacions amb errors d'importació registrats",
    priority: "Alta",
    priorityColor: "#ef4444",
    countKey: "withErrors" as keyof ReviewCounts,
    color: "#ef4444",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    available: true,
  },
] as const;

export default function ReviewPage() {
  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function load() {
    fetch("/api/admin/review")
      .then((r) => r.json())
      .then((d) => { setCounts(d); setLastUpdated(new Date()); })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const total = counts ? counts.newContent + counts.missingInfo + counts.withErrors : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Review</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {total !== null ? `${fmt(total)} elements pendents` : "Carregant…"}
            {lastUpdated && (
              <span> · actualitzat {lastUpdated.toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualitzar
        </button>
      </div>

      {/* Queues */}
      <div className="space-y-4">
        {QUEUES.map((q) => {
          const count = q.countKey ? (counts?.[q.countKey] ?? null) : null;
          const isEmpty = count === 0;

          return (
            <div
              key={q.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${q.available && !q.comingSoon ? "var(--border-color)" : "var(--border-color)"}`,
                opacity: q.comingSoon ? 0.55 : 1,
              }}
            >
              <div className="flex items-center gap-4 p-5">
                {/* Icon */}
                <div
                  className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ background: `${q.color}15`, color: q.color }}
                >
                  {q.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{q.label}</p>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${q.priorityColor}18`, color: q.priorityColor }}
                    >
                      {q.comingSoon ? "Aviat" : q.priority}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{q.description}</p>
                  {lastUpdated && !q.comingSoon && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      Última consulta: {lastUpdated.toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  )}
                </div>

                {/* Count + CTA */}
                <div className="shrink-0 flex items-center gap-4">
                  {!q.comingSoon && (
                    <div className="text-right">
                      <p
                        className="text-2xl font-black tabular-nums"
                        style={{ color: count && count > 0 ? q.color : "var(--text-muted)" }}
                      >
                        {counts === null ? "—" : fmt(count ?? 0)}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>pendents</p>
                    </div>
                  )}

                  {q.available && !q.comingSoon ? (
                    isEmpty ? (
                      <div
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Tot revisat
                      </div>
                    ) : (
                      <Link
                        href={`/admin/review/${q.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                        style={{ background: q.color, color: "#fff" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Start review
                      </Link>
                    )
                  ) : (
                    <div
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                    >
                      Properament
                    </div>
                  )}
                </div>
              </div>

              {/* Empty state bar */}
              {isEmpty && q.available && !q.comingSoon && (
                <div className="px-5 pb-4">
                  <p className="text-xs text-center py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", color: "#22c55e" }}>
                    All caught up. There are no contents pending in this queue.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

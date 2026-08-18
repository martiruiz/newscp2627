"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  totalPublications: number;
  ingestion: { today: number; week: number; month: number };
  quality: { withErrors: number; incomplete: number };
  importBatches: { active: number; completed: number; failed: number };
  byPlatform: { name: string; count: number }[];
  bySport: { name: string; count: number }[];
  classifications: { name: string; slug: string; count: number }[];
  recentBatches: {
    id: string; filename: string; status: string;
    importedRows: number; updatedRows: number; skippedRows: number;
    invalidRows: number; failedRows: number; totalRows: number;
    createdAt: string; completedAt: string | null; processingTime: number | null;
  }[];
  staleAccounts: { username: string; lastPub: string; total: number }[];
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#E1306C", TikTok: "#010101", YouTube: "#FF0000",
  "YouTube Shorts": "#FF0000", X: "#000000", Twitter: "#000000",
  Facebook: "#1877F2", LinkedIn: "#0A66C2", Pinterest: "#E60023",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0) return "avui";
  if (d === 1) return "ahir";
  return `fa ${d} dies`;
}

function StatusDot({ status }: { status: string }) {
  const color = status === "completed" ? "#22c55e" : status === "processing" ? "#f59e0b" : "#ef4444";
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub?: string; accent?: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center rounded-lg" style={{
          width: 30, height: 30,
          background: accent ? `${accent}14` : "var(--bg-input)",
          color: accent ?? "var(--text-muted)",
        }}>
          {icon}
        </div>
        {sub && <span className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{sub}</span>}
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums" style={{ color: accent ?? "var(--text-primary)", lineHeight: 1.1 }}>
          {typeof value === "number" ? fmt(value) : value}
        </p>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}>
      {children}
    </h2>
  );
}

function IconStar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function IconRepeat({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

function IconTrendingUp({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

function IconCalendar({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}

function IconDatabase({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
    </svg>
  );
}

function IconAlertTriangle({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IconCheckCircle({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11"/>
    </svg>
  );
}

function IconAlertCircle({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function IconXMark({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/admin/dashboard")
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Carregant dashboard…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm" style={{ color: "#ef4444" }}>Error carregant el dashboard.</div>
      </div>
    );
  }

  const topPick = data.classifications.find((c) => c.slug === "top-picks");
  const replicable = data.classifications.find((c) => c.slug === "replicable-ideas");
  const overperforming = data.classifications.find((c) => c.slug === "overperforming");

  const maxPlatform = Math.max(...data.byPlatform.map((p) => p.count), 1);
  const maxSport = Math.max(...data.bySport.map((s) => s.count), 1);

  const allOk =
    data.quality.withErrors === 0 &&
    data.importBatches.failed === 0 &&
    data.staleAccounts.length === 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {fmt(data.totalPublications)} publicacions · {new Date().toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: allOk ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.08)",
            color: allOk ? "#22c55e" : "#ef4444",
            border: `1px solid ${allOk ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.18)"}`,
          }}
        >
          {allOk
            ? <IconCheckCircle size={12} color="#22c55e" />
            : <IconAlertCircle size={12} color="#ef4444" />
          }
          {allOk ? "Tot correcte" : "Requereix atenció"}
        </div>
      </div>

      {/* Ingestion stats */}
      <SectionTitle>Continguts incorporats</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Avui"
          value={data.ingestion.today}
          accent="#3b82f6"
          icon={<IconCalendar size={15} />}
        />
        <StatCard
          label="Aquesta setmana"
          value={data.ingestion.week}
          accent="#8b5cf6"
          icon={<IconCalendar size={15} />}
        />
        <StatCard
          label="Aquest mes"
          value={data.ingestion.month}
          accent="#06b6d4"
          icon={<IconCalendar size={15} />}
        />
        <StatCard
          label="Total a la BD"
          value={data.totalPublications}
          icon={<IconDatabase size={15} />}
        />
      </div>

      {/* Quality + Scrapes */}
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        {/* Quality */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <SectionTitle>Qualitat de dades</SectionTitle>

          <div className="space-y-2.5 mb-5">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                {data.quality.withErrors > 0
                  ? <IconAlertCircle size={13} color="#ef4444" />
                  : <IconCheckCircle size={13} color="#22c55e" />
                }
                Registres amb errors
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: data.quality.withErrors > 0 ? "#ef4444" : "#22c55e" }}
              >
                {fmt(data.quality.withErrors)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                {data.quality.incomplete > 0
                  ? <IconAlertTriangle size={13} color="#f59e0b" />
                  : <IconCheckCircle size={13} color="#22c55e" />
                }
                Camps incomplets
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: data.quality.incomplete > 0 ? "#f59e0b" : "#22c55e" }}
              >
                {fmt(data.quality.incomplete)}
              </span>
            </div>
          </div>

          {/* Classifications */}
          <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Continguts marcats</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { item: topPick, label: "Top Picks", color: "#E8567A", icon: <IconStar size={13} /> },
                { item: replicable, label: "Replicable", color: "#52D68A", icon: <IconRepeat size={13} /> },
                { item: overperforming, label: "Overperforming", color: "#3B82F6", icon: <IconTrendingUp size={13} /> },
              ].map(({ item, label, color, icon }) => (
                <div
                  key={label}
                  className="rounded-xl p-3"
                  style={{ background: `${color}0f`, border: `1px solid ${color}28` }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
                    {icon}
                  </div>
                  <div className="text-lg font-black tabular-nums leading-none" style={{ color }}>{item ? fmt(item.count) : "0"}</div>
                  <div className="text-[10px] font-semibold mt-1 leading-tight" style={{ color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Import batches */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Scrapejos</SectionTitle>
            <Link
              href="/admin/sources"
              className="text-[11px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "var(--color-charcoal)" }}
            >
              Veure tots →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Actius", val: data.importBatches.active, color: "#f59e0b" },
              { label: "Completats", val: data.importBatches.completed, color: "#22c55e" },
              { label: "Fallits", val: data.importBatches.failed, color: "#ef4444" },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: `${color}0f`, border: `1px solid ${color}22` }}>
                <div className="text-xl font-black tabular-nums leading-none" style={{ color }}>{val}</div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-0">
            {data.recentBatches.slice(0, 5).map((b, i) => (
              <div
                key={b.id}
                className="flex items-center justify-between py-2 text-xs gap-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-color)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={b.status} />
                  <span className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                    {b.filename.replace(/SCRAPEIG DIARI /i, "").replace(".csv", "")}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="font-semibold" style={{ color: "#22c55e" }}>+{fmt(b.importedRows)}</span>
                  {b.failedRows > 0 && (
                    <span className="flex items-center gap-1" style={{ color: "#ef4444" }}>
                      <IconXMark size={9} />
                      {b.failedRows}
                    </span>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>{daysAgo(b.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform + Sport distribution */}
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        {/* By Platform */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <SectionTitle>Per plataforma</SectionTitle>
          <div className="space-y-3">
            {data.byPlatform.map((p) => {
              const pct = Math.round((p.count / maxPlatform) * 100);
              return (
                <div key={p.name}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(p.count)}</span>
                      <span className="tabular-nums w-8 text-right" style={{ color: "var(--text-muted)", fontSize: 10 }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-input)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: PLATFORM_COLORS[p.name] ?? "var(--color-charcoal)", transition: "width 0.6s ease" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Sport */}
        <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <SectionTitle>Per esport · top 10</SectionTitle>
          <div className="space-y-3">
            {data.bySport.map((s) => {
              const pct = Math.round((s.count / maxSport) * 100);
              return (
                <div key={s.name}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(s.count)}</span>
                      <span className="tabular-nums w-8 text-right" style={{ color: "var(--text-muted)", fontSize: 10 }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-input)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: "var(--color-charcoal)", transition: "width 0.6s ease" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stale accounts */}
      {data.staleAccounts.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div className="flex items-center gap-2 mb-4">
            <IconAlertTriangle size={13} color="#f59e0b" />
            <SectionTitle>Comptes sense actualitzar · +7 dies</SectionTitle>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.staleAccounts.map((a) => (
              <div key={a.username} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>@{a.username}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#f59e0b" }}>{daysAgo(a.lastPub)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{fmt(a.total)} posts</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

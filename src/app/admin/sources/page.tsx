"use client";

import Link from "next/link";

const SOURCES = [
  {
    id: "import",
    label: "Importar CSV",
    description: "Puja un fitxer CSV manualment o revisa l'estat de la cua d'importació",
    href: "/admin/import",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    color: "#3b82f6",
  },
  {
    id: "history",
    label: "Historial d'imports",
    description: "Revisa tots els batches importats, els seus estats i estadístiques",
    href: "/admin/import?tab=history",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    color: "#8b5cf6",
  },
];

const COMING_SOON = [
  {
    label: "Comptes monitoritzats",
    description: "Llista de comptes d'Instagram, TikTok i YouTube actius al scraping automàtic",
  },
  {
    label: "Configuració d'scraping",
    description: "Freqüència, filtres per plataforma, llindar de qualitat mínim",
  },
  {
    label: "Webhooks",
    description: "Endpoints per rebre notificacions en temps real de nous continguts",
  },
];

export default function SourcesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Sources & Imports</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Gestiona les fonts de contingut i el pipeline d'importació
        </p>
      </div>

      {/* Active tools */}
      <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        Eines disponibles
      </h2>
      <div className="space-y-3 mb-8">
        {SOURCES.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="flex items-center gap-4 rounded-2xl p-5 transition-all hover:opacity-90 group"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", textDecoration: "none" }}
          >
            <div
              className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ background: `${s.color}15`, color: s.color }}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.description}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }} className="group-hover:translate-x-0.5 transition-transform">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        ))}
      </div>

      {/* Auto-import status */}
      <div className="rounded-2xl p-5 mb-8" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Auto-import actiu</h3>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          El LaunchAgent de macOS vigila <code style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-input)", padding: "1px 5px", borderRadius: 4 }}>~/Desktop/SPORTS CONTENT PLAYBOOK/SCRAP SCP 2026</code> i importa automàticament l'últim dia de cada CSV quan detecta canvis.
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Revisa el log a: <code style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-input)", padding: "1px 5px", borderRadius: 4 }}>~/.scp-import.log</code>
        </p>
      </div>

      {/* Coming soon */}
      <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        Properament
      </h2>
      <div className="grid md:grid-cols-3 gap-3">
        {COMING_SOON.map((q) => (
          <div
            key={q.label}
            className="rounded-2xl p-4 opacity-50"
            style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{q.label}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>Aviat</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{q.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

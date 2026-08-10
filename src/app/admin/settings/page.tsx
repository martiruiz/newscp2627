"use client";

import Link from "next/link";

const SETTINGS_SECTIONS = [
  {
    id: "filters",
    label: "Taxonomia i filtres",
    description: "Gestiona esports, plataformes, tipus d'entitat i classificacions",
    href: "/admin/filters",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="8" y1="12" x2="20" y2="12"/>
        <line x1="12" y1="18" x2="20" y2="18"/>
        <circle cx="2" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>
      </svg>
    ),
    color: "#8b5cf6",
  },
  {
    id: "users",
    label: "Usuaris admin",
    description: "Gestiona els comptes amb accés al panel d'administració",
    href: "/admin/users",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: "#06b6d4",
  },
];

const COMING_SOON = [
  {
    label: "Configuració general",
    description: "Nom de l'app, idioma per defecte, zona horària i notificacions",
  },
  {
    label: "Permisos i rols",
    description: "Control granular de permisos per usuaris i grups d'accés",
  },
  {
    label: "Integracions",
    description: "Connecta eines externes: Slack, webhooks, APIs de xarxes socials",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Configuració del panel i la plataforma
        </p>
      </div>

      {/* Active settings */}
      <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        Configuració disponible
      </h2>
      <div className="space-y-3 mb-8">
        {SETTINGS_SECTIONS.map((s) => (
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  {
    label: "Content Ideas",
    href: "/admin/content-ideas",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8C6.4 13.9 5 11.6 5 9a7 7 0 0 1 7-7z"/>
        <path d="M9 21h6M10 17v-2M14 17v-2"/>
      </svg>
    ),
  },
  {
    label: "Content Library",
    href: "/feed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Filters",
    href: "/admin/filters",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
    ),
  },
  {
    label: "Import",
    href: "/admin/import",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

function LogoutButton({ onNav }: { onNav?: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Are you sure you want to log out?</p>
        <div className="flex gap-2">
          <button
            onClick={logout}
            className="flex-1 px-2 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            Log out
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setConfirming(true); onNav?.(); }}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
      style={{ color: "#ef4444" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Logout
    </button>
  );
}

function NavContent({ pathname, onNav }: { pathname: string | null; onNav?: () => void }) {
  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href !== "/feed" && pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNav}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "var(--color-charcoal-subtle)" : "transparent",
                color: active ? "var(--color-charcoal)" : "var(--text-secondary)",
              }}
            >
              <span style={{ color: active ? "var(--color-charcoal)" : "var(--text-muted)" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 space-y-0.5 shrink-0" style={{ borderTop: "1px solid var(--border-color)" }}>
        <Link
          href="/account"
          onClick={onNav}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "var(--text-muted)" }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Account
        </Link>
        <LogoutButton />
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 h-screen flex-col shrink-0 hidden md:flex"
        style={{ width: 200, background: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }}
      >
        <div className="px-5 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <img src="/logo.svg" alt="Sports Content Playbook" style={{ height: 28, width: "auto", maxWidth: 150, objectFit: "contain" }} />
        </div>
        <NavContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}
      >
        <img src="/logo.svg" alt="SCP" style={{ height: 22, width: "auto", objectFit: "contain" }} />
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="md:hidden fixed top-0 left-0 h-full z-50 flex flex-col"
            style={{ width: 240, background: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }}
          >
            <div className="px-5 py-5 shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <img src="/logo.svg" alt="SCP" style={{ height: 24, width: "auto", objectFit: "contain" }} />
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <NavContent pathname={pathname} onNav={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main content — add top padding on mobile for the fixed topbar */}
      <main className="flex-1 min-w-0 md:pt-0 pt-[52px]">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";

/* ── Nav definition ── */
const ADMIN_NAV = [
  {
    label: "Overview",
    href: "/admin/overview",
    match: ["/admin/overview", "/admin/dashboard"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: "Content",
    href: "/admin/content",
    match: ["/admin/content", "/admin/content-ideas"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
  },
  {
    label: "Review",
    href: "/admin/review",
    match: ["/admin/review"],
    badge: "review",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    label: "Editorial",
    href: "/admin/editorial",
    match: ["/admin/editorial"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
  {
    label: "Sources",
    href: "/admin/sources",
    match: ["/admin/sources", "/admin/import"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/admin/settings",
    match: ["/admin/settings", "/admin/filters", "/admin/users"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
] as const;

const USER_APP_LINKS = [
  {
    label: "Library",
    href: "/feed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Profiles",
    href: "/profiles",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "News",
    href: "/news",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
] as const;

/* ── Logout button ── */
function LogoutButton({ collapsed, onNav }: { collapsed: boolean; onNav?: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  if (collapsed) {
    return (
      <button
        onClick={() => logout()}
        title="Logout"
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-80"
        style={{ color: "#ef4444" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Segur que vols sortir?</p>
        <div className="flex gap-2">
          <button onClick={logout} className="flex-1 px-2 py-1 rounded-lg text-xs font-bold hover:opacity-80" style={{ background: "#ef4444", color: "#fff" }}>
            Sortir
          </button>
          <button onClick={() => setConfirming(false)} className="flex-1 px-2 py-1 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
            Cancel·lar
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

/* ── Section label ── */
function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 mb-1 mt-4 first:mt-0">
      <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
        {children}
      </span>
    </div>
  );
}

/* ── Sidebar content ── */
function SidebarContent({
  pathname, collapsed, reviewBadge, onNav,
}: {
  pathname: string | null;
  collapsed: boolean;
  reviewBadge: number;
  onNav?: () => void;
}) {
  const isActive = (item: typeof ADMIN_NAV[number]) =>
    item.match.some((m) => pathname?.startsWith(m));

  return (
    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
      {/* Admin nav */}
      <nav className="px-2 py-3 space-y-0.5">
        {!collapsed && <SectionLabel collapsed={false}>Admin</SectionLabel>}

        {ADMIN_NAV.map((item) => {
          const active = isActive(item);
          const badge = item.badge === "review" && reviewBadge > 0 ? reviewBadge : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 rounded-lg transition-all group relative"
              style={{
                padding: collapsed ? "8px 0" : "8px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "var(--color-charcoal-subtle, rgba(31,41,55,0.12))" : "transparent",
                color: active ? "var(--color-charcoal, #D4A420)" : "var(--text-secondary)",
              }}
            >
              <span
                className="shrink-0 transition-colors"
                style={{ color: active ? "var(--color-charcoal, #D4A420)" : "var(--text-muted)" }}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-sm font-medium flex-1">{item.label}</span>
              )}
              {badge > 0 && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--color-charcoal, #D4A420)",
                    color: "#fff",
                    position: collapsed ? "absolute" : "static",
                    top: collapsed ? 4 : undefined,
                    right: collapsed ? 4 : undefined,
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider — Admin / User App */}
      <div className="mx-3 my-1" style={{ borderTop: "1px solid var(--border-color)" }} />

      {/* User app links */}
      <nav className="px-2 pb-2 space-y-0.5">
        {!collapsed && <SectionLabel collapsed={false}>App usuari</SectionLabel>}

        {USER_APP_LINKS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNav}
            title={collapsed ? item.label : undefined}
            className="flex items-center gap-3 rounded-lg transition-all opacity-60 hover:opacity-100"
            style={{
              padding: collapsed ? "7px 0" : "7px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "var(--text-secondary)",
            }}
          >
            <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{item.icon}</span>
            {!collapsed && (
              <>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </>
            )}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ── Main layout ── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reviewBadge, setReviewBadge] = useState(0);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/review")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.totalPending) setReviewBadge(d.totalPending); })
      .catch(() => {});
  }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  const SIDEBAR_W = collapsed ? 52 : 200;

  return (
    <div className="flex min-h-screen relative" style={{ background: "#050d1a", color: "var(--text-primary)" }}>
      {/* Background wallpaper */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/login-bg.png" alt="" aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.10, pointerEvents: "none", userSelect: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(135deg, rgba(2,8,40,0.96) 0%, rgba(15,40,100,0.82) 40%, rgba(37,99,235,0.45) 80%, rgba(59,130,246,0.15) 100%)" }} />

      {/* ── Desktop sidebar ── */}
      <aside
        className="sticky top-0 h-screen flex-col shrink-0 hidden md:flex transition-all duration-200"
        style={{
          width: SIDEBAR_W,
          minWidth: SIDEBAR_W,
          background: "rgba(5,13,26,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRight: "1px solid var(--border-color)",
          overflow: "hidden",
          zIndex: 1,
          position: "relative",
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="shrink-0 flex items-center px-3 py-4"
          style={{
            borderBottom: "1px solid var(--border-color)",
            justifyContent: collapsed ? "center" : "space-between",
            minHeight: 56,
          }}
        >
          {!collapsed && (
            <img src="/logo.svg" alt="SCP" style={{ height: 26, width: "auto", maxWidth: 130, objectFit: "contain" }} />
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80 shrink-0"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>

        <SidebarContent
          pathname={pathname}
          collapsed={collapsed}
          reviewBadge={reviewBadge}
          onNav={() => {}}
        />

        {/* Footer */}
        <div className="shrink-0 px-2 py-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          {!collapsed && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Tema</span>
              <ThemeToggle />
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
          )}
          <LogoutButton collapsed={collapsed} />
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(5,13,26,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid var(--border-color)", height: 52 }}
      >
        <img src="/logo.svg" alt="SCP" style={{ height: 22, width: "auto", objectFit: "contain" }} />
        <div className="flex items-center gap-2">
          {reviewBadge > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-charcoal, #D4A420)", color: "#fff" }}>
              {reviewBadge > 99 ? "99+" : reviewBadge}
            </span>
          )}
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
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className="md:hidden fixed top-0 left-0 h-full z-50 flex flex-col"
            style={{ width: 240, background: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <img src="/logo.svg" alt="SCP" style={{ height: 24, width: "auto", objectFit: "contain" }} />
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              collapsed={false}
              reviewBadge={reviewBadge}
              onNav={() => setMobileOpen(false)}
            />
            <div className="shrink-0 px-2 py-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Tema</span>
                <ThemeToggle />
              </div>
              <LogoutButton collapsed={false} onNav={() => setMobileOpen(false)} />
            </div>
          </aside>
        </>
      )}

      {/* ── Main content ── */}
      <main
        className="flex-1 min-w-0 md:pt-0 pt-[52px]"
        style={{
          position: "relative",
          zIndex: 1,
          "--bg-primary":   "rgba(5,13,26,0.78)",
          "--bg-secondary": "rgba(10,22,50,0.82)",
          "--bg-card":      "rgba(15,28,58,0.85)",
          "--bg-input":     "rgba(20,35,70,0.88)",
        } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  );
}

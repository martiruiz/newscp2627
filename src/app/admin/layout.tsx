"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
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
    label: "Jobs",
    href: "/admin/jobs",
    match: ["/admin/jobs"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
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
    label: "Industry Hub",
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
          const badge = ("badge" in item && item.badge === "review") && reviewBadge > 0 ? reviewBadge : 0;

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

/* ── Mobile bottom nav ── */
const BOTTOM_NAV = [
  {
    id: "overview",
    label: "Overview",
    href: "/admin/overview",
    match: ["/admin/overview", "/admin/dashboard"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: "content",
    label: "Content",
    href: "/admin/content",
    match: ["/admin/content", "/admin/content-ideas"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
  },
  {
    id: "review",
    label: "Review",
    href: "/admin/review",
    match: ["/admin/review"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: "editorial",
    label: "Editorial",
    href: "/admin/editorial",
    match: ["/admin/editorial"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    match: ["/admin/settings", "/admin/filters", "/admin/users"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
] as const;

function AdminMobileBottomNav({ pathname, reviewBadge, hidden }: { pathname: string | null; reviewBadge: number; hidden: boolean }) {
  function isActive(item: typeof BOTTOM_NAV[number]) {
    return item.match.some((m) => pathname?.startsWith(m));
  }
  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 8,
        pointerEvents: "none",
        transform: hidden ? "translateY(120%)" : "translateY(0)",
        transition: "transform 0.3s ease",
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 32,
          boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          padding: "6px 4px",
          pointerEvents: "auto",
        }}
      >
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item);
          const badge = item.id === "review" && reviewBadge > 0 ? reviewBadge : 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                textDecoration: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {active ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    background: "rgba(13,20,33,0.07)",
                    borderRadius: 22,
                    padding: "7px 14px 7px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      background: "#0D1421",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      position: "relative",
                    }}
                  >
                    {item.icon}
                    {badge > 0 && (
                      <span style={{ position: "absolute", top: -4, right: -4, background: "#D4A420", color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 10, padding: "1px 4px", lineHeight: 1.4 }}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0D1421", letterSpacing: "0.01em", lineHeight: 1 }}>
                    {item.label}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    padding: "13px 8px 11px",
                    color: "#9CA3AF",
                    position: "relative",
                  }}
                >
                  {item.icon}
                  {badge > 0 && (
                    <span style={{ position: "absolute", top: 10, right: 4, background: "#D4A420", color: "#fff", fontSize: 8, fontWeight: 800, borderRadius: 10, padding: "1px 4px", lineHeight: 1.4 }}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", lineHeight: 1 }}>
                    {item.label}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Main layout ── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reviewBadge, setReviewBadge] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute("data-theme") === "blue");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/review")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.totalPending) setReviewBadge(d.totalPending); })
      .catch(() => {});
  }, [pathname]);

  // Hide top/bottom nav on scroll-down, reveal on scroll-up (mobile only)
  // Driven by custom event dispatched from each page's scroll container
  useEffect(() => {
    const onNavScroll = (e: Event) => {
      const { down } = (e as CustomEvent<{ down: boolean }>).detail ?? {};
      if (typeof down === "boolean") setNavHidden(down);
    };
    window.addEventListener("admin-nav-scroll", onNavScroll);
    return () => window.removeEventListener("admin-nav-scroll", onNavScroll);
  }, []);

  // Swipe-back: left-edge swipe → router.back() (for PWA standalone mode)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Swipe from left ~20% of screen, mostly horizontal, at least 60px
    if (touchStartX.current < 30 && dx > 60 && dy < 80) {
      router.back();
    }
  }, [router]);

  if (pathname === "/admin/login") return <>{children}</>;

  const SIDEBAR_W = collapsed ? 52 : 200;

  return (
    <div className="flex min-h-screen relative" style={{ background: isDark ? "#050d1a" : "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Background wallpaper — dark mode only */}
      {isDark && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/login-bg.png" alt="" aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.10, pointerEvents: "none", userSelect: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(135deg, rgba(2,8,40,0.96) 0%, rgba(15,40,100,0.82) 40%, rgba(37,99,235,0.45) 80%, rgba(59,130,246,0.15) 100%)" }} />
        </>
      )}

      {/* ── Desktop sidebar ── */}
      <aside
        className="sticky top-0 h-screen flex-col shrink-0 hidden md:flex transition-all duration-200"
        style={{
          width: SIDEBAR_W,
          minWidth: SIDEBAR_W,
          background: isDark ? "rgba(5,13,26,0.82)" : "var(--bg-secondary)",
          backdropFilter: isDark ? "blur(16px)" : undefined,
          WebkitBackdropFilter: isDark ? "blur(16px)" : undefined,
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
        style={{
          background: isDark ? "rgba(5,13,26,0.82)" : "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-color)",
          height: 52,
          transform: navHidden ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 0.3s ease",
        }}
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
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-w-0 md:pt-0 pt-[52px] md:pb-0 pb-[90px]"
        style={{
          position: "relative",
          zIndex: 1,
          ...(isDark ? {
            "--bg-primary":   "rgba(5,13,26,0.78)",
            "--bg-secondary": "rgba(10,22,50,0.82)",
            "--bg-card":      "rgba(15,28,58,0.85)",
            "--bg-input":     "rgba(20,35,70,0.88)",
          } : {}),
        } as React.CSSProperties}
      >
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <AdminMobileBottomNav pathname={pathname} reviewBadge={reviewBadge} hidden={navHidden} />
    </div>
  );
}

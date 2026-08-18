"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppSidebar from "./AppSidebar";

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function PlansIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function NewsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
      <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/>
    </svg>
  );
}

const ALL_NAV = [
  { id: "home",     label: "Home",     href: "/dashboard",              match: "/dashboard", Icon: HomeIcon },
  { id: "library",  label: "Library",  href: "/feed",                   match: "/feed",      Icon: PlansIcon },
  { id: "news",     label: "News",     href: "/news",                   match: "/news",      Icon: NewsIcon },
  { id: "discover", label: "Discover", href: "/feed?order=random&days=7", match: "/feed",    Icon: CompassIcon },
  { id: "profile",  label: "Profile",  href: "/account",                match: "/account",   Icon: ProfileIcon },
];

function MobileBottomNav({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const isDiscover = pathname === "/feed" && searchParams.get("order") === "random";

  function isActive(item: typeof ALL_NAV[0]) {
    if (item.id === "discover") return isDiscover;
    if (item.id === "library") return pathname === "/feed" && !isDiscover;
    return pathname === item.match || pathname?.startsWith(item.match + "/");
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
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          background: "#FFFFFF",
          borderRadius: 32,
          boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
          padding: "6px 4px",
          pointerEvents: "auto",
        }}
      >
        {ALL_NAV.map((item) => {
          const active = isActive(item);
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
                    }}
                  >
                    <item.Icon />
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
                  }}
                >
                  <item.Icon />
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

function MobileTopHeader() {
  return (
    <div
      className="flex items-center px-5 pt-5 pb-3 md:hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <img src="/logo.svg" alt="Sports Content Playbook" style={{ height: 28, width: "auto", maxWidth: 180, objectFit: "contain" }} />
      </Link>
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname?.startsWith("/admin");
  const isDashboard = pathname === "/dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (touchStartX.current < 30 && dx > 60 && dy < 80) {
      router.back();
    }
  }, [router]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  // Redirect to welcome/onboarding if logged in but not yet completed
  useEffect(() => {
    if (isAdmin || pathname === "/onboarding" || pathname === "/welcome" || pathname === "/pricing") return;
    fetch("/api/user/plan").then((r) => r.json()).then((d) => {
      if (d.email && d.onboardingCompleted === false) {
        router.replace("/welcome");
      }
    }).catch(() => {});
  }, [pathname, isAdmin, router]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  if (isAdmin || pathname === "/welcome" || pathname === "/onboarding") return <>{children}</>;

  if (!mounted) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="hidden md:block shrink-0" style={{ width: 240, background: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen ${collapsed ? "flex-col" : ""}`}
      style={{ background: "var(--bg-primary)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block shrink-0">
        <AppSidebar collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 main-content-wrapper">
        {!isDashboard && <MobileTopHeader />}
        {children}
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav pathname={pathname || ""} />
    </div>
  );
}

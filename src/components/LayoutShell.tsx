"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
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
function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

const LEFT_NAV = [
  { label: "Home", href: "/dashboard", match: "/dashboard", icon: <HomeIcon /> },
  { label: "Library", href: "/feed", match: "/feed", icon: <PlansIcon /> },
];
const RIGHT_NAV = [
  { label: "Discover", href: "/feed?order=random&days=7", match: "/feed", icon: <CompassIcon /> },
  { label: "Profile", href: "/account", match: "/account", icon: <ProfileIcon /> },
];

function MobileBottomNav({ pathname }: { pathname: string }) {
  const isActive = (match: string) =>
    pathname === match || pathname?.startsWith(match + "/");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end md:hidden"
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Left items */}
      {LEFT_NAV.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all active:scale-95"
        >
          <span style={{ color: isActive(item.match) ? "#F5C542" : "var(--text-muted)" }}>
            {item.icon}
          </span>
          <span className="text-[9px] font-bold" style={{ color: isActive(item.match) ? "#F5C542" : "var(--text-muted)" }}>
            {item.label}
          </span>
        </Link>
      ))}

      {/* Center + button */}
      <div className="flex flex-col items-center justify-center px-2 pb-1">
        <Link
          href="/news"
          className="flex items-center justify-center rounded-full transition-all active:scale-90 hover:opacity-90"
          style={{
            width: 52,
            height: 52,
            background: "linear-gradient(135deg, #F5C542, #F5C542)",
            boxShadow: "0 4px 16px rgba(200,144,40,0.5)",
            color: "#fff",
            marginBottom: 2,
          }}
        >
          <PlusIcon />
        </Link>
        <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>News</span>
      </div>

      {/* Right items */}
      {RIGHT_NAV.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all active:scale-95"
        >
          <span style={{ color: isActive(item.match) ? "#F5C542" : "var(--text-muted)" }}>
            {item.icon}
          </span>
          <span className="text-[9px] font-bold" style={{ color: isActive(item.match) ? "#F5C542" : "var(--text-muted)" }}>
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  if (isAdmin) return <>{children}</>;

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
    >
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block shrink-0">
        <AppSidebar collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 pb-24 md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav pathname={pathname || ""} />
    </div>
  );
}

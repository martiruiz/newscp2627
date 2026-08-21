"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEffectivePlan } from "@/lib/plan-utils";
import { useState, useEffect } from "react";
import DashboardUserProfile from "./DashboardUserProfile";

const ANNUAL_BANNER_DISMISSED_KEY = "scp-annual-banner-dismissed";

function AnnualBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ANNUAL_BANNER_DISMISSED_KEY)) return;
      setVisible(true);
    } catch {}
  }, []);
  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    try { sessionStorage.setItem(ANNUAL_BANNER_DISMISSED_KEY, "1"); } catch {}
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <div style={{ margin: "4px 8px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
      <Link href="/pricing" style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-primary)", textDecoration: "none" }}>
        Canvia a anual · −20%
      </Link>
      <button onClick={dismiss} style={{ fontSize: 14, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>
        ×
      </button>
    </div>
  );
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function useNavSections(): NavSection[] {
  const { t } = useLanguage();
  return [
    {
      label: "Descobrir",
      items: [
        { label: t("nav.dashboard"), href: "/dashboard", icon: "dashboard" },
        { label: t("nav.contentLibrary"), href: "/feed", icon: "library" },
        { label: t("nav.saved"), href: "/saved", icon: "saved" },
      ],
    },
    {
      label: "Planificar",
      items: [
        { label: t("nav.calendar"), href: "/calendar", icon: "calendar" },
        { label: "Profiles", href: "/profiles", icon: "profiles" },
      ],
    },
    {
      label: "Recursos",
      items: [
        { label: t("nav.socialMediaNews"), href: "/news", icon: "news" },
        { label: t("nav.support"), href: "/support", icon: "contact" },
      ],
    },
  ];
}

function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  const s = size;
  switch (name) {
    case "dashboard":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "library":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "saved":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
    case "news":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>;
    case "contact":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "account":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "profiles":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "calendar":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "signout":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case "hamburger":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
    case "chevron-left":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
    default:
      return null;
  }
}

function ScpLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <img src="/logo.svg" alt="Sports Content Playbook" style={{ height: 26, width: "auto", maxWidth: 70, objectFit: "contain" }} />;
  }
  return <img src="/logo.svg" alt="Sports Content Playbook" style={{ height: 30, width: "auto", maxWidth: 150, objectFit: "contain" }} />;
}

const FREE_RESTRICTED_HREFS = new Set(["/news", "/saved"]);
const NON_BASIC_RESTRICTED_HREFS = new Set(["/profiles"]);
const PRO_RESTRICTED_HREFS = new Set(["/calendar"]);

function NavItemRow({
  item, active, isFree, isNonBasic, isNonPro, isSuperAdmin,
}: {
  item: NavItem; active: boolean; isFree?: boolean; isNonBasic?: boolean; isNonPro?: boolean; isSuperAdmin?: boolean;
}) {
  const isLocked = !isSuperAdmin && (
    (isFree && FREE_RESTRICTED_HREFS.has(item.href)) ||
    (isNonBasic && NON_BASIC_RESTRICTED_HREFS.has(item.href)) ||
    (isNonPro && PRO_RESTRICTED_HREFS.has(item.href))
  );

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "0 10px",
    height: "var(--nav-item-height)",
    borderRadius: "var(--radius-md)",
    border: "none",
    background: active ? "var(--color-charcoal-subtle)" : "transparent",
    color: active ? "var(--color-charcoal)" : "var(--text-secondary)",
    fontSize: "var(--font-size-sm)",
    fontWeight: active ? 700 : 500,
    fontFamily: "inherit",
    cursor: isLocked ? "pointer" : "pointer",
    textDecoration: "none",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    opacity: isLocked ? 0.5 : 1,
    transition: "background 100ms ease, color 100ms ease",
  };

  const iconStyle: React.CSSProperties = {
    color: active ? "var(--color-charcoal)" : "var(--text-muted)",
    flexShrink: 0,
    transition: "color 100ms ease",
  };

  const inner = (
    <>
      <span style={iconStyle}><NavIcon name={item.icon} size={15} /></span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
      {isLocked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      )}
    </>
  );

  if (isLocked) {
    return (
      <button onClick={() => window.dispatchEvent(new Event("open-pricing-sheet"))} style={style}>
        {inner}
      </button>
    );
  }
  return <Link href={item.href} style={style}>{inner}</Link>;
}

function NavIconButton({ item, active, title }: { item: NavItem; active: boolean; title: string }) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "var(--radius-md)",
    border: "none",
    background: active ? "var(--color-charcoal-subtle)" : "transparent",
    color: active ? "var(--color-charcoal)" : "var(--text-muted)",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 100ms ease, color 100ms ease",
    flexShrink: 0,
  };
  if (item.href.startsWith("#")) return <button style={style} title={title}><NavIcon name={item.icon} size={16} /></button>;
  return <Link href={item.href} style={style} title={title}><NavIcon name={item.icon} size={16} /></Link>;
}

function UpgradeCta() {
  const [plan, setPlan] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/user/plan")
      .then((r) => r.json())
      .then((d) => { setPlan(d.plan ?? "free"); setIsSuperAdmin(d.superAdmin === true); })
      .catch(() => setPlan("free"));
  }, []);
  if (!plan || plan !== "free" || isSuperAdmin) return null;
  return (
    <div style={{ padding: "0 8px 8px", flexShrink: 0 }}>
      <Link
        href="/pricing"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: "var(--radius-lg)",
          textDecoration: "none",
          background: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.04) 100%)",
          border: "1px solid rgba(37,99,235,0.18)",
        }}
      >
        <span style={{ color: "#2563EB", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#2563EB" }}>Pla gratuït</p>
          <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>Fes upgrade per accedir a tot</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
    </div>
  );
}

function ExpandedSidebar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
  const sections = useNavSections();
  const [plan, setPlan] = useState<string>("free");
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    fetch("/api/user/plan").then((r) => r.json()).then((d) => {
      const { plan: effectivePlan, isSuperAdmin } = getEffectivePlan(d);
      setPlan(effectivePlan);
      setIsSuper(isSuperAdmin);
    }).catch(() => {});
  }, []);

  const isFree = plan === "free";
  const isNonBasic = plan === "free" || plan === "weekly";
  const isNonPro = !["pro_monthly", "pro_annual"].includes(plan) && !isSuper;

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-default)",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo + collapse */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 12px", flexShrink: 0 }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <ScpLogo />
        </Link>
        <button
          onClick={onToggle}
          title="Col·lapsar barra lateral"
          aria-label="Col·lapsar barra lateral"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)", background: "var(--bg-interactive)",
            color: "var(--text-muted)", cursor: "pointer",
          }}
        >
          <NavIcon name="chevron-left" size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {sections.map((section, si) => (
          <div key={section.label} style={{ marginBottom: si < sections.length - 1 ? 8 : 0 }}>
            <span className="nav-section-label">{section.label}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <NavItemRow
                    key={item.href}
                    item={item}
                    active={active}
                    isFree={isFree}
                    isNonBasic={isNonBasic}
                    isNonPro={isNonPro}
                    isSuperAdmin={isSuper}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <AnnualBanner />
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 8px", flexShrink: 0 }} />

      {/* Upgrade CTA */}
      <div style={{ paddingTop: 8, flexShrink: 0 }}>
        <UpgradeCta />
      </div>

      {/* Super admin */}
      {isSuper && (
        <div style={{ padding: "0 8px 6px", flexShrink: 0 }}>
          <Link
            href="/admin"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 12px", borderRadius: "var(--radius-md)",
              textDecoration: "none", fontSize: 11, fontWeight: 700,
              background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)", color: "#2563EB",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Panel
          </Link>
        </div>
      )}

      {/* User profile */}
      <div style={{ padding: "0 8px 8px", flexShrink: 0 }}>
        <DashboardUserProfile />
      </div>
    </aside>
  );
}

function CollapsedTopBar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
  const sections = useNavSections();
  const allItems = sections.flatMap((s) => s.items);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        height: "var(--sidebar-collapsed-h)",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggle}
        title="Expandir barra lateral"
        aria-label="Expandir barra lateral"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-default)", background: "var(--bg-interactive)",
          color: "var(--text-muted)", cursor: "pointer", flexShrink: 0,
        }}
      >
        <NavIcon name="hamburger" size={15} />
      </button>

      <Link href="/dashboard" style={{ flexShrink: 0, display: "flex", alignItems: "center", textDecoration: "none" }}>
        <ScpLogo compact />
      </Link>

      <div style={{ width: 1, alignSelf: "stretch", margin: "10px 0", background: "var(--border-default)", flexShrink: 0 }} />

      <nav style={{ display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
        {allItems.map((item) => (
          <NavIconButton
            key={item.href}
            item={item}
            active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
            title={item.label}
          />
        ))}
      </nav>
    </header>
  );
}

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  if (collapsed) return <CollapsedTopBar onToggle={onToggle} pathname={pathname} />;
  return <ExpandedSidebar onToggle={onToggle} pathname={pathname} />;
}

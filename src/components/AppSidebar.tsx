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
    <div className="mx-3 mt-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-color)" }}>
      <Link href="/pricing" className="text-[11px] font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
        Canvia a anual · −20%
      </Link>
      <button onClick={dismiss} className="text-[11px] hover:opacity-60" style={{ color: "var(--text-muted)" }}>
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

function useNavItems() {
  const { t } = useLanguage();
  const TOP_NAV: NavItem[] = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: "dashboard" },
    { label: t("nav.contentLibrary"), href: "/feed", icon: "library" },
    { label: "Favs", href: "/favs", icon: "favs" },
    { label: "Profiles", href: "/profiles", icon: "profiles" },
    { label: t("nav.socialMediaNews"), href: "/news", icon: "news" },
    { label: t("nav.support"), href: "/support", icon: "contact" },
  ];
  const BOTTOM_NAV: NavItem[] = [
    { label: t("nav.saved"), href: "/saved", icon: "saved" },
  ];
  return { TOP_NAV, BOTTOM_NAV };
}

function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  const s = size;
  switch (name) {
    case "dashboard":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "library":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "favs":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case "blog":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case "news":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/></svg>;
    case "pricing":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case "contact":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case "saved":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
    case "account":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "profiles":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "jobs":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>;
    case "signout":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case "import":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
    case "hamburger":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
    case "chevron-left":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 18l-6-6 6-6"/></svg>;
    default:
      return null;
  }
}

function ScpLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <img
        src="/logo.svg"
        alt="Sports Content Playbook"
        style={{ height: 28, width: "auto", maxWidth: 70, objectFit: "contain" }}
      />
    );
  }
  return (
    <img
      src="/logo.svg"
      alt="Sports Content Playbook"
      style={{ height: 32, width: "auto", maxWidth: 160, objectFit: "contain" }}
    />
  );
}

const FREE_RESTRICTED_HREFS = new Set(["/news", "/saved"]);
const NON_BASIC_RESTRICTED_HREFS = new Set(["/profiles"]);

function NavItemRow({ item, active, isFree, isNonBasic, isSuperAdmin }: { item: NavItem; active: boolean; isFree?: boolean; isNonBasic?: boolean; isSuperAdmin?: boolean }) {
  const isLocked = !isSuperAdmin && (
    (isFree && FREE_RESTRICTED_HREFS.has(item.href)) ||
    (isNonBasic && NON_BASIC_RESTRICTED_HREFS.has(item.href))
  );
  const cls = "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all text-left";
  const style = { background: active ? "var(--color-charcoal-subtle)" : "transparent", color: active ? "var(--color-charcoal)" : "var(--text-secondary)", opacity: isLocked ? 0.55 : 1 };
  const inner = (
    <>
      <span style={{ color: active ? "var(--color-charcoal)" : "var(--text-muted)" }}><NavIcon name={item.icon} size={16} /></span>
      <span className="font-medium flex-1" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      {isLocked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      )}
    </>
  );
  if (isLocked) return <button onClick={() => window.dispatchEvent(new Event("open-pricing-sheet"))} className={cls} style={style}>{inner}</button>;
  if (item.href.startsWith("#")) return <button onClick={() => {}} className={cls} style={style}>{inner}</button>;
  return <Link href={item.href} className={cls} style={style}>{inner}</Link>;
}

function NavIconButton({ item, active, title }: { item: NavItem; active: boolean; title: string }) {
  const cls = "flex items-center justify-center rounded-lg transition-all";
  const style = { width: 34, height: 34, background: active ? "var(--color-charcoal-subtle)" : "transparent", color: active ? "var(--color-charcoal)" : "var(--text-muted)" };
  const inner = <NavIcon name={item.icon} size={16} />;
  if (item.href.startsWith("#")) return <button onClick={() => {}} className={cls} style={style} title={title}>{inner}</button>;
  return <Link href={item.href} className={cls} style={style} title={title}>{inner}</Link>;
}

function SupportButton() {
  const pathname = usePathname();
  const router = useRouter();

  function startTutorial() {
    if (pathname === "/feed") {
      try { localStorage.removeItem("scp-library-tutorial-done"); } catch {}
      router.push("/feed?tutorial=library");
    } else {
      try { localStorage.removeItem("scp-tutorial-done"); } catch {}
      router.push("/dashboard?tutorial=1");
    }
  }

  return (
    <div className="p-3 shrink-0">
      <button
        onClick={startTutorial}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 text-left"
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-color)",
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
        <span>Tutorial</span>
      </button>
    </div>
  );
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
    <div className="px-3 pb-2 shrink-0">
      <Link
        href="/pricing"
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.05) 100%)",
          border: "1px solid rgba(37,99,235,0.25)",
        }}
      >
        <span style={{ color: "#2563EB", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold" style={{ color: "#2563EB" }}>Pla gratuït</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fes upgrade per accedir a tot</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
    </div>
  );
}

function ExpandedSidebar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
  const { TOP_NAV, BOTTOM_NAV } = useNavItems();
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
  return (
    <aside
      className="sticky top-0 h-screen flex flex-col shrink-0 overflow-hidden"
      style={{ width: 240, background: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <Link href="/dashboard"><ScpLogo /></Link>
        <button
          onClick={onToggle}
          className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
          style={{ width: 30, height: 30, color: "var(--text-muted)", background: "var(--bg-input)" }}
          title="Collapse sidebar"
        >
          <NavIcon name="chevron-left" size={15} />
        </button>
      </div>

      {/* Top nav */}
      <nav className="flex-1 px-2 overflow-y-auto">
        <div className="space-y-0.5">
          {TOP_NAV.map((item) => (
            <NavItemRow key={item.label} item={item} isFree={isFree} isNonBasic={isNonBasic} isSuperAdmin={isSuper} active={pathname === item.href || (item.href === "/feed" && item.label === "Content Library" && pathname === "/feed")} />
          ))}
        </div>

        <div className="my-3 mx-1" style={{ borderTop: "1px solid var(--border-color)" }} />

        <div className="space-y-0.5">
          {BOTTOM_NAV.map((item) => (
            <NavItemRow key={item.label} item={item} active={false} />
          ))}
        </div>

        <AnnualBanner />
      </nav>

      {/* Upgrade CTA for free plan */}
      <UpgradeCta />

      {/* Admin shortcut for superadmins */}
      {isSuper && (
        <div className="px-3 pb-1 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#2563EB" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Panel
          </Link>
        </div>
      )}

      {/* User profile card */}
      <div className="px-3 pb-2 shrink-0">
        <DashboardUserProfile />
      </div>

      {/* Support / Tutorial button */}
      <SupportButton />
    </aside>
  );
}

function CollapsedTopBar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
  const { TOP_NAV, BOTTOM_NAV } = useNavItems();
  const allNav = [...TOP_NAV, ...BOTTOM_NAV];
  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 px-4 shrink-0"
      style={{ height: 48, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}
    >
      {/* Hamburger */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-lg transition-all hover:opacity-80 shrink-0"
        style={{ width: 32, height: 32, color: "var(--text-muted)", background: "var(--bg-input)" }}
        title="Expand sidebar"
      >
        <NavIcon name="hamburger" size={16} />
      </button>

      <Link href="/dashboard" className="shrink-0">
        <ScpLogo compact />
      </Link>

      <div className="w-px self-stretch my-2.5 shrink-0" style={{ background: "var(--border-color)" }} />

      {/* Nav icons */}
      <nav className="flex items-center gap-0.5 overflow-x-auto">
        {allNav.map((item) => (
          <NavIconButton
            key={item.label}
            item={item}
            active={pathname === item.href}
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

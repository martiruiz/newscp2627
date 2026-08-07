"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import DashboardUserProfile from "./DashboardUserProfile";

const ANNUAL_BANNER_DISMISSED_KEY = "scp-annual-banner-dismissed";
const ANNUAL_BANNER_START_KEY = "scp-annual-banner-start";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function AnnualBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(TWENTY_FOUR_HOURS);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ANNUAL_BANNER_DISMISSED_KEY)) return;

      let start = Number(sessionStorage.getItem(ANNUAL_BANNER_START_KEY));
      if (!start) {
        start = Date.now();
        sessionStorage.setItem(ANNUAL_BANNER_START_KEY, String(start));
      }

      const left = start + TWENTY_FOUR_HOURS - Date.now();
      if (left <= 0) return; // expired this session

      setRemaining(left);
      setVisible(true);

      const timer = setInterval(() => {
        const r = start + TWENTY_FOUR_HOURS - Date.now();
        if (r <= 0) {
          setVisible(false);
          clearInterval(timer);
        } else {
          setRemaining(r);
        }
      }, 1000);

      return () => clearInterval(timer);
    } catch {}
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(ANNUAL_BANNER_DISMISSED_KEY, "1"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="mx-2 mt-2 rounded-xl px-3 py-2.5"
      style={{
        background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
        border: "1px solid #f9a8d4",
      }}
    >
      <p className="text-[11px] leading-snug mb-2" style={{ color: "#9d174d" }}>
        {t("banner.annualText").split("10€").map((part, i, arr) =>
          i < arr.length - 1
            ? <span key={i}>{part}<strong>10€</strong></span>
            : <span key={i}>{part}</span>
        )}
      </p>
      <div
        className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 mb-2"
        style={{ background: "rgba(190,24,93,0.1)", border: "1px solid rgba(190,24,93,0.2)" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="text-[11px] font-bold font-mono" style={{ color: "#be185d" }}>
          {t("banner.expires")} {formatCountdown(remaining)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Link
          href="/account?tab=subscription"
          className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:opacity-90"
          style={{ background: "#be185d", color: "#fff" }}
        >
          {t("banner.saveNow")}
        </Link>
        <button
          onClick={dismiss}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
          style={{ color: "#be185d", background: "transparent" }}
        >
          {t("banner.dismiss")}
        </button>
      </div>
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

function NavItemRow({ item, active }: { item: NavItem; active: boolean }) {
  const cls = "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all text-left";
  const style = { background: active ? "var(--color-charcoal-subtle)" : "transparent", color: active ? "var(--color-charcoal)" : "var(--text-secondary)" };
  const inner = (
    <>
      <span style={{ color: active ? "var(--color-charcoal)" : "var(--text-muted)" }}><NavIcon name={item.icon} size={16} /></span>
      <span className="font-medium" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </>
  );
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

function ExpandedSidebar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
  const { TOP_NAV, BOTTOM_NAV } = useNavItems();
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
            <NavItemRow key={item.label} item={item} active={pathname === item.href || (item.href === "/feed" && item.label === "Content Library" && pathname === "/feed")} />
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

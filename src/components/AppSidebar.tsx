"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
}

const TOP_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Content Library", href: "/feed", icon: "library" },
  { label: "Blog", href: "#blog", icon: "blog" },
  { label: "News", href: "/news", icon: "news" },
  { label: "Pricing", href: "#pricing", icon: "pricing" },
  { label: "Contact", href: "#contact", icon: "contact" },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Saved", href: "/saved", icon: "saved" },
  { label: "Account", href: "/account", icon: "account" },
  { label: "Cerrar sesión", href: "#signout", icon: "signout" },
];

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
  const isHash = item.href.startsWith("#");
  const Tag = isHash ? "button" : Link;
  const props = isHash ? { onClick: () => {} } : { href: item.href };

  return (
    <Tag
      {...(props as Record<string, unknown>)}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all text-left"
      style={{
        background: active ? "rgba(200,144,40,0.12)" : "transparent",
        color: active ? "#F5C542" : "var(--text-secondary)",
      }}
    >
      <span style={{ color: active ? "#F5C542" : "var(--text-muted)" }}>
        <NavIcon name={item.icon} size={16} />
      </span>
      <span className="font-medium truncate">{item.label}</span>
    </Tag>
  );
}

function NavIconButton({ item, active, title }: { item: NavItem; active: boolean; title: string }) {
  const isHash = item.href.startsWith("#");
  const Tag = isHash ? "button" : Link;
  const props = isHash ? { onClick: () => {} } : { href: item.href };

  return (
    <Tag
      {...(props as Record<string, unknown>)}
      className="flex items-center justify-center rounded-lg transition-all"
      style={{
        width: 34,
        height: 34,
        background: active ? "rgba(200,144,40,0.15)" : "transparent",
        color: active ? "#F5C542" : "var(--text-muted)",
      }}
      title={title}
    >
      <NavIcon name={item.icon} size={16} />
    </Tag>
  );
}

function ExpandedSidebar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
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
      </nav>

      {/* Upgrade CTA */}
      <div className="p-3 shrink-0">
        <div
          className="rounded-xl p-3"
          style={{ background: "rgba(200,144,40,0.08)", border: "1px solid rgba(200,144,40,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="text-lg">🚀</div>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Upgrade to Pro</span>
          </div>
          <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Unlock advanced tools, insights and premium content for creators.
          </p>
          <button
            className="w-full py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
            style={{ background: "#F5C542", color: "#fff" }}
          >
            See Plans
          </button>
        </div>
      </div>
    </aside>
  );
}

function CollapsedTopBar({ onToggle, pathname }: { onToggle: () => void; pathname: string }) {
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

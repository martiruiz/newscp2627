"use client";

import { useState } from "react";

// Edit these values to update the user profile
const USER = {
  name: "Alex Creator",
  email: "alex@scpplaybook.com",
  // avatarUrl: "/avatar.jpg",  // uncomment and set a path to use a real photo
};

const MENU_ITEMS = [
  { label: "My account", icon: "account", href: "#account" },
  { label: "Settings", icon: "settings", href: "#settings" },
  { label: "Billing", icon: "billing", href: "#billing" },
  { label: "Help", icon: "help", href: "#help" },
];

function MenuIcon({ name }: { name: string }) {
  switch (name) {
    case "account":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "settings":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "billing":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case "help":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    default:
      return null;
  }
}

export default function DashboardUserProfile() {
  const [open, setOpen] = useState(false);

  const initials = USER.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all hover:opacity-80"
        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
      >
        {/* Avatar */}
        <div
          className="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-bold text-xs"
          style={{ width: 30, height: 30, background: "linear-gradient(135deg, #F5C542, #F5C542)" }}
        >
          {initials}
        </div>

        {/* Name + email */}
        <div className="text-left">
          <div className="text-xs font-semibold leading-none mb-0.5" style={{ color: "var(--text-primary)" }}>
            {USER.name}
          </div>
          <div className="text-[10px] leading-none" style={{ color: "var(--text-muted)" }}>
            {USER.email}
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: "var(--text-muted)" }}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute right-0 mt-2 z-50 rounded-xl overflow-hidden"
            style={{
              width: 220,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* User info header */}
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{USER.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{USER.email}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {MENU_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs transition-all hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => setOpen(false)}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    <MenuIcon name={item.icon} />
                  </span>
                  {item.label}
                </a>
              ))}
            </div>

            {/* Sign out */}
            <div style={{ borderTop: "1px solid var(--border-color)" }} className="py-1">
              <button
                className="flex items-center gap-3 w-full px-4 py-2.5 text-xs transition-all hover:opacity-80"
                style={{ color: "#ef4444" }}
                onClick={() => setOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────────────────── */

type UserTypeId =
  | "club" | "federation_league" | "content_creator"
  | "agency" | "brand_sponsor" | "sports_media" | "other";

type GoalId =
  | "content_ideas" | "audience_growth" | "trends"
  | "content_planning" | "competitor_analysis" | "partnerships";

interface Draft {
  step: number;
  user_type: UserTypeId | null;
  sports: string[];
  goals: GoalId[];
  startedAt: number;
}

/* ─── Icons ──────────────────────────────────────────────────────────── */

const I = {
  // User types
  Club: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Federation: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  ),
  Creator: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Agency: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  Brand: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Media: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
    </svg>
  ),
  Other: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),

  // Sports
  Football: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
      <path d="M2 12h20"/>
    </svg>
  ),
  Basketball: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M4.93 4.93c4.08 4.08 4.08 10.73 0 14.82"/>
      <path d="M19.07 4.93c-4.08 4.08-4.08 10.73 0 14.82"/>
      <path d="M2 12h20"/>
    </svg>
  ),
  Handball: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  ),
  Tennis: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M18.6 6.62c-1.44 7.56-7.77 11.58-16.67 5.36"/>
      <path d="M5.4 17.38c1.44-7.56 7.77-11.58 16.67-5.36"/>
    </svg>
  ),
  Motorsport: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.64-7.07-2.12 2.12M7.76 16.24l-2.12 2.12M16.24 16.24l2.12 2.12M7.76 7.76 5.64 5.64"/>
    </svg>
  ),
  Volleyball: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2c3 4 3 8 0 12"/>
      <path d="M12 2c-3 4-3 8 0 12"/>
      <path d="M2 12h20"/>
    </svg>
  ),
  Rugby: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2"/>
      <path d="M12 2v20M2 12h20"/>
      <ellipse cx="12" cy="12" rx="4" ry="10"/>
    </svg>
  ),
  Hockey: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 14c0-4.42 3.58-8 8-8h2a2 2 0 0 1 0 4h-2a4 4 0 0 0-4 4v1a1 1 0 0 0 1 1h8"/>
      <path d="M5 20h14"/>
    </svg>
  ),
  Aquatics: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11s2.5 2 5 2 2.5-2 5-2 2.5 2 2.5 2"/>
      <path d="M2 17c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 2.5 2"/>
      <path d="M13 7l-1-4.5A1 1 0 0 0 11 2H9a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h.5L11 7"/>
      <circle cx="13" cy="7" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),

  // Goals
  Lightbulb: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6"/><path d="M10 22h4"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  ),
  TrendUp: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Zap: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Eye: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Link: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),

  // UI
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Bolt: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="#F5C542">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
};

/* ─── Data ───────────────────────────────────────────────────────────── */

const USER_TYPES: { id: UserTypeId; Icon: () => JSX.Element; label: string }[] = [
  { id: "club",              Icon: I.Club,       label: "Club / Team" },
  { id: "federation_league", Icon: I.Federation, label: "Federation / League" },
  { id: "content_creator",   Icon: I.Creator,    label: "Content Creator" },
  { id: "agency",            Icon: I.Agency,     label: "Agency" },
  { id: "brand_sponsor",     Icon: I.Brand,      label: "Brand / Sponsor" },
  { id: "sports_media",      Icon: I.Media,      label: "Sports Media" },
  { id: "other",             Icon: I.Other,      label: "Other" },
];

const SPORTS_PRIMARY: { id: string; Icon: () => JSX.Element; label: string }[] = [
  { id: "football",   Icon: I.Football,   label: "Football" },
  { id: "basketball", Icon: I.Basketball, label: "Basketball" },
  { id: "handball",   Icon: I.Handball,   label: "Handball" },
  { id: "tennis",     Icon: I.Tennis,     label: "Tennis" },
  { id: "motorsport", Icon: I.Motorsport, label: "Motorsport" },
  { id: "volleyball", Icon: I.Volleyball, label: "Volleyball" },
  { id: "rugby",      Icon: I.Rugby,      label: "Rugby" },
  { id: "hockey",     Icon: I.Hockey,     label: "Hockey" },
  { id: "aquatics",   Icon: I.Aquatics,   label: "Aquatics" },
];

const SPORTS_MORE: { id: string; label: string }[] = [
  { id: "golf",          label: "Golf" },
  { id: "cycling",       label: "Cycling" },
  { id: "athletics",     label: "Athletics" },
  { id: "boxing",        label: "Boxing" },
  { id: "mma",           label: "MMA / UFC" },
  { id: "esports",       label: "Esports" },
  { id: "fitness",       label: "Fitness / Gym" },
  { id: "surf",          label: "Surf" },
  { id: "padel",         label: "Padel" },
  { id: "skiing",        label: "Skiing" },
  { id: "climbing",      label: "Climbing" },
  { id: "gymnastics",    label: "Gymnastics" },
  { id: "badminton",     label: "Badminton" },
  { id: "table_tennis",  label: "Table Tennis" },
  { id: "triathlon",     label: "Triathlon" },
  { id: "rowing",        label: "Rowing" },
  { id: "baseball",      label: "Baseball" },
  { id: "weightlifting", label: "Weightlifting" },
  { id: "horse_racing",  label: "Horse Racing" },
  { id: "field_hockey",  label: "Field Hockey" },
];

const GOALS: { id: GoalId; Icon: () => JSX.Element; label: string; desc: string }[] = [
  { id: "content_ideas",       Icon: I.Lightbulb, label: "Find content ideas",     desc: "Discover proven ideas you can adapt." },
  { id: "audience_growth",     Icon: I.TrendUp,   label: "Grow my audience",       desc: "Increase reach and followers." },
  { id: "trends",              Icon: I.Zap,       label: "Discover trends",        desc: "See what's gaining momentum." },
  { id: "content_planning",    Icon: I.Calendar,  label: "Plan my content",        desc: "Know what to publish next." },
  { id: "competitor_analysis", Icon: I.Eye,       label: "Analyze competitors",    desc: "See what works for others." },
  { id: "partnerships",        Icon: I.Link,      label: "Find partnership ideas", desc: "Discover sponsorship and collaboration opportunities." },
];

const DRAFT_KEY = "scp-onboarding-v2";
const TOTAL_STEPS = 3;

/* ─── Colors ─────────────────────────────────────────────────────────── */

const C = {
  pageBg:       "#F8F9FA",
  cardBg:       "#FFFFFF",
  navy:         "#0D1421",
  navyTint:     "rgba(13,20,33,0.05)",
  gray100:      "#F3F4F6",
  gray200:      "#E5E7EB",
  text:         "#0D1117",
  textMuted:    "#6B7280",
  iconDefault:  "#9CA3AF",
  disabledBg:   "#E5E7EB",
  disabledText: "#9CA3AF",
};

/* ─── Utils ──────────────────────────────────────────────────────────── */

function haptic() {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8); } catch {}
}

function track(event: string, props?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") console.log("[scp:onboarding]", event, props ?? "");
}

/* ─── Shared components ──────────────────────────────────────────────── */

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6, flex: 1 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? C.navy : C.gray200, transition: "background 0.35s ease" }} />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      style={{ width: 38, height: 38, borderRadius: 19, background: C.gray100, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent", color: C.navy }}
    >
      <I.ChevronLeft />
    </button>
  );
}

interface CardProps {
  Icon: () => JSX.Element;
  label: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function OptionCard({ Icon, label, desc, selected, onClick, disabled }: CardProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: desc ? "14px 16px" : "12px 16px",
        minHeight: desc ? 80 : 72,
        background: selected ? C.navyTint : C.cardBg,
        border: `2px solid ${selected ? C.navy : C.gray200}`,
        borderRadius: 20,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        opacity: disabled ? 0.35 : 1,
        boxShadow: selected ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "border-color 0.15s, background 0.15s, transform 0.1s, box-shadow 0.15s",
        userSelect: "none",
      }}
    >
      {/* Icon container */}
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          background: selected ? "rgba(13,20,33,0.08)" : C.gray100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: selected ? C.navy : C.iconDefault,
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <Icon />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>

      {/* Selection indicator */}
      <div
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          border: `2px solid ${selected ? C.navy : C.gray200}`,
          background: selected ? C.navy : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s ease",
        }}
      >
        {selected && <I.Check />}
      </div>
    </button>
  );
}

function CTAButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 56,
        borderRadius: 18,
        background: disabled ? C.disabledBg : C.navy,
        color: disabled ? C.disabledText : "#FFFFFF",
        border: "none",
        fontSize: 16,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "0.01em",
        transition: "background 0.2s, color 0.2s",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {label}
      {!disabled && <I.ChevronRight />}
    </button>
  );
}

/* ─── More Sports Sheet ──────────────────────────────────────────────── */

function MoreSportsSheet({ selected, onToggle, onClose }: { selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 290);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", opacity: visible ? 1 : 0, transition: "opacity 0.28s ease" }} />
      <div style={{ position: "relative", background: C.pageBg, borderRadius: "28px 28px 0 0", maxHeight: "78vh", display: "flex", flexDirection: "column", transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 6px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.gray200 }} />
        </div>
        {/* Header */}
        <div style={{ padding: "4px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>More sports</div>
          <button onClick={close} style={{ width: 32, height: 32, borderRadius: 16, background: C.gray100, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted }} aria-label="Close">
            <I.Close />
          </button>
        </div>
        {/* Sport chips */}
        <div style={{ overflowY: "auto", padding: "0 20px 20px", display: "flex", flexWrap: "wrap", gap: 10 }}>
          {SPORTS_MORE.map((sport) => {
            const sel = selected.includes(sport.id);
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => { haptic(); onToggle(sport.id); }}
                aria-pressed={sel}
                style={{
                  padding: "9px 16px",
                  borderRadius: 40,
                  border: `2px solid ${sel ? C.navy : C.gray200}`,
                  background: sel ? C.navyTint : C.cardBg,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.text,
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {sport.label}
              </button>
            );
          })}
        </div>
        {/* Done */}
        <div style={{ padding: "0 20px 8px" }}>
          <CTAButton label="Done" onClick={close} disabled={false} />
        </div>
      </div>
    </div>
  );
}

/* ─── Building overlay ───────────────────────────────────────────────── */

function BuildingOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, background: C.pageBg, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", animation: "scp-pulse 1.4s ease-in-out infinite" }}>
        <I.Bolt />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>Building your Playbook…</div>
        <div style={{ fontSize: 14, color: C.textMuted }}>Personalizing your experience</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: C.navy, opacity: 0.3, animation: `scp-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`
        @keyframes scp-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(.93);opacity:.85} }
        @keyframes scp-dot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserTypeId | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [showMoreSports, setShowMoreSports] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [goalsWarning, setGoalsWarning] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Load draft */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d: Draft = JSON.parse(raw);
        if (d.step) setStep(d.step);
        if (d.user_type) setUserType(d.user_type);
        if (d.sports) setSports(d.sports);
        if (d.goals) setGoals(d.goals as GoalId[]);
        if (d.startedAt) startTimeRef.current = d.startedAt;
      } else {
        startTimeRef.current = Date.now();
        persist(1, null, [], []);
      }
    } catch {}
    track("onboarding_started");
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { track("onboarding_step_viewed", { step }); }, [step]);

  function persist(s: number, ut: UserTypeId | null, sp: string[], gl: GoalId[]) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: s, user_type: ut, sports: sp, goals: gl, startedAt: startTimeRef.current })); } catch {}
  }

  const goToStep = useCallback((next: number) => {
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 160);
  }, []);

  function selectUserType(id: UserTypeId) {
    if (userType === id || animating) return;
    haptic();
    setUserType(id);
    persist(2, id, sports, goals);
    track("onboarding_user_type_selected", { user_type: id });
    autoAdvanceRef.current = setTimeout(() => goToStep(2), 320);
  }

  function toggleSport(id: string) {
    haptic();
    setSports((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      persist(step, userType, next, goals);
      if (!prev.includes(id)) track("onboarding_sport_selected", { sport: id });
      return next;
    });
  }

  function toggleGoal(id: GoalId) {
    setGoals((prev) => {
      if (prev.includes(id)) { haptic(); return prev.filter((g) => g !== id); }
      if (prev.length >= 2) { setGoalsWarning(true); setTimeout(() => setGoalsWarning(false), 1200); return prev; }
      haptic();
      track("onboarding_goal_selected", { goal: id });
      return [...prev, id];
    });
  }

  function goBack() {
    if (animating) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    goToStep(step - 1);
  }

  async function handleSubmit() {
    if (goals.length === 0) return;
    setIsBuilding(true);
    const completionTime = Math.round((Date.now() - startTimeRef.current) / 1000);
    track("onboarding_completed", { user_type: userType, sports, goals, completion_time_seconds: completionTime });
    try {
      await Promise.all([
        fetch("/api/user/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userType, userSports: sports, goals }),
        }),
        new Promise((r) => setTimeout(r, 1100)),
      ]);
    } catch {}
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    router.replace("/dashboard");
  }

  const safeTop = "env(safe-area-inset-top, 0px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  return (
    <div style={{ position: "fixed", inset: 0, background: C.pageBg, display: "flex", flexDirection: "column", overflowY: "hidden" }}>
      {isBuilding && <BuildingOverlay />}

      {/* Header */}
      <div style={{ padding: `max(${safeTop}, 52px) 24px 0`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          {step > 1 ? <BackButton onClick={goBack} /> : <div style={{ width: 38, flexShrink: 0 }} />}
          <ProgressBar step={step} />
          <div style={{ width: 38, flexShrink: 0 }} />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "0 24px",
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.16s ease, transform 0.16s ease",
        }}
      >
        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: "clamp(30px,8vw,36px)", fontWeight: 900, color: C.text, lineHeight: 1.15, margin: "0 0 28px", letterSpacing: "-0.02em" }}>
              What best describes you?
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {USER_TYPES.map((t) => (
                <OptionCard key={t.id} Icon={t.Icon} label={t.label} selected={userType === t.id} onClick={() => selectUserType(t.id)} />
              ))}
            </div>
            <div style={{ height: 32 }} />
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: "clamp(30px,8vw,36px)", fontWeight: 900, color: C.text, lineHeight: 1.15, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              What sports are you interested in?
            </h1>
            <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 24px", fontWeight: 500 }}>Choose all that apply</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SPORTS_PRIMARY.map((s) => (
                <OptionCard key={s.id} Icon={s.Icon} label={s.label} selected={sports.includes(s.id)} onClick={() => toggleSport(s.id)} />
              ))}

              {/* More sports trigger */}
              <button
                type="button"
                onClick={() => setShowMoreSports(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  padding: "12px 16px", minHeight: 72,
                  background: C.cardBg, border: `2px dashed ${C.gray200}`, borderRadius: 20,
                  cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 13, background: C.gray100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.iconDefault }}>
                  <I.Plus />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>More sports</div>
                  {sports.filter((id) => SPORTS_MORE.find((s) => s.id === id)).length > 0 && (
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                      {sports.filter((id) => SPORTS_MORE.find((s) => s.id === id)).length} selected
                    </div>
                  )}
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${C.gray200}`, background: "transparent", flexShrink: 0 }} />
              </button>
            </div>
            <div style={{ height: 120 }} />
          </>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <>
            <h1 style={{ fontSize: "clamp(30px,8vw,36px)", fontWeight: 900, color: C.text, lineHeight: 1.15, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              What do you want to achieve?
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 24px", color: goalsWarning ? "#EF4444" : C.textMuted, transition: "color 0.2s" }}>
              {goalsWarning ? "Maximum 2 goals" : "Choose up to 2"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GOALS.map((g) => {
                const sel = goals.includes(g.id);
                return (
                  <OptionCard key={g.id} Icon={g.Icon} label={g.label} desc={g.desc} selected={sel} onClick={() => toggleGoal(g.id)} disabled={!sel && goals.length >= 2} />
                );
              })}
            </div>
            <div style={{ height: 120 }} />
          </>
        )}
      </div>

      {/* CTA footer */}
      {step >= 2 && (
        <div style={{ flexShrink: 0, padding: `16px 24px max(${safeBottom}, 28px)`, background: C.pageBg, borderTop: `1px solid ${C.gray200}` }}>
          {step === 2 && (
            <CTAButton label="Continue" onClick={() => { persist(3, userType, sports, goals); goToStep(3); }} disabled={sports.length === 0} />
          )}
          {step === 3 && (
            <CTAButton label="Build my Playbook" onClick={handleSubmit} disabled={goals.length === 0} />
          )}
        </div>
      )}

      {showMoreSports && <MoreSportsSheet selected={sports} onToggle={toggleSport} onClose={() => setShowMoreSports(false)} />}
    </div>
  );
}

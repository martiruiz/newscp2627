"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import { PROFILES, type Profile } from "@/lib/profiles-data";
import PlanBuilder, { type ContentPlan } from "./PlanBuilder";
import InspirationPanel from "@/components/InspirationPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarStatus = "planned" | "in_production" | "ready" | "published";

export interface CalendarItem {
  id: string;
  userId: string;
  sourceContentId: string | null;
  sourceType: "scp" | "custom";
  title: string;
  plannedDate: string;
  plannedTime: string | null;
  status: CalendarStatus;
  platforms: string[];
  collaborators: string[];
  notes: string | null;
  hook: string | null;
  script: string | null;
  cta: string | null;
  referenceUrl: string | null;
  thumbnailUrl: string | null;
  creatorName: string | null;
  sport: string | null;
  contentFormat: string | null;
  planId: string | null;
  phaseId: string | null;
  priority: string | null;
  contentPillar: string | null;
  campaign: string | null;
  objective: string | null;
  targetAudience: string | null;
  assigneeId: string | null;
  productionDeadline: string | null;
  approvalStatus: string | null;
  approverId: string | null;
  shortConcept: string | null;
  whyThisIdea: string | null;
  caption: string | null;
  shotList: string | null;
  requiredAssets: string | null;
  publishedUrl: string | null;
  hubPhase: string | null;
  publishedBy: string | null;
  visibility: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PublicationFromCard {
  id: string;
  platform: string;
  accountUsername: string | null;
  originalUrl: string | null;
  canonicalUrl: string;
  sports: string[];
  contentFormat: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CalendarStatus, { bg: string; text: string; border: string; labelKey: TranslationKey }> = {
  planned: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD", labelKey: "calendar.planned" },
  in_production: { bg: "#FEF3C7", text: "#D97706", border: "#FCD34D", labelKey: "calendar.inProduction" },
  ready: { bg: "#D1FAE5", text: "#059669", border: "#6EE7B7", labelKey: "calendar.ready" },
  published: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB", labelKey: "calendar.published" },
};

const STATUSES: CalendarStatus[] = ["planned", "in_production", "ready", "published"];

const PLATFORM_CONFIG: { name: string; color: string; icon: React.ReactNode }[] = [
  {
    name: "Instagram",
    color: "#E1306C",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>,
  },
  {
    name: "TikTok",
    color: "#000000",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.14 8.14 0 0 0 4.77 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>,
  },
  {
    name: "YouTube",
    color: "#FF0000",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>,
  },
  {
    name: "Twitter",
    color: "#000000",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    name: "Facebook",
    color: "#1877F2",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    name: "LinkedIn",
    color: "#0A66C2",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  },
  {
    name: "Pinterest",
    color: "#E60023",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>,
  },
];

const WEEK_DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function getMonthGrid(d: Date): Date[] {
  const first = startOfMonth(d);
  const last = endOfMonth(d);
  const gridStart = startOfWeek(first);
  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= last || days.length % 7 !== 0 || days.length < 35) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
    if (days.length > 42) break;
  }
  return days;
}

function getWeekDays(d: Date): Date[] {
  const mon = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "#0D1421", color: "#fff", padding: "10px 20px", borderRadius: 999,
      fontSize: 14, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    }}>
      {msg}
    </div>
  );
}

// ── Profile Avatar ────────────────────────────────────────────────────────────

function ProfileAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = `/api/ig-avatar?u=${encodeURIComponent(profile.username)}`;
  const initials = profile.fullname.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = profile.username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  if (failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},60%,50%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
    );
  }
  return (
    <img
      src={photoUrl}
      alt={profile.fullname}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  );
}

// ── Item Modal (Add / Edit) ───────────────────────────────────────────────────

interface ItemModalProps {
  item: Partial<CalendarItem> | null;
  defaultDate?: string;
  onClose: () => void;
  onSave: (item: CalendarItem) => void;
  onDelete?: (id: string) => void;
  t: (k: TranslationKey) => string;
}

// Custom date picker
function CustomDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const DAYS_CA = ["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."];
  const MONTHS_CA = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday-first: 0=Mon..6=Sun
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; cur: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - startDow + 1, cur: false });

  function select(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toDateStr(d));
    setOpen(false);
  }

  const displayDate = value
    ? new Date(value + "T12:00:00").toLocaleDateString("ca-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "Selecciona data";

  const today = toDateStr(new Date());
  const selDay = parsed.getDate();
  const selMonth = parsed.getMonth();
  const selYear = parsed.getFullYear();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (value) { const d = new Date(value + "T12:00:00"); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); } }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style={{ flex: 1 }}>{displayDate}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "14px 16px", width: 256 }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <button type="button" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-color)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{MONTHS_CA[viewMonth]} {viewYear}</div>
            <button type="button" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-color)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {DAYS_CA.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "2px 0", textTransform: "uppercase" }}>{d}</div>)}
          </div>
          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((c, i) => {
              const isSelected = c.cur && c.day === selDay && viewMonth === selMonth && viewYear === selYear;
              const cellDate = toDateStr(new Date(viewYear, viewMonth, c.day));
              const isToday = c.cur && cellDate === today;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => c.cur && select(c.day)}
                  style={{
                    height: 30, borderRadius: 8, border: "none", fontSize: 12, fontWeight: isSelected ? 700 : 400, cursor: c.cur ? "pointer" : "default",
                    background: isSelected ? "var(--accent-primary)" : "transparent",
                    color: isSelected ? "#fff" : c.cur ? (isToday ? "var(--accent-primary)" : "var(--text-primary)") : "var(--text-muted)",
                    outline: isToday && !isSelected ? "1.5px solid var(--accent-primary)" : "none",
                    opacity: c.cur ? 1 : 0.35,
                  }}
                >{c.day}</button>
              );
            })}
          </div>
          {/* Footer */}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: 8 }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Esborra</button>
            <button type="button" onClick={() => { onChange(today); setOpen(false); }} style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Avui</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom time picker
function CustomTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hh, setHh] = useState(value ? value.slice(0, 2) : "");
  const [mm, setMm] = useState(value ? value.slice(3, 5) : "");
  const ref = React.useRef<HTMLDivElement>(null);
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && hh) {
      const el = hourRef.current?.querySelector(`[data-h="${hh}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "center" });
    }
    if (open && mm) {
      const el = minRef.current?.querySelector(`[data-m="${mm}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "center" });
    }
  }, [open, hh, mm]);

  function commit(h: string, m: string) {
    if (h && m) onChange(`${h}:${m}`);
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const displayTime = value || "—:—";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style={{ flex: 1, fontVariantNumeric: "tabular-nums" }}>{displayTime}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: 14, width: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, textAlign: "center" }}>Hora</div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Hours */}
            <div ref={hourRef} style={{ flex: 1, overflowY: "auto", maxHeight: 200, borderRadius: 10, border: "1px solid var(--border-color)", scrollbarWidth: "none" }}>
              {HOURS.map(h => (
                <button
                  key={h}
                  data-h={h}
                  type="button"
                  onClick={() => { setHh(h); commit(h, mm); }}
                  style={{ width: "100%", padding: "7px 0", fontSize: 14, fontWeight: hh === h ? 700 : 400, fontVariantNumeric: "tabular-nums", border: "none", background: hh === h ? "var(--accent-primary)" : "transparent", color: hh === h ? "#fff" : "var(--text-primary)", cursor: "pointer", textAlign: "center", borderRadius: 8 }}
                >{h}</button>
              ))}
            </div>
            {/* Separator */}
            <div style={{ display: "flex", alignItems: "center", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>:</div>
            {/* Minutes */}
            <div ref={minRef} style={{ flex: 1, overflowY: "auto", maxHeight: 200, borderRadius: 10, border: "1px solid var(--border-color)", scrollbarWidth: "none" }}>
              {MINS.map(m => (
                <button
                  key={m}
                  data-m={m}
                  type="button"
                  onClick={() => { setMm(m); commit(hh, m); }}
                  style={{ width: "100%", padding: "7px 0", fontSize: 14, fontWeight: mm === m ? 700 : 400, fontVariantNumeric: "tabular-nums", border: "none", background: mm === m ? "var(--accent-primary)" : "transparent", color: mm === m ? "#fff" : "var(--text-primary)", cursor: "pointer", textAlign: "center", borderRadius: 8 }}
                >{m}</button>
              ))}
            </div>
          </div>
          {value && (
            <button type="button" onClick={() => { onChange(""); setHh(""); setMm(""); setOpen(false); }} style={{ marginTop: 8, width: "100%", padding: "6px 0", fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Eliminar hora</button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemModal({ item, defaultDate, onClose, onSave, onDelete, t }: ItemModalProps) {
  const isEdit = Boolean(item?.id);
  const [title, setTitle] = useState(item?.title || "");
  const [date, setDate] = useState(item?.plannedDate || defaultDate || toDateStr(new Date()));
  const [time, setTime] = useState(item?.plannedTime || "");
  const [status, setStatus] = useState<CalendarStatus>(item?.status || "planned");
  const [platforms, setPlatforms] = useState<string[]>(item?.platforms || []);
  const [collaborators, setCollaborators] = useState<string[]>(item?.collaborators || []);
  const [profileSearch, setProfileSearch] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [collabType, setCollabType] = useState<"creator" | "club" | "competition">("creator");
  const [entityOptions, setEntityOptions] = useState<{ clubs: string[]; competitions: string[] }>({ clubs: [], competitions: [] });
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [notes, setNotes] = useState(item?.notes || "");
  const [hook, setHook] = useState(item?.hook || "");
  const [script, setScript] = useState(item?.script || "");
  const [cta, setCta] = useState(item?.cta || "");
  const [referenceUrl, setReferenceUrl] = useState(item?.referenceUrl || "");
  const [sport, setSport] = useState(item?.sport || "");
  const [loading, setLoading] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  type SavedPub = { id: string; canonicalUrl: string; embedUrl?: string | null; thumbnailUrl?: string | null; accountUsername?: string | null; platform: string; caption?: string | null };
  const [savedPubs, setSavedPubs] = useState<SavedPub[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linkedPlanId = item?.planId || null;

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function toggleCollaborator(entry: string) {
    setCollaborators((prev) => prev.includes(entry) ? prev.filter((x) => x !== entry) : [...prev, entry]);
  }

  async function openCollabPicker() {
    setShowProfilePicker((v) => !v);
    if (entityOptions.clubs.length === 0 && !loadingEntities) {
      setLoadingEntities(true);
      try {
        const res = await fetch("/api/filters");
        if (res.ok) {
          const data = await res.json();
          setEntityOptions({
            clubs: (data.clubs || []).map((c: { name: string } | string) => typeof c === "string" ? c : c.name).filter(Boolean),
            competitions: (data.competitions || []).map((c: { name: string } | string) => typeof c === "string" ? c : c.name).filter(Boolean),
          });
        }
      } finally { setLoadingEntities(false); }
    }
  }

  const filteredProfiles = PROFILES.filter((p) =>
    !profileSearch ||
    p.username.toLowerCase().includes(profileSearch.toLowerCase()) ||
    p.fullname.toLowerCase().includes(profileSearch.toLowerCase())
  );

  function collabEntryLabel(entry: string): string {
    if (entry.startsWith("creator:")) return entry.slice(8);
    if (entry.startsWith("club:")) return entry.slice(5);
    if (entry.startsWith("competition:")) return entry.slice(12);
    return entry;
  }

  function collabEntryProfile(entry: string) {
    if (entry.startsWith("creator:")) return PROFILES.find((p) => p.username === entry.slice(8)) || null;
    if (!entry.includes(":")) return PROFILES.find((p) => p.username === entry) || null;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setLoading(true);
    try {
      const payload = {
        title: title.trim(), plannedDate: date, plannedTime: time || null, status,
        platforms, collaborators, notes: notes || null,
        hook: hook || null, script: script || null, cta: cta || null,
        referenceUrl: referenceUrl || null,
        sport: sport || null, creatorName: item?.creatorName || null,
        sourceContentId: item?.sourceContentId, sourceType: item?.sourceType || "custom",
        thumbnailUrl: item?.thumbnailUrl, contentFormat: item?.contentFormat,
        planId: linkedPlanId || undefined,
        hubPhase: item?.hubPhase || undefined,
      };
      const res = await fetch(
        isEdit ? `/api/calendar/${item!.id}` : "/api/calendar",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!res.ok) throw new Error();
      const saved = await res.json();
      onSave(saved);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!item?.id) return;
    setLoading(true);
    await fetch(`/api/calendar/${item.id}`, { method: "DELETE" });
    onDelete?.(item.id);
    setLoading(false);
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const sheetStyle: React.CSSProperties = {
    background: "var(--bg-primary)", borderRadius: 16, width: "100%", maxWidth: 560,
    maxHeight: "92dvh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)",
    background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };
  const taStyle: React.CSSProperties = { ...inputStyle, minHeight: 72, resize: "vertical" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 2 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
            {isEdit ? t("calendar.editItem") : t("calendar.addToCalendar")}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Title */}
            <div>
              <label style={labelStyle}>{t("calendar.customTitle")}</label>
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Content title..." />
            </div>

            {/* Date + Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>{t("calendar.date")}</label>
                <CustomDatePicker value={date} onChange={setDate} />
              </div>
              <div>
                <label style={labelStyle}>{t("calendar.time")}</label>
                <CustomTimePicker value={time} onChange={setTime} />
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>{t("calendar.status")}</label>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATUSES.length}, 1fr)`, gap: 6 }}>
                {STATUSES.map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = status === s;
                  return (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                      style={{ padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center",
                        border: `1.5px solid ${active ? cfg.border : "var(--border-color)"}`,
                        background: active ? cfg.bg : "transparent", color: active ? cfg.text : "var(--text-muted)" }}>
                      {t(cfg.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platforms with icons */}
            <div>
              <label style={labelStyle}>{t("calendar.platforms")}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PLATFORM_CONFIG.map((p) => {
                  const active = platforms.includes(p.name);
                  return (
                    <button key={p.name} type="button" onClick={() => togglePlatform(p.name)}
                      title={p.name}
                      style={{
                        width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${active ? p.color : "var(--border-color)"}`,
                        background: active ? p.color + "18" : "var(--bg-input)",
                        color: active ? p.color : "var(--text-muted)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                      {p.icon}
                    </button>
                  );
                })}
              </div>
              {platforms.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {platforms.map((p) => {
                    const cfg = PLATFORM_CONFIG.find((x) => x.name === p);
                    return (
                      <span key={p} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: (cfg?.color || "#666") + "18", color: cfg?.color || "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
                        {p}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Collaborators (Creators / Clubs / Competitions) */}
            <div>
              <label style={labelStyle}>Creators / Col·laboradors</label>
              {collaborators.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {collaborators.map((entry) => {
                    const profile = collabEntryProfile(entry);
                    const isClub = entry.startsWith("club:");
                    const isComp = entry.startsWith("competition:");
                    const label = collabEntryLabel(entry);
                    return (
                      <div key={entry} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 6px", borderRadius: 999, background: isComp ? "#EDE9FE" : isClub ? "#EFF6FF" : "var(--bg-hover)", border: `1px solid ${isComp ? "#C4B5FD" : isClub ? "#BFDBFE" : "var(--border-color)"}` }}>
                        {profile ? (
                          <ProfileAvatar profile={profile} size={22} />
                        ) : isClub ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600, color: isComp ? "#6D28D9" : isClub ? "#1D4ED8" : "var(--text-primary)" }}>{label}</span>
                        <button type="button" onClick={() => toggleCollaborator(entry)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-muted)", lineHeight: 1, marginLeft: 2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button type="button" onClick={openCollabPicker}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px dashed var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                {showProfilePicker ? "Amagar selector" : "Afegir creator, club o competició"}
              </button>
              {showProfilePicker && (
                <div style={{ marginTop: 8, border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
                  {/* Type tabs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--border-color)" }}>
                    {(["creator", "club", "competition"] as const).map((type) => {
                      const labels = { creator: "Creadors", club: "Clubs", competition: "Competicions" };
                      const colors = { creator: "var(--accent-primary)", club: "#3B82F6", competition: "#7C3AED" };
                      const active = collabType === type;
                      return (
                        <button key={type} type="button" onClick={() => { setCollabType(type); setProfileSearch(""); }}
                          style={{ padding: "8px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: active ? `${colors[type]}12` : "transparent", color: active ? colors[type] : "var(--text-muted)", borderBottom: active ? `2px solid ${colors[type]}` : "2px solid transparent" }}>
                          {labels[type]}
                        </button>
                      );
                    })}
                  </div>
                  {/* Search */}
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-color)" }}>
                    <input
                      value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)}
                      placeholder={collabType === "creator" ? "Cerca per nom o @username..." : collabType === "club" ? "Cerca clubs..." : "Cerca competicions..."}
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }}
                    />
                  </div>
                  {/* List */}
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {collabType === "creator" && filteredProfiles.map((profile) => {
                      const entry = `creator:${profile.username}`;
                      const legacyEntry = profile.username;
                      const selected = collaborators.includes(entry) || collaborators.includes(legacyEntry);
                      return (
                        <div key={profile.username}
                          onClick={() => { if (collaborators.includes(legacyEntry)) toggleCollaborator(legacyEntry); else toggleCollaborator(entry); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: selected ? "var(--bg-hover)" : "transparent", borderBottom: "1px solid var(--border-color)" }}
                          onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                          onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <ProfileAvatar profile={profile} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.fullname}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{profile.username} · {(profile.followers / 1e6).toFixed(1)}M</div>
                          </div>
                          {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      );
                    })}
                    {(collabType === "club" || collabType === "competition") && loadingEntities && (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Carregant...</div>
                    )}
                    {collabType === "club" && !loadingEntities && (entityOptions.clubs.filter((c) => !profileSearch || c.toLowerCase().includes(profileSearch.toLowerCase()))).map((clubName) => {
                      const entry = `club:${clubName}`;
                      const selected = collaborators.includes(entry);
                      return (
                        <div key={clubName} onClick={() => toggleCollaborator(entry)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: selected ? "#EFF6FF" : "transparent", borderBottom: "1px solid var(--border-color)" }}
                          onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                          onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clubName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Club</div>
                          </div>
                          {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      );
                    })}
                    {collabType === "competition" && !loadingEntities && (entityOptions.competitions.filter((c) => !profileSearch || c.toLowerCase().includes(profileSearch.toLowerCase()))).map((compName) => {
                      const entry = `competition:${compName}`;
                      const selected = collaborators.includes(entry);
                      return (
                        <div key={compName} onClick={() => toggleCollaborator(entry)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: selected ? "#EDE9FE" : "transparent", borderBottom: "1px solid var(--border-color)" }}
                          onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                          onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Competició</div>
                          </div>
                          {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      );
                    })}
                    {collabType === "club" && !loadingEntities && entityOptions.clubs.length === 0 && (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Cap club disponible</div>
                    )}
                    {collabType === "competition" && !loadingEntities && entityOptions.competitions.length === 0 && (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Cap competició disponible</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sport — compact row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>{t("calendar.sport")}</label>
                <select style={{ ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28, cursor: "pointer" }} value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  <option value="football">Football</option>
                  <option value="basketball">Basketball</option>
                  <option value="tennis">Tennis</option>
                  <option value="cycling">Cycling</option>
                  <option value="swimming">Swimming</option>
                  <option value="athletics">Athletics</option>
                  <option value="handball">Handball</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="rugby">Rugby</option>
                  <option value="hockey">Hockey</option>
                  <option value="padel">Padel</option>
                  <option value="golf">Golf</option>
                  <option value="motorsport">Motorsport</option>
                  <option value="esports">Esports</option>
                  <option value="other">Altre</option>
                </select>
              </div>
              <div /> {/* placeholder */}
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border-color)" }} />

            {/* Reference URL — own section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-secondary)" }}>REFERÈNCIA</label>
                {referenceUrl && (
                  <button type="button" onClick={() => setReferenceUrl("")} style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Eliminar</button>
                )}
              </div>
              <div>
                <label style={labelStyle}>{t("calendar.referenceUrl")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 38 }}
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowRefPicker(true);
                      if (savedPubs.length === 0) {
                        setLoadingSaved(true);
                        fetch("/api/publications?saved=true&limit=40")
                          .then(r => r.json())
                          .then(d => setSavedPubs(Array.isArray(d.publications) ? d.publications : []))
                          .catch(() => {})
                          .finally(() => setLoadingSaved(false));
                      }
                    }}
                    title="Seleccionar dels continguts guardats"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border-color)", background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </button>
                </div>

                {/* Saved content picker */}
                {showRefPicker && (
                  <div style={{ marginTop: 8, border: "1px solid var(--border-color)", borderRadius: 10, background: "var(--bg-surface)", overflow: "hidden", maxHeight: 280, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Continguts guardats</span>
                      <button onClick={() => setShowRefPicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {loadingSaved ? (
                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Carregant…</div>
                      ) : savedPubs.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No tens continguts guardats</div>
                      ) : (
                        savedPubs.map(pub => (
                          <button
                            key={pub.id}
                            type="button"
                            onClick={() => { setReferenceUrl(pub.canonicalUrl || pub.embedUrl || ""); setShowRefPicker(false); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border-color)", cursor: "pointer", textAlign: "left" }}
                          >
                            {pub.thumbnailUrl ? (
                              <img src={pub.thumbnailUrl} alt="" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 48, height: 36, borderRadius: 6, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {pub.accountUsername ? `@${pub.accountUsername}` : pub.platform}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {pub.caption || pub.canonicalUrl}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-muted)", flexShrink: 0, textTransform: "capitalize" }}>{pub.platform}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Embed preview */}
                {(() => {
                  const url = referenceUrl.trim();
                  if (!url) return null;
                  // YouTube
                  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                  if (ytMatch) {
                    return (
                      <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)", aspectRatio: "16/9" }}>
                        <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      </div>
                    );
                  }
                  // Vimeo
                  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                  if (vimeoMatch) {
                    return (
                      <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)", aspectRatio: "16/9" }}>
                        <iframe src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen />
                      </div>
                    );
                  }
                  // Instagram
                  if (url.includes("instagram.com/p/") || url.includes("instagram.com/reel/")) {
                    const cleanUrl = url.replace(/\?.*$/, "");
                    return (
                      <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)", maxHeight: 400, overflowY: "auto" }}>
                        <iframe src={`${cleanUrl}embed/`} style={{ width: "100%", minHeight: 380, border: "none" }} />
                      </div>
                    );
                  }
                  // TikTok
                  if (url.includes("tiktok.com")) {
                    const tiktokMatch = url.match(/video\/(\d+)/);
                    if (tiktokMatch) {
                      return (
                        <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                          <iframe src={`https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`} style={{ width: "100%", height: 560, border: "none" }} allowFullScreen />
                        </div>
                      );
                    }
                  }
                  // Twitter / X
                  if (url.includes("twitter.com") || url.includes("x.com")) {
                    return (
                      <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid var(--border-color)", padding: 12, background: "var(--bg-elevated)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)", textDecoration: "none", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</a>
                        </div>
                      </div>
                    );
                  }
                  // Image
                  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) {
                    return (
                      <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                        <img src={url} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
                      </div>
                    );
                  }
                  // Generic link card
                  return (
                    <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid var(--border-color)", padding: "10px 12px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</a>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border-color)" }} />

            {/* Hook */}
            <div>
              <label style={labelStyle}>Hook</label>
              <textarea style={taStyle} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="L'obertura que enganxa l'audiència..." />
            </div>

            {/* Script / Guió */}
            <div>
              <label style={labelStyle}>Guió / Script</label>
              <textarea style={{ ...taStyle, minHeight: 100 }} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Estructura del vídeo, punts clau, narrativa..." />
            </div>

            {/* CTA */}
            <div>
              <label style={labelStyle}>CTA</label>
              <textarea style={taStyle} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Crida a l'acció final..." />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>{t("calendar.notes")}</label>
              <textarea style={taStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes..." />
            </div>

          </div>

          {/* Footer */}
          <div style={{ padding: "12px 20px 20px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 8, justifyContent: "space-between", position: "sticky", bottom: 0, background: "var(--bg-primary)" }}>
            <div>
              {isEdit && !confirmDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #FCA5A5", background: "transparent", color: "#DC2626", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {t("calendar.deleteItem")}
                </button>
              )}
              {confirmDelete && (
                <button type="button" onClick={handleDelete} disabled={loading}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {t("calendar.confirmDelete")}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {t("calendar.cancel")}
              </button>
              <button type="submit" disabled={loading || !title.trim()}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "..." : t("calendar.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Export Modal ──────────────────────────────────────────────────────────────

function ExportModal({ from, to, onClose, t }: { from: string; to: string; onClose: () => void; t: (k: TranslationKey) => string }) {
  const [loading, setLoading] = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `content-calendar-${from}-to-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-primary)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{t("calendar.exportTitle")}</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>
          Export {from} – {to} ({t("calendar.export")})
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("calendar.cancel")}</button>
          <button onClick={doExport} disabled={loading} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {loading ? "..." : t("calendar.export")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Email Modal ───────────────────────────────────────────────────────────────

function EmailModal({ from, to, onClose, onSent, t }: { from: string; to: string; onClose: () => void; onSent: () => void; t: (k: TranslationKey) => string }) {
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState(`Content Calendar ${from} – ${to}`);
  const [message, setMessage] = useState("");
  const [attachExcel, setAttachExcel] = useState(true);
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)",
    background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const rcpts = recipients.split(",").map((r) => r.trim()).filter(Boolean);
    if (!rcpts.length) return;
    setLoading(true);
    try {
      await fetch("/api/calendar/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: rcpts, subject, message, from, to, attachExcel }),
      });
      onSent();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-primary)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{t("calendar.emailTitle")}</h3>
        <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{t("calendar.recipients")}</label>
            <input style={inputStyle} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="email@example.com, ..." required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{t("calendar.subject")}</label>
            <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>{t("calendar.message")}</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={attachExcel} onChange={(e) => setAttachExcel(e.target.checked)} style={{ width: 16, height: 16 }} />
            {t("calendar.attachExcel")}
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("calendar.cancel")}</button>
            <button type="submit" disabled={loading} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {loading ? t("calendar.sending") : t("calendar.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: CalendarStatus; t: (k: TranslationKey) => string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
  return (
    <span style={{ background: cfg.bg, color: cfg.text, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {t(cfg.labelKey)}
    </span>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  currentDate, items, onDayClick, onItemClick, onDrop, t, isMobile, selectedDay, onDaySelect, plans, onPlanClick,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onDayClick: (date: string) => void;
  onItemClick: (item: CalendarItem) => void;
  onDrop: (itemId: string, newDate: string) => void;
  t: (k: TranslationKey) => string;
  isMobile?: boolean;
  selectedDay?: string | null;
  onDaySelect?: (date: string | null) => void;
  plans?: ContentPlan[];
  onPlanClick?: (plan: ContentPlan) => void;
}) {
  const grid = getMonthGrid(currentDate);
  const dragItem = useRef<string | null>(null);
  const clubCrest = typeof window !== "undefined" ? (() => { try { return localStorage.getItem("scp-club-crest"); } catch { return null; } })() : null;

  const plansByDate: Record<string, { plan: ContentPlan; isStart: boolean; isEnd: boolean }[]> = {};
  for (const pl of (plans || [])) {
    if (!pl.startDate) continue;
    const startD = new Date(pl.startDate + "T12:00:00");
    const endD = new Date((pl.endDate || pl.startDate) + "T12:00:00");
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d);
      if (!plansByDate[ds]) plansByDate[ds] = [];
      plansByDate[ds].push({ plan: pl, isStart: toDateStr(d) === toDateStr(startD), isEnd: toDateStr(d) === toDateStr(endD) });
    }
  }

  const itemsByDate: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    if (!itemsByDate[item.plannedDate]) itemsByDate[item.plannedDate] = [];
    itemsByDate[item.plannedDate].push(item);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border-color)" }}>
        {WEEK_DAYS_SHORT.map((d) => (
          <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1 }}>
        {grid.map((day, idx) => {
          const ds = toDateStr(day);
          const dayItems = itemsByDate[ds] || [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          return (
            <div
              key={ds}
              onClick={() => {
                if (isMobile) {
                  onDaySelect?.(selectedDay === ds ? null : ds);
                } else {
                  onDayClick(ds);
                }
              }}
              onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
              onDrop={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).style.background = "";
                if (dragItem.current) onDrop(dragItem.current, ds);
              }}
              style={{
                minHeight: isMobile ? 52 : 100,
                padding: isMobile ? "4px 2px" : "4px 3px",
                borderRight: idx % 7 === 6 ? "none" : "1px solid var(--border-color)",
                borderBottom: "1px solid var(--border-color)", cursor: "pointer",
                background: selectedDay === ds ? "rgba(13,20,33,0.06)" : today ? "var(--bg-hover)" : "transparent",
                opacity: inMonth ? 1 : 0.35,
                position: "relative",
                outline: selectedDay === ds ? "2px solid var(--color-charcoal)" : "none",
                outlineOffset: -2,
              }}
            >
              <div style={{
                width: isMobile ? 22 : 26, height: isMobile ? 22 : 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 11 : 13, fontWeight: today ? 800 : 500,
                marginBottom: isMobile ? 3 : 2,
                background: today ? "#0D1421" : "transparent",
                color: today ? "#fff" : "var(--text-primary)",
                margin: isMobile ? "0 auto 3px" : undefined,
              }}>
                {day.getDate()}
              </div>

              {/* Plan banners */}
              {(plansByDate[ds] || []).map(({ plan: pl, isStart, isEnd }) => {
                const planColor: Record<string, string> = {
                  matchday: "#1D4ED8", tournament: "#7C3AED", weekly: "#059669",
                  monthly: "#D97706", campaign: "#DC2626", season: "#0891B2",
                  single_day: "#EA580C", custom: "#4B5563",
                };
                const bg = planColor[pl.type] || "#4B5563";
                const borderRadius = isStart && isEnd ? 6 : isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : 0;
                const opponentCrest = (pl as unknown as Record<string, unknown>).opponentCrest as string | null
                  || (typeof window !== "undefined" ? (() => { try { return localStorage.getItem(`plan_comp_logo_${pl.id}`) || (pl.opponent ? localStorage.getItem(`team_crest_${pl.opponent}`) : null); } catch { return null; } })() : null);
                return (
                  <div key={pl.id} title={pl.name}
                    onClick={(e) => { e.stopPropagation(); onPlanClick?.(pl); }}
                    style={{
                      background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
                      color: "#fff",
                      borderRadius, fontSize: isMobile ? 9 : 11, fontWeight: 700,
                      padding: isMobile ? "2px 4px" : "4px 7px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 3,
                      marginLeft: isStart ? 0 : -1,
                      marginRight: isEnd ? 0 : -1,
                      paddingLeft: !isStart ? 0 : undefined,
                      display: "flex", alignItems: "center", gap: 5,
                      cursor: "pointer",
                      minHeight: isMobile ? 18 : 22,
                      boxShadow: isStart ? `0 1px 3px ${bg}55` : "none",
                    }}
                  >
                    {isStart ? (
                      pl.type === "matchday" && !isMobile ? (
                        <>
                          {clubCrest
                            ? <img src={clubCrest} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
                          <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>vs</span>
                          {opponentCrest
                            ? <img src={opponentCrest} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
                            : null}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.01em" }}>{pl.opponent || pl.name}</span>
                        </>
                      ) : !isMobile ? (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{pl.name}</span>
                      ) : (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                      )
                    ) : null}
                  </div>
                );
              })}

              {isMobile ? (
                /* Mobile: colored dots */
                <div style={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap", paddingBottom: 2 }}>
                  {dayItems.slice(0, 3).map((item) => {
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
                    return (
                      <div
                        key={item.id}
                        style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.text, flexShrink: 0 }}
                      />
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-muted)", flexShrink: 0 }} />
                  )}
                </div>
              ) : (
                /* Desktop: text pills */
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayItems.slice(0, 3).map((item) => {
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); dragItem.current = item.id; }}
                        onDragEnd={() => { dragItem.current = null; }}
                        onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                        style={{
                          background: cfg.bg, color: cfg.text,
                          padding: "3px 7px 3px 5px",
                          borderRadius: 5, fontSize: 11, fontWeight: 600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "grab", display: "flex", alignItems: "center", gap: 4,
                          borderLeft: `3px solid ${cfg.text}`,
                          minHeight: 20,
                        }}
                        title={item.title}
                      >
                        {item.plannedTime && <span style={{ opacity: 0.6, fontSize: 10, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{item.plannedTime.slice(0, 5)}</span>}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 6, fontWeight: 600 }}>
                      +{dayItems.length - 3} més
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate, items, onDayClick, onItemClick, onDrop, t, plans, onPlanClick,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onDayClick: (date: string) => void;
  onItemClick: (item: CalendarItem) => void;
  onDrop: (itemId: string, newDate: string) => void;
  t: (k: TranslationKey) => string;
  plans?: ContentPlan[];
  onPlanClick?: (plan: ContentPlan) => void;
}) {
  const days = getWeekDays(currentDate);
  const dragItem = useRef<string | null>(null);
  const clubCrest = typeof window !== "undefined" ? (() => { try { return localStorage.getItem("scp-club-crest"); } catch { return null; } })() : null;

  const itemsByDate: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    if (!itemsByDate[item.plannedDate]) itemsByDate[item.plannedDate] = [];
    itemsByDate[item.plannedDate].push(item);
  }

  const plansByDate: Record<string, { plan: ContentPlan; isStart: boolean; isEnd: boolean }[]> = {};
  for (const pl of (plans || [])) {
    if (!pl.startDate) continue;
    const startD = new Date(pl.startDate + "T12:00:00");
    const endD = new Date((pl.endDate || pl.startDate) + "T12:00:00");
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d);
      if (!plansByDate[ds]) plansByDate[ds] = [];
      plansByDate[ds].push({ plan: pl, isStart: toDateStr(d) === toDateStr(startD), isEnd: toDateStr(d) === toDateStr(endD) });
    }
  }

  const planColor: Record<string, string> = {
    matchday: "#1D4ED8", tournament: "#7C3AED", weekly: "#059669",
    monthly: "#D97706", campaign: "#DC2626", season: "#0891B2",
    single_day: "#EA580C", custom: "#4B5563",
  };

  return (
    <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
      {days.map((day, i) => {
        const ds = toDateStr(day);
        const dayItems = itemsByDate[ds] || [];
        const today = isToday(day);
        return (
          <div
            key={ds}
            onClick={() => onDayClick(ds)}
            onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
            onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
            onDrop={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).style.background = "";
              if (dragItem.current) onDrop(dragItem.current, ds);
            }}
            style={{
              flex: 1, minWidth: 120, borderRight: i < 6 ? "1px solid var(--border-color)" : "none",
              cursor: "pointer",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "10px 8px 8px", borderBottom: "1px solid var(--border-color)", textAlign: "center",
              background: today ? "var(--bg-hover)" : "transparent",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {WEEK_DAYS_SHORT[i]}
              </div>
              <div style={{
                fontSize: 22, fontWeight: today ? 800 : 400, color: today ? "#0D1421" : "var(--text-primary)",
                lineHeight: 1.2, marginTop: 2,
              }}>
                {day.getDate()}
              </div>
            </div>
            {/* Plan banners */}
            {(plansByDate[ds] || []).map(({ plan: pl, isStart, isEnd }) => {
              const bg = planColor[pl.type] || "#4B5563";
              const borderRadius = isStart && isEnd ? 6 : isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : 0;
              const weekOpCrest = (pl as unknown as Record<string, unknown>).opponentCrest as string | null
                || (typeof window !== "undefined" ? (() => { try { return localStorage.getItem(`plan_comp_logo_${pl.id}`) || (pl.opponent ? localStorage.getItem(`team_crest_${pl.opponent}`) : null); } catch { return null; } })() : null);
              return (
                <div key={pl.id} title={pl.name}
                  onClick={(e) => { e.stopPropagation(); onPlanClick?.(pl); }}
                  style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, color: "#fff", borderRadius, fontSize: 11, fontWeight: 700, padding: isStart ? "5px 8px" : "5px 0", marginTop: 4, marginLeft: isStart ? 6 : 0, marginRight: isEnd ? 6 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, minHeight: 24, boxShadow: isStart ? `0 1px 4px ${bg}55` : "none" }}>
                  {isStart ? (
                    pl.type === "matchday" ? (
                      <>
                        {clubCrest ? <img src={clubCrest} alt="" style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} /> : null}
                        <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 500 }}>vs</span>
                        {weekOpCrest ? <img src={weekOpCrest} alt="" style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} /> : null}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{pl.opponent || pl.name}</span>
                      </>
                    ) : <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{pl.name}</span>
                  ) : null}
                </div>
              );
            })}
            {/* Items */}
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {dayItems.map((item) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); dragItem.current = item.id; }}
                    onDragEnd={() => { dragItem.current = null; }}
                    onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                    style={{
                      background: cfg.bg, borderLeft: `3px solid ${cfg.text}`, padding: "5px 8px",
                      borderRadius: 6, cursor: "grab",
                    }}
                  >
                    {item.plannedTime && (
                      <div style={{ fontSize: 10, color: cfg.text, fontWeight: 700, marginBottom: 2 }}>{item.plannedTime.slice(0, 5)}</div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 600, color: cfg.text, wordBreak: "break-word" }}>{item.title}</div>
                    {item.platforms.length > 0 && (
                      <div style={{ fontSize: 10, color: cfg.text, opacity: 0.7, marginTop: 2 }}>{item.platforms.join(", ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({
  items, onItemClick, onAddClick, t,
}: {
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onAddClick: () => void;
  t: (k: TranslationKey) => string;
}) {
  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 16 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p style={{ color: "var(--text-muted)", fontSize: 15, margin: 0 }}>{t("calendar.noItems")}</p>
        <button onClick={onAddClick} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {t("calendar.addItem")}
        </button>
      </div>
    );
  }

  const grouped: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    if (!grouped[item.plannedDate]) grouped[item.plannedDate] = [];
    grouped[item.plannedDate].push(item);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", flex: 1 }}>
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayItems]) => {
        const d = new Date(date + "T00:00:00");
        const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          <div key={date}>
            <div style={{ padding: "10px 20px 6px", position: "sticky", top: 0, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", zIndex: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isToday(d) ? "#0D1421" : "var(--text-muted)" }}>
                {isToday(d) ? "Today — " : ""}{dateLabel}
              </span>
            </div>
            {dayItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
                  borderBottom: "1px solid var(--border-color)", cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ flexShrink: 0, width: 50, textAlign: "center" }}>
                  {item.plannedTime ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{item.plannedTime.slice(0, 5)}</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                    {item.platforms.length > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.platforms.join(", ")}</span>
                    )}
                    {item.creatorName && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· @{item.creatorName}</span>
                    )}
                    {item.sport && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {item.sport}</span>
                    )}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge status={item.status} t={t} />
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Board View (Kanban) ───────────────────────────────────────────────────────

function BoardView({
  items, onItemClick, t,
}: {
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  t: (k: TranslationKey) => string;
}) {
  const columns: CalendarStatus[] = ["planned", "in_production", "ready", "published"];
  return (
    <div style={{ display: "flex", gap: 12, padding: 16, overflowX: "auto", flex: 1, alignItems: "flex-start", minHeight: 0 }}>
      {columns.map((status) => {
        const colItems = items
          .filter((i) => i.status === status)
          .sort((a, b) => (a.plannedDate + (a.plannedTime || "")).localeCompare(b.plannedDate + (b.plannedTime || "")));
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 8, maxHeight: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: cfg.bg, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t(cfg.labelKey)}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: cfg.text, background: "rgba(0,0,0,0.1)", borderRadius: 10, padding: "1px 8px" }}>
                {colItems.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", paddingBottom: 8 }}>
              {colItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderLeft: `3px solid ${cfg.text}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35, marginBottom: 6 }}>
                    {item.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(item.plannedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {item.plannedTime ? ` · ${item.plannedTime.slice(0, 5)}` : ""}
                    </span>
                    {item.platforms.slice(0, 3).map((p) => {
                      const pc = PLATFORM_CONFIG.find((x) => x.name === p);
                      return pc ? (
                        <span key={p} style={{ color: pc.color, lineHeight: 0 }}>{pc.icon}</span>
                      ) : (
                        <span key={p} style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 4, padding: "1px 5px" }}>{p}</span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {colItems.length === 0 && (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, border: "1px dashed var(--border-color)", borderRadius: 8 }}>
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day View (Timeline) ───────────────────────────────────────────────────────

function DayView({
  currentDate, items, onItemClick, onAddAtTime, t,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onAddAtTime: (time: string) => void;
  t: (k: TranslationKey) => string;
}) {
  const dateStr = toDateStr(currentDate);
  const dayItems = items.filter((i) => i.plannedDate === dateStr);

  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 → 23:00

  const byHour: Record<number, CalendarItem[]> = {};
  for (const item of dayItems) {
    if (!item.plannedTime) continue;
    const h = parseInt(item.plannedTime.slice(0, 2), 10);
    if (h >= 6 && h <= 23) {
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(item);
    }
  }
  const unscheduled = dayItems.filter((i) => !i.plannedTime);

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {unscheduled.length > 0 && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>All day</span>
          {unscheduled.map((item) => (
            <div key={item.id} onClick={() => onItemClick(item)} style={{ background: STATUS_CONFIG[item.status].bg, border: `1px solid ${STATUS_CONFIG[item.status].border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              {item.title}
            </div>
          ))}
        </div>
      )}
      {dayItems.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>No content planned for this day</p>
          <button onClick={() => onAddAtTime("09:00")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t("calendar.addItem")}
          </button>
        </div>
      )}
      {hours.map((h) => {
        const hItems = byHour[h] || [];
        const timeLabel = `${String(h).padStart(2, "0")}:00`;
        const now = new Date();
        const isCurrent = isToday(currentDate) && now.getHours() === h;
        return (
          <div
            key={h}
            style={{ display: "flex", borderBottom: "1px solid var(--border-color)", minHeight: 52, background: isCurrent ? "rgba(13,20,33,0.03)" : undefined }}
          >
            <div style={{ width: 64, flexShrink: 0, padding: "10px 12px", borderRight: "1px solid var(--border-color)", textAlign: "right" }}>
              <span style={{ fontSize: 11, color: isCurrent ? "#0D1421" : "var(--text-muted)", fontWeight: isCurrent ? 700 : 500 }}>{timeLabel}</span>
            </div>
            <div
              style={{ flex: 1, padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start", cursor: "pointer", minHeight: 52 }}
              onClick={() => onAddAtTime(timeLabel)}
            >
              {hItems.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                  style={{
                    background: STATUS_CONFIG[item.status].bg,
                    border: `1px solid ${STATUS_CONFIG[item.status].border}`,
                    borderLeft: `3px solid ${STATUS_CONFIG[item.status].text}`,
                    borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontSize: 10, color: STATUS_CONFIG[item.status].text, fontWeight: 700 }}>
                    {item.plannedTime?.slice(0, 5)}
                  </span>
                  {item.title}
                  {item.platforms.slice(0, 2).map((p) => {
                    const pc = PLATFORM_CONFIG.find((x) => x.name === p);
                    return pc ? <span key={p} style={{ color: pc.color, lineHeight: 0 }}>{pc.icon}</span> : null;
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Mobile Day Panel ─────────────────────────────────────────────────────────

function MobileDayPanel({
  date, items, onItemClick, onAddClick, onClose, t,
}: {
  date: string;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onAddClick: () => void;
  onClose: () => void;
  t: (k: TranslationKey) => string;
}) {
  const d = new Date(date + "T12:00:00");
  const label = d.toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      borderTop: "2px solid var(--color-charcoal)",
      background: "var(--bg-card)",
      flexShrink: 0,
      maxHeight: 240,
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1,
        borderBottom: "1px solid var(--border-color)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>
          {label}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={onAddClick}
            style={{
              padding: "5px 12px", borderRadius: 6, border: "none",
              background: "#0D1421", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            + Afegir
          </button>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", display: "flex" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Events */}
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: "14px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          Sense contingut per aquest dia.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, idx) => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px",
                  background: "none", border: "none",
                  borderTop: idx > 0 ? "1px solid var(--border-color)" : "none",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.text, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  {item.plannedTime && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{item.plannedTime.slice(0, 5)}</div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: cfg.text,
                  background: cfg.bg, padding: "2px 8px", borderRadius: 99, flexShrink: 0,
                }}>
                  {t(cfg.labelKey)}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function CalendarPageInner() {
  const searchParams = useSearchParams();

  const { t } = useLanguage();
  const [mainTab, setMainTab] = useState<"calendar" | "hubs" | "tournaments" | "templates">("calendar");
  const [showPlansDrawer, setShowPlansDrawer] = useState(false);
  const [calView, setCalView] = useState<"planner" | "fixtures">("planner");
  const [view, setView] = useState<"month" | "week" | "list" | "board" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [addDate, setAddDate] = useState<string>("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [toast, setToast] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [pendingPublication, setPendingPublication] = useState<PublicationFromCard | null>(null);
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [planBuilderType, setPlanBuilderType] = useState<string | null>(null);
  const [showInspiration, setShowInspiration] = useState(false);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [autoOpenHub, setAutoOpenHub] = useState<string | null>(null);
  const [autoOpenPlan, setAutoOpenPlan] = useState<string | null>(null);
  const [autoOpenTournament, setAutoOpenTournament] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setView((v) => (v === "month" || v === "board") ? "list" : v);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Compute date range based on view
  const { from, to } = (() => {
    if (view === "month") {
      const first = startOfMonth(currentDate);
      const last = endOfMonth(currentDate);
      const gridStart = startOfWeek(first);
      return { from: toDateStr(gridStart), to: toDateStr(addDays(last, 6)) };
    }
    if (view === "week") {
      const mon = startOfWeek(currentDate);
      return { from: toDateStr(mon), to: toDateStr(addDays(mon, 6)) };
    }
    if (view === "day") {
      const ds = toDateStr(currentDate);
      return { from: ds, to: ds };
    }
    // list/board: show 3 months
    const start = new Date(currentDate);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    end.setDate(0);
    return { from: toDateStr(start), to: toDateStr(end) };
  })();

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/calendar?${params}`);
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, [from, to, filterStatus]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    fetch("/api/plans").then((r) => r.json()).then(setPlans).catch(() => {});
  }, []);

  // Deep-link: open item modal when ?item=<id> is in the URL
  useEffect(() => {
    const itemId = searchParams.get("item");
    if (!itemId) return;
    fetch(`/api/calendar/${itemId}`)
      .then((r) => r.json())
      .then((item) => {
        if (item?.id) {
          setPendingPublication(null);
          setSelectedItem(item);
          setAddDate("");
          setShowItemModal(true);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  // Listen for "Add to Calendar" events from PublicationCard
  useEffect(() => {
    function handler(e: Event) {
      const pub = (e as CustomEvent<{ publication: PublicationFromCard }>).detail.publication;
      setPendingPublication(pub);
      setSelectedItem(null);
      setAddDate(toDateStr(new Date()));
      setShowItemModal(true);
    }
    window.addEventListener("open-calendar-add", handler);

    // Pick up publication stored by PublicationCard when navigating cross-page
    try {
      const stored = sessionStorage.getItem("scp-pending-calendar-pub");
      if (stored) {
        sessionStorage.removeItem("scp-pending-calendar-pub");
        const pub = JSON.parse(stored) as PublicationFromCard;
        setPendingPublication(pub);
        setSelectedItem(null);
        setAddDate(toDateStr(new Date()));
        setShowItemModal(true);
      }
    } catch {}

    return () => window.removeEventListener("open-calendar-add", handler);
  }, []);

  function navigate(dir: -1 | 1) {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else if (view === "day") d.setDate(d.getDate() + dir);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function handleDayClick(date: string) {
    setPendingPublication(null);
    setSelectedItem(null);
    setAddDate(date);
    setShowItemModal(true);
  }

  function handleItemClick(item: CalendarItem) {
    setPendingPublication(null);
    setSelectedItem(item);
    setAddDate("");
    setShowItemModal(true);
  }

  function handlePlanClick(plan: ContentPlan) {
    if (plan.type === "tournament") {
      setMainTab("tournaments");
      setAutoOpenTournament(plan.id);
    } else if (plan.type === "matchday" && plan.collaborationEnabled) {
      setMainTab("hubs");
      setPlans((prev) => prev.map((p) => p.id === plan.id ? plan : p));
      setAutoOpenHub(plan.id);
    } else {
      setShowPlansDrawer(true);
      setAutoOpenPlan(plan.id);
    }
  }

  function openTournament(plan: ContentPlan) {
    setShowPlansDrawer(false);
    setMainTab("tournaments");
    setAutoOpenTournament(plan.id);
  }

  function handleSave(saved: CalendarItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setShowItemModal(false);
    setPendingPublication(null);
    setToast(selectedItem ? "Updated!" : "Added to calendar!");
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setShowItemModal(false);
    setToast("Deleted.");
  }

  async function handleDrop(itemId: string, newDate: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.plannedDate === newDate) return;
    const res = await fetch(`/api/calendar/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedDate: newDate }),
    });
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    setToast("Moved!");
  }

  // Period label
  const periodLabel = (() => {
    if (view === "month") return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const fst = days[0];
      const lst = days[6];
      return `${fst.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lst.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "day") return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  // Pre-fill item modal with publication data
  const pendingAsPartialItem: Partial<CalendarItem> | null = pendingPublication
    ? {
        title: pendingPublication.accountUsername
          ? `@${pendingPublication.accountUsername} · ${pendingPublication.platform}`
          : pendingPublication.platform,
        plannedDate: addDate || toDateStr(new Date()),
        platforms: [pendingPublication.platform],
        sport: pendingPublication.sports?.[0] || null,
        creatorName: pendingPublication.accountUsername || null,
        referenceUrl: pendingPublication.originalUrl || pendingPublication.canonicalUrl || null,
        contentFormat: pendingPublication.contentFormat || null,
        sourceContentId: pendingPublication.id,
        sourceType: "scp",
      }
    : null;

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    padding: "7px 16px", borderRadius: 8, border: `1px solid ${active ? "var(--color-charcoal)" : "var(--border-color)"}`,
    background: active ? "var(--color-charcoal-subtle)" : "transparent",
    color: active ? "var(--color-charcoal)" : "var(--text-secondary)",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  const openAdd = () => { setPendingPublication(null); setSelectedItem(null); setAddDate(toDateStr(new Date())); setShowItemModal(true); };

  const PLAN_TYPE_COLOR: Record<string, string> = {
    matchday: "#3B82F6", tournament: "#8B5CF6", weekly: "#10B981", monthly: "#F59E0B",
    campaign: "#EF4444", season: "#06B6D4", single_day: "#F97316", custom: "#6B7280",
  };
  const PLAN_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
    draft: { bg: "#F3F4F6", text: "#6B7280" },
    active: { bg: "#D1FAE5", text: "#059669" },
    completed: { bg: "#DBEAFE", text: "#1D4ED8" },
    archived: { bg: "#FEF3C7", text: "#92400E" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)" }}>

        {/* Row 1: Brand bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 48, borderBottom: "1px solid var(--border-color)" }}>

          {/* Brand mark + title */}
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#0D1421 0%,#1e3a5f 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Content Planner</span>
            <div style={{ width: 1, height: 16, background: "var(--border-color)", margin: "0 4px" }} />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

            {/* Overflow menu */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setOverflowOpen((p) => !p)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
                <span className="hidden md:inline">Més</span>
              </button>
              {overflowOpen && <div onClick={() => setOverflowOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />}
              {overflowOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "5px 0", zIndex: 50, minWidth: 190, boxShadow: "0 12px 32px rgba(0,0,0,0.14)" }}>
                  {[
                    { label: "Exportar Excel", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, action: () => setShowExport(true) },
                    { label: "Enviar per email", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, action: () => setShowEmail(true) },
                  ].map((itm) => (
                    <button key={itm.label} onClick={itm.action} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 15px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", textAlign: "left" }}>
                      <span style={{ color: "var(--text-muted)" }}>{itm.icon}</span>{itm.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/saved"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span className="hidden md:inline">Guardats</span>
            </Link>

            <button
              onClick={() => setShowInspiration(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              title="Inspiration panel"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="hidden md:inline">Inspiration</span>
            </button>

            {mainTab === "calendar" && (
              <button
                onClick={openAdd}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span className="hidden md:inline">Nou contingut</span>
              </button>
            )}

            <button
              onClick={() => setShowPlansDrawer(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: showPlansDrawer ? "var(--bg-hover)" : "transparent", color: showPlansDrawer ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              title="Els meus plans"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span className="hidden md:inline">Plans</span>
              {plans.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--bg-input)", color: "var(--text-muted)", borderRadius: 999, padding: "0px 5px", minWidth: 16, textAlign: "center" }}>{plans.length}</span>}
            </button>

            <button
              onClick={() => setShowPlanBuilder(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, letterSpacing: "-0.01em" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="hidden md:inline">Nou pla</span>
            </button>
          </div>
        </div>

        {/* Row 2: Main tabs + calendar controls */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, padding: "0 16px", overflowX: "auto", scrollbarWidth: "none" }}>

          {/* Main tabs */}
          <div style={{ display: "flex", gap: 0, flex: "0 0 auto" }}>
            {([
              { id: "calendar", label: "Calendari", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { id: "hubs", label: "Matchday Hubs", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
              { id: "tournaments", label: "Tornejos", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> },
              { id: "templates", label: "Plantilles", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            ] as { id: "calendar" | "hubs" | "tournaments" | "templates"; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
                  fontSize: 13, fontWeight: mainTab === tab.id ? 700 : 500,
                  color: mainTab === tab.id ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: mainTab === tab.id ? "2px solid #0D1421" : "2px solid transparent",
                  whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.15s",
                  opacity: mainTab === tab.id ? 1 : 0.7,
                }}
              >
                <span style={{ opacity: mainTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Calendar-specific controls (inline in tab row) */}
          {mainTab === "calendar" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", paddingLeft: 16 }}>

              {<>
                {/* Date nav */}
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button onClick={() => navigate(-1)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Avui</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", padding: "0 8px", whiteSpace: "nowrap", minWidth: 120, textAlign: "center" }}>{periodLabel}</span>
                  <button onClick={() => navigate(1)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* View switcher */}
                <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 8, padding: 2, border: "1px solid var(--border-color)" }}>
                  {(["month", "week", "day", "list", "board"] as const).map((v) => {
                    const vLabels: Record<string, string> = { month: "Month", week: "Week", day: "Day", list: "List", board: "Board" };
                    return (
                      <button key={v} onClick={() => setView(v)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: view === v ? "var(--bg-primary)" : "transparent", color: view === v ? "var(--text-primary)" : "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.12)" : "none", whiteSpace: "nowrap" }}>
                        {vLabels[v]}
                      </button>
                    );
                  })}
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", outline: "none" }}
                >
                  <option value="">{t("calendar.allStatuses")}</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>)}
                </select>

                {loading && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--border-color)", borderTopColor: "var(--text-muted)", animation: "spin 0.8s linear infinite" }} />}
              </>}
            </div>
          )}
        </div>
      </div>

      {/* ── Plans Drawer ── */}
      {showPlansDrawer && (
        <>
          <div
            onClick={() => setShowPlansDrawer(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 199, backdropFilter: "blur(2px)" }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
            background: "var(--bg-primary)", borderLeft: "1px solid var(--border-color)",
            zIndex: 200, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          }}>
            {/* Drawer header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Els meus plans</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, background: "var(--bg-input)", borderRadius: 999, padding: "1px 7px" }}>{plans.length}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setShowPlansDrawer(false); setShowPlanBuilder(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "none", background: "#0D1421", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nou pla
                </button>
                <button
                  onClick={() => setShowPlansDrawer(false)}
                  style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            {/* Drawer body */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <PlansView
                plans={plans}
                onCreatePlan={() => { setShowPlansDrawer(false); setShowPlanBuilder(true); }}
                onPlanUpdated={(updated) => setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
                onPlanDeleted={(id) => setPlans((prev) => prev.filter((p) => p.id !== id))}
                planTypeColor={PLAN_TYPE_COLOR}
                planStatusColor={PLAN_STATUS_COLOR}
                autoOpenPlanId={autoOpenPlan}
                onAutoOpened={() => setAutoOpenPlan(null)}
                onOpenTournament={openTournament}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Matchday Hubs Tab ── */}
      {mainTab === "hubs" && (
        <MatchdayHubsView
          plans={plans}
          onCreatePlan={() => { setShowPlanBuilder(true); }}
          onPlanUpdated={(updated) => setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
          autoOpenHubId={autoOpenHub}
          onAutoOpened={() => setAutoOpenHub(null)}
        />
      )}

      {/* ── Tornejos Tab ── */}
      {mainTab === "tournaments" && (
        <TournamentsHubView
          plans={plans}
          onCreatePlan={() => { setPlanBuilderType("tournament"); setShowPlanBuilder(true); }}
          autoOpenId={autoOpenTournament}
          onAutoOpened={() => setAutoOpenTournament(null)}
        />
      )}

      {/* ── Templates Tab ── */}
      {mainTab === "templates" && (
        <TemplatesView onSelectTemplate={(type) => {
          setPlanBuilderType(type);
          setShowPlanBuilder(true);
        }} />
      )}

      {/* ── Calendar Area (Planner view) ── */}
      {mainTab === "calendar" && (
      <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }} className="md:pb-0">
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            items={items}
            onDayClick={handleDayClick}
            onItemClick={handleItemClick}
            onDrop={handleDrop}
            t={t}
            isMobile={isMobile}
            selectedDay={selectedDay}
            onDaySelect={setSelectedDay}
            plans={plans}
            onPlanClick={handlePlanClick}
          />
        )}
        {view === "month" && isMobile && selectedDay && (
          <MobileDayPanel
            date={selectedDay}
            items={items.filter((i) => i.plannedDate === selectedDay)}
            onItemClick={handleItemClick}
            onAddClick={() => { setSelectedDay(null); handleDayClick(selectedDay); }}
            onClose={() => setSelectedDay(null)}
            t={t}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            items={items}
            onDayClick={handleDayClick}
            onItemClick={handleItemClick}
            onDrop={handleDrop}
            t={t}
            plans={plans}
            onPlanClick={handlePlanClick}
          />
        )}
        {view === "list" && (
          <ListView
            items={items}
            onItemClick={handleItemClick}
            onAddClick={() => { setSelectedItem(null); setAddDate(toDateStr(new Date())); setShowItemModal(true); }}
            t={t}
          />
        )}
        {view === "board" && (
          <BoardView
            items={items}
            onItemClick={handleItemClick}
            t={t}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            items={items}
            onItemClick={handleItemClick}
            onAddAtTime={(time) => { setSelectedItem(null); setAddDate(toDateStr(currentDate)); setShowItemModal(true); }}
            t={t}
          />
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <button
        className="flex md:hidden"
        onClick={openAdd}
        style={{
          position: "fixed",
          bottom: "max(calc(env(safe-area-inset-bottom, 0px) + 76px), 90px)",
          right: 18,
          zIndex: 40,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#0D1421",
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        aria-label={t("calendar.addItem")}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      </>
      )}

      {/* ── Modals (always rendered) ── */}
      {showItemModal && (
        <ItemModal
          item={selectedItem || pendingAsPartialItem}
          defaultDate={addDate || toDateStr(new Date())}
          onClose={() => { setShowItemModal(false); setPendingPublication(null); }}
          onSave={handleSave}
          onDelete={handleDelete}
          t={t}
        />
      )}
      {showExport && <ExportModal from={from} to={to} onClose={() => setShowExport(false)} t={t} />}
      {showEmail && <EmailModal from={from} to={to} onClose={() => setShowEmail(false)} onSent={() => setToast(t("calendar.sent"))} t={t} />}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      <InspirationPanel open={showInspiration} onClose={() => setShowInspiration(false)} />

      {showPlanBuilder && (
        <PlanBuilder
          defaultDate={toDateStr(currentDate)}
          initialType={planBuilderType || undefined}
          onClose={() => { setShowPlanBuilder(false); setPlanBuilderType(null); }}
          onCreated={(plan) => {
            setPlans((prev) => [plan, ...prev]);
            setShowPlanBuilder(false);
            setPlanBuilderType(null);
            setShowPlansDrawer(true);
            setAutoOpenPlan(plan.id);
            setToast(`Pla "${plan.name}" creat!`);
            loadItems();
          }}
        />
      )}
    </div>
  );
}

// ── Plans View ────────────────────────────────────────────────────────────────

const PLAN_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  matchday:         { label: "Matchday",              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>, color: "#3B82F6" },
  tournament:       { label: "Tournament",            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, color: "#8B5CF6" },
  weekly:           { label: "Weekly",                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>, color: "#10B981" },
  monthly:          { label: "Monthly",               icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, color: "#F59E0B" },
  campaign:         { label: "Campaign",              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, color: "#EF4444" },
  season:           { label: "Season",                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>, color: "#06B6D4" },
  single_day:       { label: "Single Day",            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>, color: "#F97316" },
  signing:          { label: "Fitxatge",              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, color: "#0EA5E9" },
  sponsorship:      { label: "Patrocini",             icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 8c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5"/><path d="M3 16c0 2.76 2.24 5 5 5s5-2.24 5-5-2.24-5-5-5"/><line x1="21" y1="3" x2="3" y2="21"/></svg>, color: "#D97706" },
  media_day:        { label: "Media Day",             icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>, color: "#EC4899" },
  press_conference: { label: "Roda de premsa",        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>, color: "#6366F1" },
  kit_launch:       { label: "Equipacions",           icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>, color: "#14B8A6" },
  institutional:    { label: "Presentació inst.",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V12h18v10"/><path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6"/><path d="M3 21h18"/><rect x="9" y="15" width="6" height="7"/></svg>, color: "#64748B" },
  competition_draw: { label: "Sorteig competició",    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>, color: "#A855F7" },
  giveaway:         { label: "Sorteig / Concurs",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>, color: "#F43F5E" },
  custom:           { label: "Custom",                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, color: "#6B7280" },
};

// ── Matchday Hubs ────────────────────────────────────────────────────────────

const HUB_PHASES = [
  { key: "D-7", label: "D-7", phase: "Preparation", relMin: -7 * 24 * 60 },
  { key: "D-3", label: "D-3", phase: "Preparation", relMin: -3 * 24 * 60 },
  { key: "D-2", label: "D-2", phase: "Preparation", relMin: -2 * 24 * 60 },
  { key: "D-1", label: "D-1", phase: "Pre-match", relMin: -1 * 24 * 60 },
  { key: "H-3", label: "H-3", phase: "Pre-match", relMin: -3 * 60 },
  { key: "H-2", label: "H-2", phase: "Pre-match", relMin: -2 * 60 },
  { key: "H-90", label: "H-90min", phase: "Pre-match", relMin: -90 },
  { key: "H-60", label: "H-60min", phase: "Pre-match", relMin: -60 },
  { key: "H-30", label: "H-30min", phase: "Pre-match", relMin: -30 },
  { key: "H0", label: "Kick-off", phase: "Live", relMin: 0 },
  { key: "HT", label: "Half-time", phase: "Live", relMin: 48 },
  { key: "FT", label: "Full-time", phase: "Live", relMin: 95 },
  { key: "H+15", label: "H+15min", phase: "Post-match", relMin: 15 },
  { key: "H+60", label: "H+1h", phase: "Post-match", relMin: 60 },
  { key: "D+1", label: "D+1", phase: "Post-match", relMin: 24 * 60 },
  { key: "D+2", label: "D+2", phase: "Post-match", relMin: 2 * 24 * 60 },
];

// SVG icon map for quick-add chips
const QA_ICONS: Record<string, React.ReactNode> = {
  megaphone:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
  ticket:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>,
  trophy:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  chart:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  luggage:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 20v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1"/><path d="M14 20v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1"/><rect x="2" y="8" width="20" height="13" rx="2"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>,
  plane:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2l4 4L4 12l4 4 1.8-1.8 4 4z"/></svg>,
  bus:          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M8 18h8"/></svg>,
  train:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M18 22l-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>,
  hotel:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V12h18v10"/><path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6"/><path d="M7 22v-4h10v4"/><path d="M11 10h2"/></svg>,
  city:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>,
  users:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  document:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  mic:          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  run:          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M7 21l3-6 2 2 3-8"/><path d="m14 12 3 2 1 5"/><path d="M7 15h4"/></svg>,
  stadium:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 3 4 5.5 9 5.5s9-2.5 9-5.5V5"/><path d="M3 11v6c0 3 4 5.5 9 5.5s9-2.5 9-5.5v-6"/></svg>,
  poster:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  squad:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>,
  camera:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  video:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  shirt:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>,
  flame:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  music:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  star:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  flag:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  celebrate:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5.8 11.3-1.9 5.4 5.4-1.9L21 3 19 1Z"/><path d="m5.8 11.3-1.8-1.8 8.4-8.5 1.8 1.9"/><path d="M14 7l3 3"/><path d="M3 21c0-2.7 1.3-5.3 3.6-7"/></svg>,
  image:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  quote:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>,
  newspaper:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
  compass:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  search:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  trending:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  home:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  ball:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
};

// Suggested content items per phase slot (shown as quick-add chips in Run of Show)
const PHASE_QUICK_ITEMS: Record<string, { icon: string; label: string; group?: string }[]> = {
  "D-7": [
    { icon: "megaphone", label: "Anunci del partit" },
    { icon: "ticket",   label: "Venda d'entrades" },
    { icon: "trophy",   label: "Context de la competició" },
    { icon: "chart",    label: "Estadístiques prèvies" },
  ],
  "D-3": [
    { icon: "luggage",  label: "Preparació del viatge" },
    { icon: "document", label: "Nota de premsa prèvia" },
    { icon: "plane",    label: "Vol cap a la ciutat rival", group: "Viatge" },
    { icon: "bus",      label: "Autobús cap al camp", group: "Viatge" },
    { icon: "train",    label: "Tren cap a la ciutat rival", group: "Viatge" },
    { icon: "hotel",    label: "Concentració a l'hotel", group: "Viatge" },
    { icon: "city",     label: "La ciutat rival", group: "Viatge" },
    { icon: "users",    label: "Aficionats i ambient rival", group: "Viatge" },
  ],
  "D-2": [
    { icon: "document", label: "Nota de premsa (48h)", group: "Premsa" },
    { icon: "mic",      label: "Roda de premsa (48h)", group: "Premsa" },
    { icon: "plane",    label: "Desplaçament en avió", group: "Viatge" },
    { icon: "bus",      label: "Desplaçament en autobús", group: "Viatge" },
    { icon: "train",    label: "Desplaçament en tren", group: "Viatge" },
    { icon: "hotel",    label: "Arribada a l'hotel", group: "Viatge" },
    { icon: "city",     label: "Explorant la ciutat rival", group: "Viatge" },
    { icon: "users",    label: "Aficionats desplaçats", group: "Viatge" },
    { icon: "stadium",  label: "Reconeixement de l'estadi" },
  ],
  "D-1": [
    { icon: "document", label: "Nota de premsa (24h)", group: "Premsa" },
    { icon: "mic",      label: "Roda de premsa prèvia", group: "Premsa" },
    { icon: "run",      label: "Entrenament previ a l'estadi rival", group: "Entrenament" },
    { icon: "stadium",  label: "Sessió a peu de camp rival", group: "Entrenament" },
    { icon: "hotel",    label: "Concentració a l'hotel", group: "Viatge" },
    { icon: "city",     label: "Visita a la ciutat rival", group: "Viatge" },
    { icon: "users",    label: "Aficionats a la ciutat rival", group: "Viatge" },
    { icon: "poster",   label: "Pòster del partit" },
    { icon: "squad",    label: "Anunci de convocatòria" },
  ],
  "H-3": [
    { icon: "bus",      label: "Sortida cap a l'estadi" },
    { icon: "camera",   label: "Pre-match photo shoot" },
    { icon: "flame",    label: "Activació mental" },
  ],
  "H-2": [
    { icon: "stadium",  label: "Arribada a l'estadi" },
    { icon: "shirt",    label: "Preparació del vestidor" },
    { icon: "squad",    label: "Onze titular" },
    { icon: "star",     label: "Pre-match ritual" },
  ],
  "H-90": [
    { icon: "run",      label: "Escalfament" },
    { icon: "camera",   label: "Fotos d'escalfament" },
    { icon: "shirt",    label: "Behind the scenes vestidor" },
  ],
  "H-60": [
    { icon: "squad",    label: "Onze confirmat" },
    { icon: "quote",    label: "Quotes pre-match" },
    { icon: "image",    label: "Fotos de l'estadi" },
  ],
  "H-30": [
    { icon: "flame",    label: "Hype content" },
    { icon: "music",    label: "Himne / música" },
    { icon: "megaphone",label: "Motivació final" },
  ],
  "H0": [
    { icon: "flag",     label: "Kick-off" },
    { icon: "chart",    label: "Live stats" },
    { icon: "ball",     label: "Gol" },
  ],
  "HT": [
    { icon: "chart",    label: "Estadístiques de la 1a part" },
    { icon: "quote",    label: "Reaccions descans" },
    { icon: "image",    label: "Imatges del descans" },
  ],
  "FT": [
    { icon: "flag",     label: "Resultat final" },
    { icon: "celebrate",label: "Celebració" },
    { icon: "chart",    label: "Estadístiques finals" },
    { icon: "star",     label: "MVP del partit" },
  ],
  "H+15": [
    { icon: "mic",      label: "Declaracions jugadors" },
    { icon: "camera",   label: "Fotos post-match" },
    { icon: "trophy",   label: "Trofeu / medalles" },
  ],
  "H+60": [
    { icon: "mic",      label: "Roda de premsa post-match", group: "Premsa" },
    { icon: "document", label: "Nota de premsa post-match", group: "Premsa" },
    { icon: "video",    label: "Highlights vídeo" },
    { icon: "quote",    label: "Quotes del tècnic" },
    { icon: "bus",      label: "Tornada a casa" },
  ],
  "D+1": [
    { icon: "newspaper",label: "Resum del partit" },
    { icon: "image",    label: "Galeria de fotos" },
    { icon: "video",    label: "Highlights extesos" },
    { icon: "star",     label: "Best moments" },
    { icon: "compass",  label: "Proper rival" },
  ],
  "D+2": [
    { icon: "search",   label: "Anàlisi tàctica" },
    { icon: "trending", label: "Estadístiques de temporada" },
    { icon: "video",    label: "Behind the scenes complet" },
    { icon: "users",    label: "Reaccions dels aficionats" },
  ],
};

const HUB_PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Preparation": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Pre-match":   { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "Live":        { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
  "Post-match":  { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
};

function countdown(kickoffDate: string, kickoffTime: string): string {
  try {
    const dt = new Date(`${kickoffDate}T${kickoffTime || "20:00"}:00`);
    const diff = dt.getTime() - Date.now();
    if (diff < 0) return "Finalitzat";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  } catch { return "—"; }
}

function MatchdayHubsView({
  plans, onCreatePlan, onPlanUpdated, autoOpenHubId, onAutoOpened,
}: {
  plans: ContentPlan[];
  onCreatePlan: () => void;
  onPlanUpdated: (p: ContentPlan) => void;
  autoOpenHubId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [activeHub, setActiveHub] = useState<ContentPlan | null>(null);
  const [enablingId, setEnablingId] = useState<string | null>(null);

  const matchdayPlans = plans.filter((p) => p.type === "matchday");

  useEffect(() => {
    if (autoOpenHubId) {
      const plan = plans.find((p) => p.id === autoOpenHubId);
      if (plan) { setActiveHub(plan); onAutoOpened?.(); }
    }
  }, [autoOpenHubId, plans, onAutoOpened]);

  async function enableCollaboration(plan: ContentPlan) {
    setEnablingId(plan.id);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborationEnabled: true, hubStatus: "active" }),
      });
      if (res.ok) {
        const updated: ContentPlan = await res.json();
        onPlanUpdated(updated);
        setActiveHub(updated);
      }
    } catch {
      // silent
    } finally {
      setEnablingId(null);
    }
  }

  if (activeHub) {
    return (
      <MatchdayHubWorkspace
        plan={activeHub}
        onClose={() => setActiveHub(null)}
        onUpdated={(p) => { onPlanUpdated(p); setActiveHub(p); }}
      />
    );
  }

  // Load crests from localStorage
  const [crests, setCrests] = useState<Record<string, string>>(() => {
    try {
      const r: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("plan_comp_logo_") || k?.startsWith("team_crest_")) {
          const v = localStorage.getItem(k);
          if (v) r[k] = v;
        }
      }
      return r;
    } catch { return {}; }
  });

  function getCrest(plan: ContentPlan): string | null {
    return crests[`plan_comp_logo_${plan.id}`]
      || (plan as unknown as Record<string, unknown>).opponentCrest as string | null
      || (plan.opponent ? crests[`team_crest_${plan.opponent}`] : null)
      || null;
  }

  // Group by date
  const grouped: Record<string, ContentPlan[]> = {};
  for (const p of matchdayPlans) {
    const d = p.startDate || "0000-00-00";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(p);
  }
  const sortedDates = Object.keys(grouped).sort();

  function CrestCircle({ name, src, size = 36 }: { name: string; src: string | null; size?: number }) {
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    if (src) {
      return <img src={src} style={{ width: size, height: size, borderRadius: "50%", objectFit: "contain", border: "1px solid var(--border-color)", background: "var(--bg-card)", flexShrink: 0 }} />;
    }
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--bg-input)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.3, fontWeight: 800, color: "var(--text-muted)" }}>
        {initials || "?"}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Matchday Hubs</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Espais col·laboratius per coordinar el contingut de cada partit.
          </p>
        </div>
        <button
          onClick={onCreatePlan}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nou Matchday Hub
        </button>
      </div>

      {matchdayPlans.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Cap pla de Matchday</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>Crea un pla de tipus Matchday per activar-hi la col·laboració.</p>
          <button onClick={onCreatePlan} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Crear pla Matchday
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {sortedDates.map((date) => {
            const d = new Date(date + "T12:00:00");
            const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
            const isToday = d.getTime() === today.getTime();
            const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

            return (
              <div key={date}>
                {/* Date header */}
                <div style={{ padding: "10px 20px 7px", position: "sticky", top: 0, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", zIndex: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {isToday ? "Avui — " : ""}{dateLabel}
                  </span>
                </div>

                {/* Match rows */}
                {grouped[date].map((plan) => {
                  const isHub = plan.collaborationEnabled;
                  const kickoffTime = plan.eventStartAt?.slice(11, 16) || "—";
                  const crest = getCrest(plan);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => {
                        if (isHub) { setActiveHub(plan); }
                        else { enableCollaboration(plan); }
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border-color)", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      {/* Time */}
                      <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{kickoffTime}</span>
                      </div>

                      {/* Home crest + name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {plan.team || "Local"}
                        </span>
                        <CrestCircle name={plan.team || "L"} src={null} size={34} />
                      </div>

                      {/* VS pill */}
                      <div style={{ flexShrink: 0, padding: "4px 10px", background: "var(--bg-input)", borderRadius: 8, fontSize: 11, fontWeight: 900, color: "var(--text-muted)", textAlign: "center" }}>
                        VS
                      </div>

                      {/* Away crest + name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <CrestCircle name={plan.opponent || "V"} src={crest} size={34} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {plan.opponent || "Visitant"}
                        </span>
                      </div>

                      {/* Hub badge or activate */}
                      <div style={{ flexShrink: 0 }}>
                        {isHub ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "#3B82F620", color: "#3B82F6", fontSize: 11, fontWeight: 700 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3B82F6" }} />
                            Hub actiu
                          </span>
                        ) : (
                          <span style={{ padding: "3px 9px", borderRadius: 999, border: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {enablingId === plan.id ? "Activant…" : "Activar"}
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Matchday Hub Workspace ────────────────────────────────────────────────────

type HubTab = "overview" | "runofshow" | "content" | "documents" | "brandkits" | "people" | "activity";

function MatchdayHubWorkspace({
  plan, onClose, onUpdated,
}: {
  plan: ContentPlan;
  onClose: () => void;
  onUpdated: (p: ContentPlan) => void;
}) {
  const { t } = useLanguage();
  const [hubTab, setHubTab] = useState<HubTab>("overview");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  // Shared plan (child plan for rival collaboration)
  const [sharedPlan, setSharedPlan] = useState<ContentPlan | null>(null);
  const [sharedItems, setSharedItems] = useState<CalendarItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [creatingShared, setCreatingShared] = useState(false);
  const [rosView, setRosView] = useState<"intern" | "both" | "shared">("both");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOrg, setInviteOrg] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [showAddContent, setShowAddContent] = useState(false);
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);

  type HubDoc = { id: string; name: string; url: string; type: string; addedAt: string };
  type HubPerson = { id: string; name: string; role: string; email: string };

  const [docs, setDocs] = useState<HubDoc[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(`hub_docs_${plan.id}`) || "[]"); } catch { return []; }
  });

  function parsePeople(raw: string[]): HubPerson[] {
    return raw.map((m, i) => {
      try { const p = JSON.parse(m); return { id: p.id || String(i), name: p.name || m, role: p.role || "", email: p.email || "" }; }
      catch { return { id: String(i), name: m, role: "", email: "" }; }
    });
  }
  const [people, setPeople] = useState<HubPerson[]>(() => parsePeople(plan.teamMembers || []));

  type BrandColors = { primary: string; secondary: string; accent: string };
  const [brandColors, setBrandColors] = useState<BrandColors>(() => {
    try { const c = JSON.parse(plan.colorScheme || "{}"); return { primary: c.primary || "#1D4ED8", secondary: c.secondary || "#F5C542", accent: c.accent || "#FFFFFF" }; }
    catch { return { primary: "#1D4ED8", secondary: "#F5C542", accent: "#FFFFFF" }; }
  });

  function saveDocs(newDocs: HubDoc[]) {
    setDocs(newDocs);
    try { localStorage.setItem(`hub_docs_${plan.id}`, JSON.stringify(newDocs)); } catch {}
  }

  async function savePeople(newPeople: HubPerson[]) {
    setPeople(newPeople);
    await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamMembers: newPeople.map((p) => JSON.stringify(p)) }),
    }).then((r) => r.ok ? r.json() : null).then((p) => p && onUpdated(p as ContentPlan)).catch(() => {});
  }

  async function saveBrandColors(c: BrandColors) {
    setBrandColors(c);
    await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorScheme: JSON.stringify(c) }),
    }).then((r) => r.ok ? r.json() : null).then((p) => p && onUpdated(p as ContentPlan)).catch(() => {});
  }

  const kickoffTime = plan.eventStartAt?.slice(11, 16) || "20:00";
  const [tick, setTick] = useState(0);

  // Inline editing state for hub header
  const planExt = plan as ContentPlan & { teamHandle?: string | null; opponentHandle?: string | null };
  const [editField, setEditField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    team: plan.team || "",
    opponent: plan.opponent || "",
    teamHandle: planExt.teamHandle || "",
    opponentHandle: planExt.opponentHandle || "",
    competition: plan.competition || "",
    venue: plan.venue || "",
    kickoffTime: kickoffTime,
  });

  async function saveHubField(field: string, value: string) {
    const body: Record<string, unknown> = {};
    if (field === "kickoffTime") {
      const base = plan.eventStartAt?.slice(0, 10) || plan.startDate;
      body.eventStartAt = `${base}T${value}:00`;
    } else {
      body[field] = value || null;
    }
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { const p = await res.json(); onUpdated(p as ContentPlan); }
    setEditField(null);
  }

  function HubEditableText({ field, value, style, onEnter }: { field: string; value: string; style?: React.CSSProperties; onEnter?: () => void }) {
    const isEditing = editField === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValues[field as keyof typeof editValues]}
          onChange={(e) => setEditValues((v) => ({ ...v, [field]: e.target.value }))}
          onBlur={() => saveHubField(field, editValues[field as keyof typeof editValues])}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveHubField(field, editValues[field as keyof typeof editValues]); onEnter?.(); } if (e.key === "Escape") setEditField(null); }}
          style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6, color: "#fff", fontFamily: "inherit", outline: "none", padding: "2px 6px", width: "100%", ...style }}
        />
      );
    }
    return (
      <span
        onClick={() => { setEditValues((v) => ({ ...v, [field]: (field === "kickoffTime" ? kickoffTime : (plan as unknown as Record<string, string>)[field]) || "" })); setEditField(field); }}
        title="Clica per editar"
        style={{ cursor: "text", borderBottom: "1px dashed rgba(255,255,255,0.2)", paddingBottom: 1, ...style }}
      >
        {value || <span style={{ opacity: 0.4, fontStyle: "italic", fontWeight: 400, fontSize: "0.85em" }}>Edita...</span>}
      </span>
    );
  }

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function getCountdownParts() {
    if (!plan.startDate) return { days: 0, hours: 0, mins: 0, secs: 0, over: false };
    try {
      const dt = new Date(`${plan.startDate}T${kickoffTime}:00`);
      const diff = dt.getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, over: true };
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return { days, hours, mins, secs, over: false };
    } catch { return { days: 0, hours: 0, mins: 0, secs: 0, over: false }; }
  }
  const cdParts = getCountdownParts();
  void tick;

  useEffect(() => {
    if (!plan.id) return;
    setLoadingItems(true);
    fetch(`/api/calendar?planId=${plan.id}`)
      .then((r) => r.json())
      .then((data) => { setItems(Array.isArray(data) ? data : []); setLoadingItems(false); })
      .catch(() => setLoadingItems(false));
  }, [plan.id]);

  // Load the shared (rival) child plan
  useEffect(() => {
    if (!plan.id) return;
    setLoadingShared(true);
    fetch("/api/plans")
      .then((r) => r.json())
      .then((all: ContentPlan[]) => {
        const child = all.find((p) => (p as ContentPlan & { parentPlanId?: string }).parentPlanId === plan.id && p.type === "matchday");
        if (child) {
          setSharedPlan(child);
          return fetch(`/api/calendar?planId=${child.id}`).then((r) => r.json()).then((data) => setSharedItems(Array.isArray(data) ? data : []));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingShared(false));
  }, [plan.id]);

  async function createSharedPlan() {
    setCreatingShared(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${plan.name} — Pla compartit`,
          type: "matchday",
          sport: plan.sport,
          startDate: plan.startDate,
          endDate: plan.endDate,
          timezone: plan.timezone,
          eventStartAt: plan.eventStartAt,
          eventEndAt: plan.eventEndAt,
          team: plan.team,
          opponent: plan.opponent,
          competition: plan.competition,
          venue: plan.venue,
          parentPlanId: plan.id,
          platforms: plan.platforms,
        }),
      });
      if (res.ok) {
        const created = await res.json() as ContentPlan;
        setSharedPlan(created);
        setSharedItems([]);
      }
    } finally {
      setCreatingShared(false);
    }
  }

  const HUB_TABS: { id: HubTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "runofshow", label: "Run of Show" },
    { id: "content", label: "Content" },
    { id: "documents", label: "Documents" },
    { id: "brandkits", label: "Brand Kits" },
    { id: "people", label: "People" },
    { id: "activity", label: "Activity" },
  ];

  function sendInvite() {
    if (!inviteEmail.trim()) return;
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestOrgName: inviteOrg, guestOrgEmail: inviteEmail }),
    }).then((r) => r.ok ? r.json() : null).then((p) => p && onUpdated(p as ContentPlan)).catch(() => {});
    setInviteSent(true);
    setTimeout(() => { setShowInvite(false); setInviteSent(false); setInviteEmail(""); setInviteOrg(""); }, 2500);
  }

  const guestOrg = plan.guestOrgName ?? undefined;
  const guestEmail = plan.guestOrgEmail ?? undefined;

  const [opponentCrest, setOpponentCrest] = useState<string | null | undefined>(
    () => (plan as unknown as Record<string, unknown>).opponentCrest as string | null | undefined
  );
  const [clubCrest, setClubCrest] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem("scp-club-crest"); } catch { return null; }
  });
  const clubCrestInputRef = useRef<HTMLInputElement>(null);
  const opponentCrestInputRef = useRef<HTMLInputElement>(null);
  function handleClubCrestUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setClubCrest(url);
      try { localStorage.setItem("scp-club-crest", url); } catch {}
    };
    reader.readAsDataURL(file);
  }
  function handleOpponentCrestUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setOpponentCrest(url);
      saveHubField("opponentCrest", url);
      // Sync globally by opponent name so other plans show the same crest
      if (plan.opponent) { try { localStorage.setItem(`team_crest_${plan.opponent}`, url); } catch {} }
      // Also update the plan card competition logo slot
      try { localStorage.setItem(`plan_comp_logo_${plan.id}`, url); } catch {}
    };
    reader.readAsDataURL(file);
  }
  function removeOpponentCrest() {
    setOpponentCrest(null);
    saveHubField("opponentCrest", "");
    if (plan.opponent) { try { localStorage.removeItem(`team_crest_${plan.opponent}`); } catch {} }
    try { localStorage.removeItem(`plan_comp_logo_${plan.id}`); } catch {}
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Hub Header ── */}
      <div style={{ background: "linear-gradient(180deg, #050D1A 0%, #0D1B33 60%, #112040 100%)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {/* Subtle radial glow */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(29,78,216,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Top bar: back + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 0", position: "relative" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 11, display: "flex", alignItems: "center", gap: 4, padding: 0, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Tornar
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowInvite(true)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Convidar
            </button>
            <button onClick={() => setHubTab("runofshow")} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#F5C542", color: "#0D1421", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              Matchday Mode
            </button>
          </div>
        </div>

        {/* Date — large gold */}
        <div style={{ textAlign: "center", padding: "14px 16px 0", position: "relative" }}>
          {plan.startDate && (
            <div style={{ fontSize: 13, fontWeight: 900, color: "#F5C542", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {new Date(plan.startDate + "T12:00:00").toLocaleDateString("ca-ES", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
            </div>
          )}
          {/* Countdown */}
          <div style={{ marginTop: 6, marginBottom: 2 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Compte enrere</div>
            {cdParts.over ? (
              <div style={{ fontSize: 22, fontWeight: 900, color: "#F5C542", letterSpacing: "0.05em" }}>FINALITZAT</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                {[
                  { val: cdParts.days, label: "DIES" },
                  { val: cdParts.hours, label: "HORES" },
                  { val: cdParts.mins, label: "MIN" },
                  { val: cdParts.secs, label: "SEG" },
                ].map((seg, i) => (
                  <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {i > 0 && <span style={{ fontSize: 24, fontWeight: 900, color: "rgba(255,255,255,0.3)", lineHeight: 1, marginBottom: 14 }}>:</span>}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "center" }}>
                        {String(seg.val).padStart(2, "0")}
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginTop: 3 }}>{seg.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hidden crest file inputs */}
        <input ref={clubCrestInputRef} type="file" accept="image/*" onChange={handleClubCrestUpload} style={{ display: "none" }} />
        <input ref={opponentCrestInputRef} type="file" accept="image/*" onChange={handleOpponentCrestUpload} style={{ display: "none" }} />

        {/* Teams row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "10px 16px 12px", position: "relative" }}>
          {/* Home */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>LOCAL</div>
            <div style={{ position: "relative", width: 52, height: 52 }}>
              <div
                onClick={() => clubCrestInputRef.current?.click()}
                title="Canviar escut"
                style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: clubCrest ? "1px solid rgba(255,255,255,0.1)" : "1px dashed rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
              >
                {clubCrest ? (
                  <img src={clubCrest} alt="" style={{ width: 46, height: 46, objectFit: "contain" }} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontWeight: 600, textAlign: "center" }}>ESCUT</span>
                  </div>
                )}
              </div>
              {clubCrest && (
                <button onClick={(e) => { e.stopPropagation(); setClubCrest(null); try { localStorage.removeItem("scp-club-crest"); } catch {} }}
                  title="Treure escut" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                </button>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.02em", maxWidth: 140 }}>
              <HubEditableText field="team" value={plan.team || ""} style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, maxWidth: 140 }}>
              <HubEditableText field="teamHandle" value={planExt.teamHandle ? `@${planExt.teamHandle.replace(/^@/, "")}` : ""} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }} />
            </div>
          </div>

          {/* Center: kickoff time */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Inici</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#F5C542", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              <HubEditableText field="kickoffTime" value={kickoffTime} style={{ fontSize: 26, fontWeight: 900, color: "#F5C542", fontVariantNumeric: "tabular-nums" }} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <HubEditableText field="competition" value={plan.competition || ""} style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" }} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.04em" }}>
              <HubEditableText field="venue" value={plan.venue || ""} style={{ fontSize: 9, letterSpacing: "0.04em" }} />
            </div>
            {guestOrg && (
              <div style={{ marginTop: 8, padding: "3px 10px", borderRadius: 99, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{guestOrg}</span>
              </div>
            )}
          </div>

          {/* Away */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>VISITANT</div>
            <div style={{ position: "relative", width: 52, height: 52 }}>
              <div
                onClick={() => opponentCrestInputRef.current?.click()}
                title={opponentCrest ? "Canviar escut visitant" : "Afegir escut visitant"}
                style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: opponentCrest ? "1px solid rgba(255,255,255,0.1)" : "1px dashed rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
              >
                {opponentCrest ? (
                  <img src={opponentCrest} alt="" style={{ width: 46, height: 46, objectFit: "contain" }} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", fontWeight: 600, textAlign: "center" }}>ESCUT</span>
                  </div>
                )}
              </div>
              {opponentCrest && (
                <button onClick={(e) => { e.stopPropagation(); removeOpponentCrest(); }}
                  title="Treure escut" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                </button>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.02em", textAlign: "right", maxWidth: 140 }}>
              <HubEditableText field="opponent" value={plan.opponent || ""} style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em", textAlign: "right", display: "block" }} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "right", maxWidth: 140 }}>
              <HubEditableText field="opponentHandle" value={planExt.opponentHandle ? `@${planExt.opponentHandle.replace(/^@/, "")}` : ""} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "right" }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", marginLeft: 0, paddingLeft: 4, position: "relative" }}>
          {HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setHubTab(tab.id)}
              style={{
                padding: "9px 14px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 12, fontWeight: hubTab === tab.id ? 700 : 400,
                color: hubTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
                borderBottom: hubTab === tab.id ? "2px solid #F5C542" : "2px solid transparent",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, width: 360, maxWidth: "92vw", border: "1px solid var(--border-color)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Convidar equip</h3>
            {inviteSent ? (
              <p style={{ color: "#059669", fontWeight: 600 }}>✓ Invitació enviada!</p>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Nom de l&apos;organització</label>
                  <input value={inviteOrg} onChange={(e) => setInviteOrg(e.target.value)} placeholder="Club Rival FC" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Email de contacte</label>
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="prensa@clubrival.com" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowInvite(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel·lar</button>
                  <button onClick={sendInvite} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enviar convit</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* OVERVIEW */}
        {hubTab === "overview" && (
          <HubOverviewTab plan={plan} items={items} guestOrg={guestOrg} guestEmail={guestEmail} />
        )}

        {/* RUN OF SHOW */}
        {hubTab === "runofshow" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

            {/* Toggle header */}
            <div style={{ padding: "0 20px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: 0, background: "var(--bg-surface)", flexShrink: 0 }}>
              <button type="button" onClick={() => setRosView("intern")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", borderBottom: rosView === "intern" ? "2px solid var(--accent-primary)" : "2px solid transparent", color: rosView === "intern" ? "var(--accent-primary)" : "var(--text-muted)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Intern</span>
                {items.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: rosView === "intern" ? "var(--accent-subtle)" : "var(--bg-hover)", color: rosView === "intern" ? "var(--accent-primary)" : "var(--text-muted)", borderRadius: 99, padding: "1px 6px" }}>{items.length}</span>}
              </button>
              <button type="button" onClick={() => setRosView("both")} title="Veure els dos plans"
                style={{ padding: "11px 8px", background: "none", border: "none", cursor: "pointer", borderBottom: rosView === "both" ? "2px solid var(--text-muted)" : "2px solid transparent", color: rosView === "both" ? "var(--text-secondary)" : "var(--border-strong)", fontSize: 16, fontWeight: 300, lineHeight: 1 }}>
                |
              </button>
              <button type="button" onClick={() => setRosView("shared")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", borderBottom: rosView === "shared" ? "2px solid #7C3AED" : "2px solid transparent", color: rosView === "shared" ? "#7C3AED" : "var(--text-muted)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Compartit amb {plan.opponent || "rival"}</span>
                {sharedItems.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: rosView === "shared" ? "#EDE9FE" : "var(--bg-hover)", color: rosView === "shared" ? "#7C3AED" : "var(--text-muted)", borderRadius: 99, padding: "1px 6px" }}>{sharedItems.length}</span>}
              </button>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>

              {/* INTERN column — visible when intern or both */}
              {(rosView === "intern" || rosView === "both") && (
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: rosView === "both" ? "1px solid var(--border-color)" : "none", overflowY: "auto" }}>
                  <HubRunOfShowTab
                    plan={plan}
                    items={items}
                    loading={loadingItems}
                    onItemClick={(item) => { setEditItem(item); setShowAddContent(true); }}
                    onAddToPhase={(phaseKey, _date, _time, suggestedTitle) => {
                      setEditItem({ hubPhase: phaseKey, planId: plan.id, title: suggestedTitle || "" } as CalendarItem);
                      setShowAddContent(true);
                    }}
                    onRemoveItem={async (id) => {
                      await fetch(`/api/calendar/${id}`, { method: "DELETE" }).catch(() => {});
                      setItems((prev) => prev.filter((i) => i.id !== id));
                    }}
                  />
                </div>
              )}

              {/* COMPARTIT column — visible when shared or both */}
              {(rosView === "shared" || rosView === "both") && (
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: rosView === "both" ? "#FAFAFF" : "transparent", borderLeft: rosView === "both" ? "3px solid #7C3AED22" : "none", overflowY: "auto" }}>
                  {sharedPlan ? (
                    <HubRunOfShowTab
                      plan={sharedPlan}
                      items={sharedItems}
                      loading={loadingShared}
                      accentColor="#7C3AED"
                      onItemClick={(item) => { setEditItem(item); setShowAddContent(true); }}
                      onAddToPhase={(phaseKey, _date, _time, suggestedTitle) => {
                        setEditItem({ hubPhase: phaseKey, planId: sharedPlan.id, title: suggestedTitle || "" } as CalendarItem);
                        setShowAddContent(true);
                      }}
                      onRemoveItem={async (id) => {
                        await fetch(`/api/calendar/${id}`, { method: "DELETE" }).catch(() => {});
                        setSharedItems((prev) => prev.filter((i) => i.id !== id));
                      }}
                    />
                  ) : (
                    <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#4C1D95" }}>Pla compartit amb {plan.opponent || "el rival"}</div>
                      <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 280 }}>
                        Coordina el contingut conjunt, col·laboracions i accions de comunicació compartides.
                      </div>
                      <button onClick={createSharedPlan} disabled={creatingShared}
                        style={{ marginTop: 4, padding: "9px 20px", borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: creatingShared ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 7, opacity: creatingShared ? 0.7 : 1 }}>
                        {creatingShared ? (
                          <><span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Creant…</>
                        ) : (
                          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Crear pla compartit</>
                        )}
                      </button>
                      <p style={{ fontSize: 11, color: "#9CA3AF", maxWidth: 260 }}>El pla intern es manté privat.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* CONTENT */}
        {hubTab === "content" && (
          <HubContentTab
            items={items}
            loading={loadingItems}
            planId={plan.id}
            onAddContent={() => { setEditItem(null); setShowAddContent(true); }}
            onItemClick={(item) => { setEditItem(item); setShowAddContent(true); }}
          />
        )}

        {hubTab === "documents" && (
          <HubDocumentsTab docs={docs} onSave={saveDocs} />
        )}

        {hubTab === "brandkits" && (
          <HubBrandKitsTab
            clubCrest={clubCrest}
            opponentCrest={opponentCrest}
            teamName={plan.team}
            opponentName={plan.opponent}
            colors={brandColors}
            onSave={saveBrandColors}
          />
        )}

        {hubTab === "people" && (
          <HubPeopleTab people={people} onSave={savePeople} />
        )}

        {hubTab === "activity" && (
          <HubActivityTab items={items} plan={plan} loading={loadingItems} />
        )}
      </div>

      {/* Add/edit content item modal — scoped to this hub */}
      {showAddContent && (
        <ItemModal
          item={editItem || { planId: plan.id }}
          defaultDate={plan.startDate?.slice(0, 10) || toDateStr(new Date())}
          onClose={() => { setShowAddContent(false); setEditItem(null); }}
          onSave={(saved) => {
            const isShared = sharedPlan && saved.planId === sharedPlan.id;
            if (isShared) {
              setSharedItems((prev) => {
                const idx = prev.findIndex((i) => i.id === saved.id);
                return idx >= 0 ? prev.map((i) => i.id === saved.id ? saved : i) : [saved, ...prev];
              });
            } else {
              setItems((prev) => {
                const idx = prev.findIndex((i) => i.id === saved.id);
                return idx >= 0 ? prev.map((i) => i.id === saved.id ? saved : i) : [saved, ...prev];
              });
            }
            setShowAddContent(false);
            setEditItem(null);
          }}
          onDelete={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id));
            setSharedItems((prev) => prev.filter((i) => i.id !== id));
            setShowAddContent(false);
            setEditItem(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ── Hub Tab Components ────────────────────────────────────────────────────────

function HubOverviewTab({ plan, items, guestOrg, guestEmail }: { plan: ContentPlan; items: CalendarItem[]; guestOrg?: string; guestEmail?: string }) {
  const total = items.length;
  const approved = items.filter((i) => i.approvalStatus === "approved").length;
  const pending = items.filter((i) => i.approvalStatus === "pending_approval" || !i.approvalStatus).length;
  const published = items.filter((i) => i.status === "published").length;
  const readiness = total > 0 ? Math.round((approved / total) * 100) : 0;

  const cardStyle: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "16px" };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {[
          { label: "Total continguts", value: total, color: "var(--text-primary)" },
          { label: "Aprovats", value: approved, color: "#059669" },
          { label: "Pendents", value: pending, color: "#F59E0B" },
          { label: "Publicats", value: published, color: "#3B82F6" },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Readiness */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Preparació del hub</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6" }}>{readiness}%</span>
        </div>
        <div style={{ height: 8, background: "var(--bg-input)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${readiness}%`, background: "#3B82F6", borderRadius: 4, transition: "width 0.5s" }} />
        </div>
      </div>

      {/* Teams */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Equips</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#3B82F615", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{plan.team || "Equip local"}</div>
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Host — Col·laboració activa</div>
            </div>
          </div>
          {guestOrg ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8B5CF615", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.7.6-.4 1l6.2 6.2L6 17.8c-.2.5.1 1 .7.9l5.3-1.3 5.3 5.3c.4.4 1 .2.9-.7z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{guestOrg}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{guestEmail || "Convidat"}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "12px", borderRadius: 10, background: "var(--bg-input)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Convida l&apos;equip rival per col·laborar</span>
            </div>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Checklist de preparació</h3>
        {[
          { label: "Informació del partit confirmada", done: !!(plan.team && plan.opponent && plan.competition) },
          { label: "Hora de kick-off confirmada", done: !!(plan.eventStartAt || plan.startDate) },
          { label: "Equip rival convidat", done: !!guestOrg },
          { label: "Contingut assignat", done: items.some((i) => i.assigneeId) },
          { label: "Contingut aprovat", done: approved > 0 },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--border-color)" : "none" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: item.done ? "#D1FAE5" : "var(--bg-input)", border: `1.5px solid ${item.done ? "#059669" : "var(--border-color)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span style={{ fontSize: 13, color: item.done ? "var(--text-primary)" : "var(--text-muted)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HubRunOfShowTab({ plan, items, loading, onItemClick, onAddToPhase, onRemoveItem, accentColor }: { plan: ContentPlan; items: CalendarItem[]; loading: boolean; onItemClick: (i: CalendarItem) => void; onAddToPhase?: (phaseKey: string, date: string, time: string, suggestedTitle?: string) => void; onRemoveItem?: (id: string) => void; accentColor?: string }) {
  const kickoffDate = plan.startDate;
  const kickoffTime = plan.eventStartAt?.slice(11, 16) || "20:00";
  const [quickAddPhase, setQuickAddPhase] = useState<string | null>(null);

  const phaseGroups = HUB_PHASES.reduce<Record<string, typeof HUB_PHASES>>((acc, ph) => {
    if (!acc[ph.phase]) acc[ph.phase] = [];
    acc[ph.phase].push(ph);
    return acc;
  }, {});

  const itemsByHubPhase: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    const k = item.hubPhase || "unassigned";
    if (!itemsByHubPhase[k]) itemsByHubPhase[k] = [];
    itemsByHubPhase[k].push(item);
  }

  // Phase date overrides: store custom datetime-local values per phase key
  const storageKey = `hub_phase_dates_${plan.id}`;
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });
  const [editingPhase, setEditingPhase] = useState<string | null>(null);

  function getPhaseISO(relMin: number): string {
    if (!kickoffDate || !kickoffTime) return "";
    try {
      const ko = new Date(`${kickoffDate}T${kickoffTime}:00`);
      const dt = new Date(ko.getTime() + relMin * 60000);
      return dt.toISOString().slice(0, 16);
    } catch { return ""; }
  }

  function formatDateTimeLocal(iso: string): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ca-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  function getPhaseDate(phKey: string, relMin: number): string {
    const override = phaseOverrides[phKey];
    if (override) return formatDateTimeLocal(override);
    if (!kickoffDate || !kickoffTime) return "—";
    try {
      const ko = new Date(`${kickoffDate}T${kickoffTime}:00`);
      const dt = new Date(ko.getTime() + relMin * 60000);
      return dt.toLocaleString("ca-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  }

  function savePhaseDateOverride(phKey: string, value: string) {
    const next = { ...phaseOverrides, [phKey]: value };
    setPhaseOverrides(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    setEditingPhase(null);
  }

  const STATUS_DOT: Record<string, string> = accentColor
    ? { planned: `${accentColor}55`, in_production: accentColor, ready: accentColor, published: accentColor }
    : { planned: "#9CA3AF", in_production: "#3B82F6", ready: "#10B981", published: "#059669" };

  return (
    <div style={{ padding: 20 }}>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregant…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(phaseGroups).map(([phaseName, phaseKeys]) => {
            const baseColors = HUB_PHASE_COLORS[phaseName] || { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" };
            const colors = accentColor
              ? { bg: `${accentColor}10`, text: accentColor, border: `${accentColor}30` }
              : baseColors;
            return (
              <div key={phaseName}>
                {/* Phase header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ height: 1, flex: 1, background: colors.border }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: colors.text, background: colors.bg, padding: "3px 10px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {phaseName}
                  </span>
                  <div style={{ height: 1, flex: 1, background: colors.border }} />
                </div>

                {/* Phase slots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {phaseKeys.map((ph) => {
                    const phItems = itemsByHubPhase[ph.key] || [];
                    const phDate = getPhaseDate(ph.key, ph.relMin);
                    const isEditingDate = editingPhase === ph.key;
                    const currentISO = phaseOverrides[ph.key] || getPhaseISO(ph.relMin);
                    return (
                      <div key={ph.key} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
                        {/* Slot header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: colors.bg + "60", borderBottom: phItems.length > 0 || quickAddPhase === ph.key ? "1px solid var(--border-color)" : "none" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: colors.text, minWidth: 52 }}>{ph.label}</span>
                          {isEditingDate ? (
                            <input
                              type="datetime-local"
                              defaultValue={currentISO}
                              autoFocus
                              onBlur={(e) => savePhaseDateOverride(ph.key, e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingPhase(null); }}
                              style={{ fontSize: 11, color: "var(--text-primary)", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "2px 6px", background: "var(--bg-surface)", outline: "none", cursor: "text" }}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingPhase(ph.key)}
                              title="Canviar data i hora"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 4px", borderRadius: 5, cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {phDate}
                              {phaseOverrides[ph.key] && <span style={{ fontSize: 9, color: colors.text, fontWeight: 700, background: colors.bg, borderRadius: 4, padding: "1px 4px", marginLeft: 2 }}>·</span>}
                            </button>
                          )}
                          <div style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{phItems.length} {phItems.length === 1 ? "element" : "elements"}</span>
                          {onAddToPhase && (
                            <button
                              onClick={() => setQuickAddPhase(quickAddPhase === ph.key ? null : ph.key)}
                              style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${colors.border}`, background: quickAddPhase === ph.key ? colors.text : colors.bg, color: quickAddPhase === ph.key ? "#fff" : colors.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                              title="Afegir contingut a aquest slot"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                          )}
                        </div>

                        {/* Quick-add suggestion panel */}
                        {quickAddPhase === ph.key && onAddToPhase && (() => {
                          const suggestions = PHASE_QUICK_ITEMS[ph.key] || [];
                          const groups = Array.from(new Set(suggestions.map(s => s.group).filter(Boolean))) as string[];
                          const ungrouped = suggestions.filter(s => !s.group);
                          const chipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${colors.border}`, background: "var(--bg-surface)", color: "#374151", fontSize: 12, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" };
                          return (
                            <div style={{ padding: "12px 14px", borderBottom: phItems.length > 0 ? "1px solid var(--border-color)" : "none", background: colors.bg + "25" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: colors.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Afegeix contingut</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {ungrouped.map((s) => (
                                  <button key={s.label} onClick={() => { onAddToPhase(ph.key, getPhaseDate(ph.key, ph.relMin).split(",")[0] || kickoffDate || "", ph.relMin !== 0 ? "" : kickoffTime, s.label); setQuickAddPhase(null); }} style={chipStyle}>
                                    <span style={{ color: colors.text, opacity: 0.8, flexShrink: 0 }}>{QA_ICONS[s.icon]}</span>{s.label}
                                  </button>
                                ))}
                              </div>
                              {groups.map((group) => (
                                <div key={group} style={{ marginTop: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{group}</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                    {suggestions.filter(s => s.group === group).map((s) => (
                                      <button key={s.label} onClick={() => { onAddToPhase(ph.key, getPhaseDate(ph.key, ph.relMin).split(",")[0] || kickoffDate || "", ph.relMin !== 0 ? "" : kickoffTime, s.label); setQuickAddPhase(null); }} style={chipStyle}>
                                        <span style={{ color: colors.text, opacity: 0.8, flexShrink: 0 }}>{QA_ICONS[s.icon]}</span>{s.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={() => { onAddToPhase(ph.key, getPhaseDate(ph.key, ph.relMin).split(",")[0] || kickoffDate || "", ph.relMin !== 0 ? "" : kickoffTime); setQuickAddPhase(null); }}
                                style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: `1px dashed ${colors.border}`, background: "transparent", color: colors.text, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Personalitzar...
                              </button>
                            </div>
                          );
                        })()}

                        {/* Items */}
                        {phItems.map((item) => {
                          const dot = STATUS_DOT[item.status] || "#9CA3AF";
                          return (
                            <div
                              key={item.id}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--border-color)", cursor: "pointer" }}
                              onClick={() => onItemClick(item)}
                            >
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  {item.plannedTime && `${item.plannedTime.slice(0, 5)} · `}
                                  {item.platforms?.join(", ") || "—"}
                                </div>
                              </div>
                              {item.approvalStatus && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: item.approvalStatus === "approved" ? "#D1FAE5" : "#FEF3C7", color: item.approvalStatus === "approved" ? "#059669" : "#92400E", flexShrink: 0 }}>
                                  {item.approvalStatus === "approved" ? "✓" : "·"}
                                </span>
                              )}
                              {onRemoveItem && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                                  style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border-color)", background: "none", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.7 }}
                                  title="Treure del Run of Show"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HubContentTab({ items, loading, planId, onAddContent, onItemClick }: { items: CalendarItem[]; loading: boolean; planId?: string; onAddContent?: () => void; onItemClick?: (item: CalendarItem) => void }) {
  const [filter, setFilter] = useState<string>("");
  const filtered = filter ? items.filter((i) => i.status === filter || i.approvalStatus === filter) : items;
  const STATUS_DOT: Record<string, string> = {
    planned: "#9CA3AF", in_production: "#3B82F6", ready: "#10B981", published: "#059669",
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Header row with add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{items.length} element{items.length !== 1 ? "s" : ""}</span>
        {onAddContent && (
          <button onClick={onAddContent} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#0D1421", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Afegir contingut
          </button>
        )}
      </div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Tots", val: "" },
          { label: "En producció", val: "in_production" },
          { label: "Ready", val: "ready" },
          { label: "Publicat", val: "published" },
          { label: "Aprovat", val: "approved" },
          { label: "Pendent", val: "pending_approval" },
        ].map((f) => (
          <button
            key={f.val}
            onClick={() => setFilter(f.val)}
            style={{ padding: "5px 12px", borderRadius: 99, border: `1px solid ${filter === f.val ? "var(--color-charcoal)" : "var(--border-color)"}`, background: filter === f.val ? "var(--color-charcoal-subtle)" : "transparent", color: filter === f.val ? "var(--color-charcoal)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregant…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            </div>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Sense contingut. {onAddContent ? <button onClick={onAddContent} style={{ background: "none", border: "none", color: "#1D4ED8", cursor: "pointer", fontWeight: 600, fontSize: 14, padding: 0 }}>Afegir contingut</button> : "Afegeix elements des de Calendar."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((item) => {
            const dot = STATUS_DOT[item.status] || "#9CA3AF";
            const hubPh = item.hubPhase;
            const pubBy = item.publishedBy;
            return (
              <div key={item.id} onClick={() => onItemClick?.(item)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: onItemClick ? "pointer" : "default" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {item.plannedDate} {item.plannedTime && `· ${item.plannedTime.slice(0, 5)}`}
                    {hubPh && ` · ${hubPh}`}
                    {pubBy && ` · ${pubBy === "home" ? "Local" : pubBy === "away" ? "Visitant" : pubBy === "both" ? "Ambdós" : pubBy}`}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {item.platforms?.slice(0, 2).map((p) => (
                    <span key={p} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>{p}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Hub extra tab components ──────────────────────────────────────────────────

type HubDoc = { id: string; name: string; url: string; type: string; addedAt: string };
type HubPerson = { id: string; name: string; role: string; email: string };
type BrandColors = { primary: string; secondary: string; accent: string };

const CONTENT_CATEGORIES = [
  { id: "tots", label: "Tots", color: "#6B7280" },
  { id: "fan_zone", label: "Fan Zone", color: "#DC2626" },
  { id: "influencers", label: "Influencers", color: "#7C3AED" },
  { id: "ticketing", label: "Ticketing", color: "#D97706" },
  { id: "stories", label: "Stories", color: "#DB2777" },
  { id: "fotos", label: "Fotos", color: "#059669" },
  { id: "video", label: "Vídeo", color: "#EF4444" },
  { id: "dissenys", label: "Dissenys", color: "#1D4ED8" },
  { id: "estadi", label: "Estadi", color: "#0891B2" },
];

function HubDocumentsTab({ docs, onSave }: { docs: HubDoc[]; onSave: (d: HubDoc[]) => void }) {
  const [activeCategory, setActiveCategory] = useState("tots");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("fan_zone");

  const filtered = activeCategory === "tots" ? docs : docs.filter((d) => d.type === activeCategory);

  function add() {
    if (!name.trim() || !url.trim()) return;
    const doc: HubDoc = { id: Date.now().toString(), name: name.trim(), url: url.trim(), type, addedAt: new Date().toISOString() };
    onSave([...docs, doc]);
    setName(""); setUrl(""); setShowAdd(false);
  }

  const catMeta = (id: string) => CONTENT_CATEGORIES.find((c) => c.id === id) || CONTENT_CATEGORIES[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Category nav — styled like the Barça blue bar */}
      <div style={{ background: "#0D1421", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" }}>
        <div style={{ display: "flex", gap: 0, paddingLeft: 4, minWidth: "max-content" }}>
          {CONTENT_CATEGORIES.map((cat) => {
            const count = cat.id === "tots" ? docs.length : docs.filter((d) => d.type === cat.id).length;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{ padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", color: active ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: active ? 800 : 500, borderBottom: active ? `2px solid ${cat.color}` : "2px solid transparent", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5, transition: "color 0.15s" }}
              >
                {cat.label}
                {count > 0 && <span style={{ fontSize: 10, background: active ? cat.color : "rgba(255,255,255,0.15)", color: "#fff", padding: "1px 5px", borderRadius: 99, fontWeight: 700 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{catMeta(activeCategory).label}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{filtered.length} element{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#0D1421", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Afegir
          </button>
        </div>

        {showAdd && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom / Descripció" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL, Drive, Dropbox..." style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Categoria</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CONTENT_CATEGORIES.filter((c) => c.id !== "tots").map((cat) => (
                  <button key={cat.id} onClick={() => setType(cat.id)} style={{ padding: "5px 11px", borderRadius: 7, border: `1.5px solid ${type === cat.id ? cat.color : "var(--border-color)"}`, background: type === cat.id ? cat.color + "18" : "transparent", fontSize: 11, cursor: "pointer", color: type === cat.id ? cat.color : "var(--text-muted)", fontWeight: type === cat.id ? 700 : 500 }}>{cat.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>Cancel·lar</button>
              <button onClick={add} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Afegir</button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>Sense continguts a {catMeta(activeCategory).label}.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((doc) => {
              const cat = catMeta(doc.type);
              return (
                <div key={doc.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: cat.color + "18", border: `1px solid ${cat.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.color + "15", padding: "1px 6px", borderRadius: 4 }}>{cat.label}</span>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: "#3B82F6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.url}</a>
                    </div>
                  </div>
                  <button onClick={() => onSave(docs.filter((d) => d.id !== doc.id))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)", background: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HubBrandKitsTab({ clubCrest, opponentCrest, teamName, opponentName, colors, onSave }: { clubCrest: string | null; opponentCrest?: string | null; teamName: string | null; opponentName: string | null; colors: BrandColors; onSave: (c: BrandColors) => void }) {
  const [draft, setDraft] = useState(colors);
  const changed = JSON.stringify(draft) !== JSON.stringify(colors);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Identity */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Identitat visual</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: "var(--bg-input)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {clubCrest ? <img src={clubCrest} alt="" style={{ width: 58, height: 58, objectFit: "contain" }} /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{teamName || "Local"}</span>
          </div>
          {opponentCrest && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: "var(--bg-input)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src={opponentCrest} alt="" style={{ width: 58, height: 58, objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{opponentName || "Visitant"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Colors */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Colors del hub</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {([["primary", "Color principal"], ["secondary", "Color secundari"], ["accent", "Color d'accent"]] as const).map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: draft[key], border: "1px solid var(--border-color)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <input type="color" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} style={{ width: "100%", height: 32, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-input)", cursor: "pointer", padding: 2 }} />
              </div>
              <input value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", outline: "none" }} />
            </div>
          ))}
        </div>
        {changed && (
          <button onClick={() => onSave(draft)} style={{ marginTop: 14, width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Desar colors</button>
        )}
      </div>

      {/* Preview */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Previsualització</h3>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)" }}>
          <div style={{ background: draft.primary, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {clubCrest && <img src={clubCrest} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: draft.accent }}>{teamName || "Equip"}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginLeft: "auto" }}>vs.</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: draft.accent }}>{opponentName || "Rival"}</span>
          </div>
          <div style={{ background: draft.secondary, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: draft.primary }}>MATCHDAY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HubPeopleTab({ people, onSave }: { people: HubPerson[]; onSave: (p: HubPerson[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  function add() {
    if (!name.trim()) return;
    const person: HubPerson = { id: Date.now().toString(), name: name.trim(), role: role.trim(), email: email.trim() };
    onSave([...people, person]);
    setName(""); setRole(""); setEmail(""); setShowAdd(false);
  }

  const ROLE_COLORS: Record<string, string> = { "Director": "#7C3AED", "Editor": "#1D4ED8", "Fotògraf": "#059669", "Community Manager": "#D97706", "Dissenyador": "#DC2626" };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{people.length} persona{people.length !== 1 ? "es" : ""}</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#0D1421", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Afegir persona
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol (ex: Editor, Fotògraf...)" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opcional)" type="email" style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>Cancel·lar</button>
            <button onClick={add} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Afegir</button>
          </div>
        </div>
      )}

      {people.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>Cap persona assignada.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.map((person) => {
            const roleColor = ROLE_COLORS[person.role] || "#6B7280";
            const initials = person.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={person.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: roleColor + "20", border: `1.5px solid ${roleColor}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: roleColor }}>{initials}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{person.role}{person.email && ` · ${person.email}`}</div>
                </div>
                {person.role && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: roleColor + "18", color: roleColor, flexShrink: 0 }}>{person.role}</span>
                )}
                <button onClick={() => onSave(people.filter((p) => p.id !== person.id))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)", background: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HubActivityTab({ items, plan, loading }: { items: CalendarItem[]; plan: ContentPlan; loading: boolean }) {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const STATUS_COLORS: Record<string, string> = { planned: "#3B82F6", in_production: "#F59E0B", ready: "#8B5CF6", published: "#059669", cancelled: "#EF4444" };

  const events: { date: string; label: string; color: string; sub: string }[] = [
    { date: plan.createdAt, label: "Hub creat", color: "#1D4ED8", sub: plan.name },
    ...sorted.map((i) => ({ date: i.createdAt, label: "Contingut afegit", color: STATUS_COLORS[i.status] || "#6B7280", sub: i.title })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Activitat del hub</div>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregant…</p>
      ) : events.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Sense activitat registrada.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.color, flexShrink: 0, marginTop: 3 }} />
                {i < events.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--border-color)", marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ev.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{ev.sub}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {new Date(ev.date).toLocaleString("ca-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fixtures View ─────────────────────────────────────────────────────────────

function FixturesView({ plans, onOpenHub, onCreateMatchday }: { plans: ContentPlan[]; onOpenHub: (plan: ContentPlan) => void; onCreateMatchday: () => void }) {
  const matchdays = plans.filter((p) => p.type === "matchday").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const grouped: Record<string, ContentPlan[]> = {};
  for (const p of matchdays) {
    const key = p.startDate.slice(0, 7); // YYYY-MM
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  const months = Object.keys(grouped).sort();
  const [activeMonth, setActiveMonth] = useState(months[0] || "");

  useEffect(() => {
    if (months.length > 0 && !months.includes(activeMonth)) setActiveMonth(months[0]);
  }, [months.join(",")]);

  const clubCrest = typeof window !== "undefined" ? (() => { try { return localStorage.getItem("scp-club-crest"); } catch { return null; } })() : null;

  const monthLabel = (key: string) => {
    const d = new Date(key + "-01T12:00:00");
    return { year: d.getFullYear().toString(), month: d.toLocaleDateString("ca-ES", { month: "short" }).toUpperCase() };
  };

  if (matchdays.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Sense partits</h3>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-muted)" }}>Crea el teu primer Hub de Matchday per veure els partits aquí.</p>
        <button onClick={onCreateMatchday} style={{ padding: "10px 24px", borderRadius: 10, background: "#0D1421", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Crear primer Matchday Hub</button>
      </div>
    );
  }

  const displayMonths = months.length > 0 ? months : [activeMonth];
  const currentItems = grouped[activeMonth] || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Calendari de partits</h2>
          <button onClick={onCreateMatchday} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "#0D1421", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nou Matchday Hub
          </button>
        </div>

        {/* Month tabs */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", marginLeft: -20, marginRight: -20, paddingLeft: 20, borderBottom: "1px solid var(--border-color)" }}>
          {displayMonths.map((key) => {
            const { year, month } = monthLabel(key);
            const active = key === activeMonth;
            return (
              <button key={key} onClick={() => setActiveMonth(key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 20px 10px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid var(--color-charcoal)" : "2px solid transparent", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? "var(--text-muted)" : "var(--text-muted)", marginBottom: 1 }}>{year}</span>
                <span style={{ fontSize: 14, fontWeight: active ? 800 : 500, color: active ? "var(--text-primary)" : "var(--text-muted)" }}>{month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Match list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
        {currentItems.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0" }}>Sense partits aquest mes.</p>
        ) : (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "20px 0 12px" }}>
              {monthLabel(activeMonth).month} {monthLabel(activeMonth).year}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {currentItems.map((plan, idx) => {
                const kickoff = plan.eventStartAt?.slice(11, 16) || "20:00";
                const opp = (plan as unknown as Record<string, unknown>).opponentCrest as string | null | undefined;
                const isHome = plan.homeAway !== "away";
                const homeTeam = isHome ? (plan.team || "Equip") : (plan.opponent || "Rival");
                const awayTeam = isHome ? (plan.opponent || "Rival") : (plan.team || "Equip");
                const homeCrest = isHome ? clubCrest : opp;
                const awayCrest = isHome ? opp : clubCrest;
                const dateObj = new Date(plan.startDate + "T12:00:00");
                const dayStr = dateObj.toLocaleDateString("ca-ES", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

                return (
                  <div key={plan.id} onClick={() => onOpenHub(plan)} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", alignItems: "center", gap: 16, padding: "18px 0", borderBottom: idx < currentItems.length - 1 ? "1px solid var(--border-color)" : "none", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Date */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{dayStr}</div>
                      <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginTop: 2 }}>{kickoff}</div>
                    </div>

                    {/* Teams */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Home */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        {homeCrest ? (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                            <img src={homeCrest} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                          </div>
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-input)", flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{homeTeam}</span>
                      </div>

                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", padding: "0 8px", flexShrink: 0 }}>vs.</span>

                      {/* Away */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-start" }}>
                        {awayCrest ? (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                            <img src={awayCrest} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                          </div>
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-input)", flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{awayTeam}</span>
                      </div>
                    </div>

                    {/* Competition + Hub link */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      {plan.competition && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{plan.competition}</span>}
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Obrir Hub
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PLAN_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: "Draft",     bg: "#F3F4F6", text: "#6B7280" },
  active:    { label: "Active",    bg: "#D1FAE5", text: "#059669" },
  completed: { label: "Completed", bg: "#DBEAFE", text: "#1D4ED8" },
  archived:  { label: "Archived",  bg: "#FEF3C7", text: "#92400E" },
};

interface PlansViewProps {
  plans: ContentPlan[];
  onCreatePlan: () => void;
  onPlanUpdated: (plan: ContentPlan) => void;
  onPlanDeleted: (id: string) => void;
  planTypeColor: Record<string, string>;
  planStatusColor: Record<string, { bg: string; text: string }>;
  autoOpenPlanId?: string | null;
  onAutoOpened?: () => void;
  onOpenTournament?: (plan: ContentPlan) => void;
}

// ── Tournaments Hub View ──────────────────────────────────────────────────────

function TournamentsHubView({
  plans, onCreatePlan, autoOpenId, onAutoOpened,
}: {
  plans: ContentPlan[];
  onCreatePlan: () => void;
  autoOpenId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [activeTournament, setActiveTournament] = useState<ContentPlan | null>(null);
  const [logos, setLogos] = useState<Record<string, string>>(() => {
    try {
      const r: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("plan_comp_logo_")) { const v = localStorage.getItem(k); if (v) r[k.replace("plan_comp_logo_", "")] = v; }
      }
      return r;
    } catch { return {}; }
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const tournamentPlans = plans.filter((p) => p.type === "tournament");

  useEffect(() => {
    if (autoOpenId) {
      const plan = plans.find((p) => p.id === autoOpenId);
      if (plan) { setActiveTournament(plan); onAutoOpened?.(); }
    }
  }, [autoOpenId, plans, onAutoOpened]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!uploadingId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setLogos((prev) => ({ ...prev, [uploadingId]: url }));
      try { localStorage.setItem(`plan_comp_logo_${uploadingId}`, url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (activeTournament) {
    return <TournamentWorkspace plan={activeTournament} onClose={() => setActiveTournament(null)} />;
  }

  const fmtDateRange = (start: string, end: string) => {
    const s = new Date(start + "T12:00:00");
    const e = new Date((end || start) + "T12:00:00");
    if (start === end || !end) return s.toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" });
    return `${s.toLocaleDateString("ca-ES", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const days = (start: string, end: string) => {
    const ms = new Date((end || start) + "T12:00:00").getTime() - new Date(start + "T12:00:00").getTime();
    return Math.round(ms / 86400000) + 1;
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Tornejos</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Gestiona la cobertura de contingut de cada torneig.
          </p>
        </div>
        <button
          onClick={onCreatePlan}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nou torneig
        </button>
      </div>

      {tournamentPlans.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "var(--text-muted)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Cap torneig creat</h3>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)" }}>Crea un pla de tipus Torneig per organitzar la cobertura de múltiples dies i seus.</p>
          <button onClick={onCreatePlan} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Crear torneig
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {tournamentPlans.map((plan) => {
            const logo = logos[plan.id];
            const initials = plan.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            const numDays = days(plan.startDate, plan.endDate);
            const statusMeta = PLAN_STATUS_META[plan.status] ?? PLAN_STATUS_META.draft;

            return (
              <div key={plan.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Photo/logo header */}
                <div
                  style={{ height: 130, background: logo ? "transparent" : "linear-gradient(135deg, #7C3AED, #4F46E5)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
                  onClick={() => setActiveTournament(plan)}
                >
                  {logo ? (
                    <img src={logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36, fontWeight: 900, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", fontFamily: "monospace" }}>{initials}</div>
                    </div>
                  )}
                  {/* Status badge */}
                  <span style={{ position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: statusMeta.bg, color: statusMeta.text }}>{statusMeta.label}</span>
                  {/* Upload photo button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadingId(plan.id); logoInputRef.current?.click(); }}
                    title="Canviar foto del torneig"
                    style={{ position: "absolute", bottom: 8, right: 8, padding: "4px 8px", borderRadius: 6, border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, backdropFilter: "blur(4px)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Foto
                  </button>
                </div>

                {/* Card body */}
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{plan.name}</h3>

                  {/* Meta info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Dates */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span>{fmtDateRange(plan.startDate, plan.endDate)}</span>
                      <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>· {numDays} {numDays === 1 ? "dia" : "dies"}</span>
                    </div>
                    {/* Location */}
                    {plan.venue && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>{plan.venue}</span>
                      </div>
                    )}
                    {/* Competition */}
                    {plan.competition && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        <span>{plan.competition}</span>
                      </div>
                    )}
                  </div>

                  {/* Open button */}
                  <button
                    onClick={() => setActiveTournament(plan)}
                    style={{ marginTop: "auto", width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Obrir torneig →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tournament Workspace ──────────────────────────────────────────────────────

const ACCOUNT_CATEGORIES_DEF = [
  { id: "clubs", label: "Clubs", color: "#1D4ED8" },
  { id: "institutions", label: "Institucions", color: "#0891B2" },
  { id: "sponsors", label: "Patrocinadors", color: "#D97706" },
  { id: "media", label: "Mitjans", color: "#DC2626" },
  { id: "influencers", label: "Influencers", color: "#7C3AED" },
];

const STYLE_FIELDS_DEF = [
  { key: "voice", label: "Veu i to", type: "select", options: ["Formal", "Informal", "Neutre", "Inspiracional", "Dinàmic", "Proper"] },
  { key: "primary_font", label: "Tipografia principal", type: "text" },
  { key: "secondary_font", label: "Tipografia secundària", type: "text" },
  { key: "primary_color", label: "Color principal", type: "color" },
  { key: "secondary_color", label: "Color secundari", type: "color" },
  { key: "accent_color", label: "Color d'accent", type: "color" },
  { key: "hashtags", label: "Hashtags oficials", type: "text" },
  { key: "handles", label: "Mencions oficials", type: "text" },
  { key: "image_ratio", label: "Format d'imatge", type: "select", options: ["1:1", "4:5", "16:9", "9:16", "3:4"] },
  { key: "image_dimensions", label: "Dimensions recomanades", type: "text" },
  { key: "approved_terms", label: "Vocabulari de marca", type: "textarea" },
  { key: "prohibited_terms", label: "Terminologia prohibida", type: "textarea" },
  { key: "caption_template", label: "Template de caption", type: "textarea" },
  { key: "emoji_policy", label: "Directrius d'emoji", type: "text" },
  { key: "watermark", label: "Watermark / Overlays", type: "text" },
];

type TAccount = { id: string; category: string; name: string; handle: string; platform: string; notes: string };
type TPerson = { id: string; name: string; surname: string; role: string; mobile: string; email: string };
type TInfluencer = { id: string; name: string; followers: string; mobile: string; invited: boolean; actions: string; email: string };
type THostRow = { id: string; type: "bloc" | "segment"; label?: string; time?: string; script?: string; host?: string };
type TOrgCamp = { id: string; name: string; color: string };
type TOrgRow = { id: string; dia: string; horari: string; accio: string; camps: Record<string, string> };
type TTab = "host" | "accounts" | "team" | "style" | "organigrama";

function TournamentWorkspace({ plan, onClose }: { plan: ContentPlan; onClose: () => void }) {
  const days: string[] = [];
  const startD = new Date(plan.startDate + "T12:00:00");
  const endD = new Date((plan.endDate || plan.startDate) + "T12:00:00");
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) days.push(toDateStr(d));

  const [selectedDay, setSelectedDay] = useState(days[0] || "");
  const [tab, setTab] = useState<TTab>("host");

  const [hostRows, setHostRows] = useState<Record<string, THostRow[]>>(() => { try { return JSON.parse(localStorage.getItem(`t_host_${plan.id}`) || "{}"); } catch { return {}; } });
  function saveHostRows(day: string, rows: THostRow[]) { const u = { ...hostRows, [day]: rows }; setHostRows(u); try { localStorage.setItem(`t_host_${plan.id}`, JSON.stringify(u)); } catch {} }
  function addHostBloc(day: string) { saveHostRows(day, [...(hostRows[day] || []), { id: Date.now().toString(), type: "bloc", label: "NOU BLOC" }]); }
  function addHostRow(day: string) { saveHostRows(day, [...(hostRows[day] || []), { id: (Date.now() + 1).toString(), type: "segment", time: "", script: "", host: "" }]); }
  function updateHostRow(day: string, id: string, patch: Partial<THostRow>) { saveHostRows(day, (hostRows[day] || []).map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function deleteHostRow(day: string, id: string) { saveHostRows(day, (hostRows[day] || []).filter((r) => r.id !== id)); }

  const [influencers, setInfluencers] = useState<TInfluencer[]>(() => { try { return JSON.parse(localStorage.getItem(`t_influencers_${plan.id}`) || "[]"); } catch { return []; } });
  const [addingInfluencer, setAddingInfluencer] = useState(false);
  const [newInf, setNewInf] = useState<Partial<TInfluencer>>({ invited: false });
  function saveInfluencers(inf: TInfluencer[]) { setInfluencers(inf); try { localStorage.setItem(`t_influencers_${plan.id}`, JSON.stringify(inf)); } catch {} }

  const [orgCamps, setOrgCamps] = useState<TOrgCamp[]>(() => { try { return JSON.parse(localStorage.getItem(`t_orgcamps_${plan.id}`) || "[]"); } catch { return []; } });
  const [orgRows, setOrgRows] = useState<TOrgRow[]>(() => { try { return JSON.parse(localStorage.getItem(`t_orgrows_${plan.id}`) || "[]"); } catch { return []; } });
  const [addingOrgCamp, setAddingOrgCamp] = useState(false);
  const [newOrgCampName, setNewOrgCampName] = useState("");
  function saveOrgCamps(c: TOrgCamp[]) { setOrgCamps(c); try { localStorage.setItem(`t_orgcamps_${plan.id}`, JSON.stringify(c)); } catch {} }
  function saveOrgRows(r: TOrgRow[]) { setOrgRows(r); try { localStorage.setItem(`t_orgrows_${plan.id}`, JSON.stringify(r)); } catch {} }
  function addOrgRow() { saveOrgRows([...orgRows, { id: Date.now().toString(), dia: days[0] || "", horari: "", accio: "", camps: {} }]); }
  function updateOrgRow(id: string, patch: Partial<TOrgRow>) { saveOrgRows(orgRows.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function updateOrgCell(rowId: string, campId: string, val: string) { saveOrgRows(orgRows.map((r) => r.id === rowId ? { ...r, camps: { ...r.camps, [campId]: val } } : r)); }

  const [accounts, setAccounts] = useState<TAccount[]>(() => { try { return JSON.parse(localStorage.getItem(`t_accounts_${plan.id}`) || "[]"); } catch { return []; } });
  const [extraCats, setExtraCats] = useState<{ id: string; label: string; color: string }[]>(() => { try { return JSON.parse(localStorage.getItem(`t_acats_${plan.id}`) || "[]"); } catch { return []; } });
  const [catFilter, setCatFilter] = useState("all");
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAcc, setNewAcc] = useState<Partial<TAccount>>({ category: "clubs" });
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  function saveAccounts(a: TAccount[]) { setAccounts(a); try { localStorage.setItem(`t_accounts_${plan.id}`, JSON.stringify(a)); } catch {} }
  function saveExtraCats(c: typeof extraCats) { setExtraCats(c); try { localStorage.setItem(`t_acats_${plan.id}`, JSON.stringify(c)); } catch {} }
  const allCats = [...ACCOUNT_CATEGORIES_DEF, ...extraCats];

  const [team, setTeam] = useState<TPerson[]>(() => { try { return JSON.parse(localStorage.getItem(`t_team_${plan.id}`) || "[]"); } catch { return []; } });
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPerson, setNewPerson] = useState<Partial<TPerson>>({});
  function saveTeam(t: TPerson[]) { setTeam(t); try { localStorage.setItem(`t_team_${plan.id}`, JSON.stringify(t)); } catch {} }

  const [styleVals, setStyleVals] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(`t_style_${plan.id}`) || "{}"); } catch { return {}; } });
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>(() => { try { return JSON.parse(localStorage.getItem(`t_style_cf_${plan.id}`) || "[]"); } catch { return []; } });
  const [addingCF, setAddingCF] = useState(false);
  const [newCFLabel, setNewCFLabel] = useState("");
  function saveStyleVal(key: string, value: string) { const u = { ...styleVals, [key]: value }; setStyleVals(u); try { localStorage.setItem(`t_style_${plan.id}`, JSON.stringify(u)); } catch {} }
  function saveCustomFields(f: typeof customFields) { setCustomFields(f); try { localStorage.setItem(`t_style_cf_${plan.id}`, JSON.stringify(f)); } catch {} }

  const iStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  const DEFAULT_TABS: { id: TTab; label: string }[] = [
    { id: "host", label: "Guió del host" },
    { id: "accounts", label: "Comptes importants" },
    { id: "team", label: "Equip de comunicació" },
    { id: "style", label: "Guia d'estil" },
    { id: "organigrama", label: "Organigrama" },
  ];

  const [tabOrder, setTabOrder] = useState<TTab[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`t_tab_order_${plan.id}`) || "[]") as TTab[];
      if (Array.isArray(saved) && saved.length === DEFAULT_TABS.length && DEFAULT_TABS.every((dt) => saved.includes(dt.id))) return saved;
    } catch {}
    return DEFAULT_TABS.map((t) => t.id);
  });
  const [dragTabId, setDragTabId] = useState<TTab | null>(null);
  const TABS = tabOrder.map((id) => DEFAULT_TABS.find((t) => t.id === id)!).filter(Boolean);

  function handleTabDragStart(e: React.DragEvent, id: TTab) { e.dataTransfer.effectAllowed = "move"; setDragTabId(id); }
  function handleTabDragOver(e: React.DragEvent, targetId: TTab) {
    e.preventDefault();
    if (!dragTabId || dragTabId === targetId) return;
    const newOrder = [...tabOrder];
    const from = newOrder.indexOf(dragTabId);
    const to = newOrder.indexOf(targetId);
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, dragTabId);
    setTabOrder(newOrder);
    try { localStorage.setItem(`t_tab_order_${plan.id}`, JSON.stringify(newOrder)); } catch {}
  }
  function handleTabDragEnd() { setDragTabId(null); }

  const [competitionLogo, setCompetitionLogo] = useState<string | null>(() => {
    try { return localStorage.getItem(`plan_comp_logo_${plan.id}`); } catch { return null; }
  });
  const competitionLogoRef = useRef<HTMLInputElement>(null);

  function handleCompetitionLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setCompetitionLogo(url);
      try { localStorage.setItem(`plan_comp_logo_${plan.id}`, url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-primary)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ background: "#0D1421", color: "#fff", padding: "0 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, minHeight: 52 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "4px 8px 4px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>Plans
        </button>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{plan.name}</span>
        {plan.competition && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input ref={competitionLogoRef} type="file" accept="image/*" onChange={handleCompetitionLogoUpload} style={{ display: "none" }} />
            {competitionLogo ? (
              <div style={{ position: "relative" }}>
                <img src={competitionLogo} onClick={() => competitionLogoRef.current?.click()} style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4, cursor: "pointer", display: "block" }} />
                <button onClick={() => { setCompetitionLogo(null); try { localStorage.removeItem(`plan_comp_logo_${plan.id}`); } catch {} }} style={{ position: "absolute", top: -5, right: -5, width: 13, height: 13, borderRadius: "50%", background: "#DC2626", border: "none", color: "#fff", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
              </div>
            ) : (
              <button onClick={() => competitionLogoRef.current?.click()} title="Afegir logo" style={{ width: 22, height: 22, borderRadius: 4, border: "1px dashed rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 99 }}>{plan.competition}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {new Date(plan.startDate + "T12:00:00").toLocaleDateString("ca-ES", { day: "numeric", month: "short" })} – {new Date((plan.endDate || plan.startDate) + "T12:00:00").toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" })} · {days.length} dies
        </span>
      </div>
      {/* Tab bar */}
      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-color)", display: "flex", paddingLeft: 20, flexShrink: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            draggable
            onDragStart={(e) => handleTabDragStart(e, t.id)}
            onDragOver={(e) => handleTabDragOver(e, t.id)}
            onDragEnd={handleTabDragEnd}
            onClick={() => setTab(t.id)}
            style={{ padding: "11px 18px", background: dragTabId === t.id ? "var(--bg-hover)" : "none", border: "none", cursor: "grab", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)", borderBottom: tab === t.id ? "2px solid var(--accent-primary)" : "2px solid transparent", userSelect: "none", opacity: dragTabId === t.id ? 0.5 : 1 }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Day sidebar — only host tab */}
        {tab === "host" && (
          <div style={{ width: 190, flexShrink: 0, borderRight: "1px solid var(--border-color)", overflowY: "auto", background: "var(--bg-surface)" }}>
            <div style={{ padding: "12px 14px 6px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Dies del torneig</div>
            {days.map((d, i) => {
              const dateObj = new Date(d + "T12:00:00");
              const active = selectedDay === d;
              const has = (hostRows[d]?.length ?? 0) > 0;
              return (
                <button key={d} onClick={() => setSelectedDay(d)} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: active ? "var(--bg-hover)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderLeft: active ? "3px solid var(--accent-primary)" : "3px solid transparent" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent-primary)" : "var(--text-primary)" }}>Dia {i + 1}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dateObj.toLocaleDateString("ca-ES", { weekday: "short", day: "numeric", month: "short" })}</div>
                  </div>
                  {has && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {/* HOST SCRIPT */}
          {tab === "host" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Guió del host · Dia {days.indexOf(selectedDay) + 1}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{new Date(selectedDay + "T12:00:00").toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => addHostBloc(selectedDay)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "#7C3AED18", color: "#7C3AED", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Bloc</button>
                  <button onClick={() => addHostRow(selectedDay)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Segment</button>
                </div>
              </div>
              {(hostRows[selectedDay]?.length ?? 0) === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, display: "block", margin: "0 auto 12px" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <p style={{ margin: "0 0 16px", fontSize: 14 }}>Cap entrada encara. Afegeix un bloc o segment.</p>
                </div>
              ) : (
                <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 130px 32px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-color)" }}>
                    {["HORA", "GUIÓ", "HOST", ""].map((h) => (
                      <div key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {(hostRows[selectedDay] || []).map((row, ri) => {
                    if (row.type === "bloc") {
                      return (
                        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 32px", background: "#7C3AED", borderBottom: "1px solid rgba(124,58,237,0.4)" }}>
                          <input value={row.label || ""} onChange={(e) => updateHostRow(selectedDay, row.id, { label: e.target.value })}
                            style={{ background: "transparent", border: "none", color: "#fff", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px", outline: "none", width: "100%" }} />
                          <button onClick={() => deleteHostRow(selectedDay, row.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      );
                    }
                    const bg = ri % 2 === 0 ? "var(--bg-card)" : "var(--bg-surface)";
                    return (
                      <div key={row.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 130px 32px", background: bg, borderBottom: "1px solid var(--border-color)", alignItems: "stretch" }}>
                        <input value={row.time || ""} onChange={(e) => updateHostRow(selectedDay, row.id, { time: e.target.value })} placeholder="09:00h"
                          style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, padding: "10px 12px", outline: "none", borderRight: "1px solid var(--border-color)" }} />
                        <textarea value={row.script || ""} onChange={(e) => updateHostRow(selectedDay, row.id, { script: e.target.value })} placeholder="Contingut del guió..."
                          style={{ background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 13, padding: "10px 12px", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6, minHeight: 64, borderRight: "1px solid var(--border-color)" }} />
                        <input value={row.host || ""} onChange={(e) => updateHostRow(selectedDay, row.id, { host: e.target.value })} placeholder="Nom host"
                          style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, padding: "10px 12px", outline: "none", borderRight: "1px solid var(--border-color)" }} />
                        <button onClick={() => deleteHostRow(selectedDay, row.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* COMPTES IMPORTANTS */}
          {tab === "accounts" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
                <div><h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Comptes importants</h3><p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Comptes clau per mencionar, seguir i col·laborar durant el torneig.</p></div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setAddingCat(true)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Categoria</button>
                  <button onClick={() => setAddingAccount(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Compte</button>
                </div>
              </div>
              {/* Cat filters */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {[{ id: "all", label: "Tots", color: "var(--accent-primary)" }, ...allCats].map((c) => (
                  <button key={c.id} onClick={() => setCatFilter(c.id)} style={{ padding: "4px 12px", borderRadius: 99, border: `1.5px solid ${catFilter === c.id ? c.color : "var(--border-color)"}`, background: catFilter === c.id ? c.color + "18" : "transparent", color: catFilter === c.id ? c.color : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c.label}</button>
                ))}
              </div>
              {addingCat && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", gap: 10 }}>
                  <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Nom de la categoria..." style={iStyle} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && newCatLabel.trim()) { const palette = ["#059669","#EA580C","#EC4899","#6366F1","#14B8A6"]; saveExtraCats([...extraCats, { id: `c_${Date.now()}`, label: newCatLabel.trim(), color: palette[extraCats.length % palette.length] }]); setNewCatLabel(""); setAddingCat(false); } }} />
                  <button onClick={() => { if (!newCatLabel.trim()) return; const palette = ["#059669","#EA580C","#EC4899","#6366F1","#14B8A6"]; saveExtraCats([...extraCats, { id: `c_${Date.now()}`, label: newCatLabel.trim(), color: palette[extraCats.length % palette.length] }]); setNewCatLabel(""); setAddingCat(false); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Afegir</button>
                  <button onClick={() => setAddingCat(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancel·lar</button>
                </div>
              )}
              {addingAccount && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {([["name","Nom","FC Barcelona"],["handle","@Handle","@fcbarcelona"],["platform","Plataforma","Instagram, X, TikTok..."],] as [string,string,string][]).map(([k,l,p]) => (
                      <div key={k}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div><input value={(newAcc as Record<string,string>)[k] || ""} onChange={(e) => setNewAcc({ ...newAcc, [k]: e.target.value })} placeholder={p} style={iStyle} /></div>
                    ))}
                    <div><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Categoria</div>
                      <select value={newAcc.category || "clubs"} onChange={(e) => setNewAcc({ ...newAcc, category: e.target.value })} style={{ ...iStyle, cursor: "pointer" }}>
                        {allCats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</div><input value={newAcc.notes || ""} onChange={(e) => setNewAcc({ ...newAcc, notes: e.target.value })} placeholder="Notes opcionals..." style={iStyle} /></div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setAddingAccount(false); setNewAcc({ category: "clubs" }); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancel·lar</button>
                    <button onClick={() => { if (!newAcc.name?.trim()) return; saveAccounts([...accounts, { id: Date.now().toString(), name: newAcc.name.trim(), handle: newAcc.handle || "", platform: newAcc.platform || "", category: newAcc.category || "clubs", notes: newAcc.notes || "" }]); setNewAcc({ category: "clubs" }); setAddingAccount(false); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Afegir compte</button>
                  </div>
                </div>
              )}
              {/* Influencers — special table view */}
              {(catFilter === "influencers" || catFilter === "all") && (influencers.length > 0 || addingInfluencer) && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C3AED" }}>Influencers</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-input)", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>{influencers.length}</span>
                    <button onClick={() => setAddingInfluencer(true)} style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: "1px solid #7C3AED44", background: "#7C3AED10", color: "#7C3AED", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Afegir</button>
                  </div>
                  {addingInfluencer && (
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {([["name","Nom","Marc Bernal"],["followers","Seguidors","3,1M"],["mobile","Mòbil","+34 600 000 000"],["email","Correu","marc@exemple.com"],["actions","Accions XXSS","Reels, Stories..."]] as [string,string,string][]).map(([k,l,p]) => (
                          <div key={k}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div><input value={(newInf as Record<string,string>)[k] || ""} onChange={(e) => setNewInf({ ...newInf, [k]: e.target.value })} placeholder={p} style={iStyle} /></div>
                        ))}
                        <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Convidat</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {[true, false].map((v) => (
                              <button key={String(v)} onClick={() => setNewInf({ ...newInf, invited: v })} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1.5px solid ${newInf.invited === v ? (v ? "#059669" : "#DC2626") : "var(--border-color)"}`, background: newInf.invited === v ? (v ? "#D1FAE5" : "#FEE2E2") : "transparent", color: newInf.invited === v ? (v ? "#059669" : "#DC2626") : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v ? "SÍ" : "NO"}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => { setAddingInfluencer(false); setNewInf({ invited: false }); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel·lar</button>
                        <button onClick={() => { if (!newInf.name?.trim()) return; saveInfluencers([...influencers, { id: Date.now().toString(), name: newInf.name.trim(), followers: newInf.followers || "", mobile: newInf.mobile || "", invited: !!newInf.invited, actions: newInf.actions || "", email: newInf.email || "" }]); setNewInf({ invited: false }); setAddingInfluencer(false); }} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#7C3AED", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Afegir</button>
                      </div>
                    </div>
                  )}
                  {influencers.length > 0 && (
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 72px 1fr 130px 28px", background: "#7C3AED", padding: "8px 12px" }}>
                        {["NOM","SEGUIDORS","MÒBIL","CONVIDAT","ACCIONS XXSS","CORREU",""].map((h) => (
                          <div key={h} style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                        ))}
                      </div>
                      {influencers.map((inf, ri) => (
                        <div key={inf.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 72px 1fr 130px 28px", background: ri % 2 === 0 ? "var(--bg-card)" : "var(--bg-surface)", borderTop: "1px solid var(--border-color)", alignItems: "center" }}>
                          <input value={inf.name} onChange={(e) => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, name: e.target.value } : x))} style={{ background: "transparent", border: "none", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", padding: "9px 12px", outline: "none" }} />
                          <input value={inf.followers} onChange={(e) => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, followers: e.target.value } : x))} placeholder="—" style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-secondary)", padding: "9px 8px", outline: "none" }} />
                          <input value={inf.mobile} onChange={(e) => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, mobile: e.target.value } : x))} placeholder="—" style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-secondary)", padding: "9px 8px", outline: "none" }} />
                          <button onClick={() => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, invited: !x.invited } : x))} style={{ margin: "0 8px", padding: "3px 6px", borderRadius: 6, border: `1.5px solid ${inf.invited ? "#059669" : "#DC2626"}`, background: inf.invited ? "#D1FAE5" : "#FEE2E2", color: inf.invited ? "#059669" : "#DC2626", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>{inf.invited ? "SÍ" : "NO"}</button>
                          <input value={inf.actions} onChange={(e) => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, actions: e.target.value } : x))} placeholder="—" style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-secondary)", padding: "9px 8px", outline: "none" }} />
                          <input value={inf.email} onChange={(e) => saveInfluencers(influencers.map((x) => x.id === inf.id ? { ...x, email: e.target.value } : x))} placeholder="—" style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-secondary)", padding: "9px 8px", outline: "none" }} />
                          <button onClick={() => saveInfluencers(influencers.filter((x) => x.id !== inf.id))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Influencer quick-add button when filter is influencers and no entries yet */}
              {catFilter === "influencers" && influencers.length === 0 && !addingInfluencer && (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" style={{ opacity: 0.5, display: "block", margin: "0 auto 12px" }}><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M15 8h6"/><path d="M18 5v6"/></svg>
                  <p style={{ margin: "0 0 14px", fontSize: 14 }}>Afegeix influencers convidats o contactats</p>
                  <button onClick={() => setAddingInfluencer(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Afegir influencer</button>
                </div>
              )}
              {/* Other categories */}
              {allCats.filter((c) => c.id !== "influencers").map((cat) => {
                const catAccs = accounts.filter((a) => a.category === cat.id && (catFilter === "all" || catFilter === cat.id));
                if (!catAccs.length) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: cat.color }}>{cat.label}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-input)", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>{catAccs.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {catAccs.map((acc) => (
                        <div key={acc.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: cat.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{acc.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                              {acc.handle && <span style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600 }}>{acc.handle}</span>}
                              {acc.platform && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-input)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{acc.platform}</span>}
                              {acc.notes && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{acc.notes}</span>}
                            </div>
                          </div>
                          <button onClick={() => saveAccounts(accounts.filter((a) => a.id !== acc.id))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)", background: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {accounts.filter((a) => catFilter === "all" || a.category === catFilter).length === 0 && influencers.length === 0 && !addingAccount && catFilter !== "influencers" && (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, display: "block", margin: "0 auto 12px" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <p style={{ margin: 0, fontSize: 14 }}>Afegeix comptes clau de la competició</p>
                </div>
              )}
            </div>
          )}
          {/* EQUIP */}
          {tab === "team" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
                <div><h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Equip de comunicació</h3><p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Personal de premsa, comunicació i continguts del torneig.</p></div>
                <button onClick={() => setAddingPerson(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+ Persona</button>
              </div>
              {addingPerson && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {([["name","Nom","Maria"],["surname","Cognoms","García López"],["role","Càrrec","Cap de premsa"],["mobile","Mòbil","+34 600 000 000"]] as [string,string,string][]).map(([k,l,p]) => (
                      <div key={k}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div><input value={(newPerson as Record<string,string>)[k] || ""} onChange={(e) => setNewPerson({ ...newPerson, [k]: e.target.value })} placeholder={p} style={iStyle} /></div>
                    ))}
                  </div>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Correu electrònic</div><input type="email" value={newPerson.email || ""} onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })} placeholder="maria@exemple.com" style={iStyle} /></div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setAddingPerson(false); setNewPerson({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancel·lar</button>
                    <button onClick={() => { if (!newPerson.name?.trim()) return; saveTeam([...team, { id: Date.now().toString(), name: newPerson.name.trim(), surname: newPerson.surname || "", role: newPerson.role || "", mobile: newPerson.mobile || "", email: newPerson.email || "" }]); setNewPerson({}); setAddingPerson(false); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Afegir persona</button>
                  </div>
                </div>
              )}
              {team.length === 0 && !addingPerson ? (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, display: "block", margin: "0 auto 12px" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <p style={{ margin: 0, fontSize: 14 }}>Afegeix els membres de l'equip de comunicació</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                  {team.map((p) => (
                    <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 800, color: "var(--accent-primary)" }}>
                        {(p.name[0] || "").toUpperCase()}{(p.surname?.[0] || "").toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.name} {p.surname}</div>
                        {p.role && <div style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600, marginTop: 1 }}>{p.role}</div>}
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                          {p.mobile && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>{p.mobile}</div>}
                          {p.email && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>{p.email}</div>}
                        </div>
                      </div>
                      <button onClick={() => saveTeam(team.filter((x) => x.id !== p.id))} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-start" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* GUIA D'ESTIL */}
          {tab === "style" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
                <div><h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Guia d'estil de xarxes socials</h3><p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Directrius visuals, de to i de contingut per a tot l'equip.</p></div>
                <button onClick={() => setAddingCF(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>+ Camp personalitzat</button>
              </div>
              {addingCF && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 10 }}>
                  <input value={newCFLabel} onChange={(e) => setNewCFLabel(e.target.value)} placeholder="Nom del camp..." style={iStyle} autoFocus />
                  <button onClick={() => { if (!newCFLabel.trim()) return; saveCustomFields([...customFields, { key: `cf_${Date.now()}`, label: newCFLabel.trim() }]); setNewCFLabel(""); setAddingCF(false); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Afegir</button>
                  <button onClick={() => setAddingCF(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancel·lar</button>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Colors */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-color)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Colors de marca</div>
                  <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    {STYLE_FIELDS_DEF.filter((f) => f.type === "color").map((f) => (
                      <div key={f.key}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="color" value={styleVals[f.key] || "#000000"} onChange={(e) => saveStyleVal(f.key, e.target.value)} style={{ width: 40, height: 36, borderRadius: 8, border: "1px solid var(--border-color)", cursor: "pointer", padding: 2, flexShrink: 0 }} />
                          <input value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} placeholder="#000000" style={{ ...iStyle, flex: 1 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Veu i tipografia */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-color)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Veu, to i tipografia</div>
                  <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    {STYLE_FIELDS_DEF.filter((f) => ["voice","primary_font","secondary_font"].includes(f.key)).map((f) => (
                      <div key={f.key}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                        {f.type === "select"
                          ? <select value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} style={{ ...iStyle, cursor: "pointer" }}><option value="">— Selecciona —</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                          : <input value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} placeholder={f.key === "primary_font" ? "Helvetica Neue" : "Georgia"} style={iStyle} />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Identitat social */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-color)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Identitat social i formats</div>
                  <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {STYLE_FIELDS_DEF.filter((f) => ["hashtags","handles","image_ratio","image_dimensions"].includes(f.key)).map((f) => (
                      <div key={f.key}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                        {f.type === "select"
                          ? <select value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} style={{ ...iStyle, cursor: "pointer" }}><option value="">— Selecciona —</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                          : <input value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} placeholder={f.key === "hashtags" ? "#LaLiga #UCL..." : f.key === "handles" ? "@LaLiga @UEFA..." : ""} style={iStyle} />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Copywriting */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-color)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Copywriting i directrius de contingut</div>
                  <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                    {STYLE_FIELDS_DEF.filter((f) => ["approved_terms","prohibited_terms","caption_template","emoji_policy","watermark"].includes(f.key)).map((f) => (
                      <div key={f.key}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                        {f.type === "textarea"
                          ? <textarea value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} placeholder={f.key === "caption_template" ? "Ex: 🏆 [Nom del contingut] · #hashtag · @menció" : ""} style={{ ...iStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
                          : <input value={styleVals[f.key] || ""} onChange={(e) => saveStyleVal(f.key, e.target.value)} style={iStyle} />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Custom fields */}
                {customFields.length > 0 && (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-color)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Camps personalitzats</div>
                    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      {customFields.map((cf) => (
                        <div key={cf.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cf.label}</div>
                            <textarea value={styleVals[cf.key] || ""} onChange={(e) => saveStyleVal(cf.key, e.target.value)} style={{ ...iStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
                          </div>
                          <button onClick={() => saveCustomFields(customFields.filter((x) => x.key !== cf.key))} style={{ marginTop: 20, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)", background: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* ORGANIGRAMA */}
          {tab === "organigrama" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Organigrama general</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Assignació de l'equip per dies, horaris, accions i camps/seus.</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setAddingOrgCamp(true)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Camp / Seu</button>
                  <button onClick={addOrgRow} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Fila</button>
                </div>
              </div>
              {addingOrgCamp && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", gap: 10 }}>
                  <input value={newOrgCampName} onChange={(e) => setNewOrgCampName(e.target.value)} placeholder="Nom del camp o seu (ex: Camp 1 - Taradell)" style={iStyle} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && newOrgCampName.trim()) { const colors = ["#1D4ED8","#059669","#D97706","#DC2626","#7C3AED","#0891B2"]; saveOrgCamps([...orgCamps, { id: `camp_${Date.now()}`, name: newOrgCampName.trim(), color: colors[orgCamps.length % colors.length] }]); setNewOrgCampName(""); setAddingOrgCamp(false); } }} />
                  <button onClick={() => { if (!newOrgCampName.trim()) return; const colors = ["#1D4ED8","#059669","#D97706","#DC2626","#7C3AED","#0891B2"]; saveOrgCamps([...orgCamps, { id: `camp_${Date.now()}`, name: newOrgCampName.trim(), color: colors[orgCamps.length % colors.length] }]); setNewOrgCampName(""); setAddingOrgCamp(false); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Afegir</button>
                  <button onClick={() => setAddingOrgCamp(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancel·lar</button>
                </div>
              )}
              {orgRows.length === 0 && orgCamps.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35, display: "block", margin: "0 auto 12px" }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                  <p style={{ margin: "0 0 16px", fontSize: 14 }}>Crea els camps/seus i afegeix files per construir l'organigrama.</p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={() => setAddingOrgCamp(true)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Camp / Seu</button>
                    <button onClick={addOrgRow} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Primera fila</button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: `${400 + orgCamps.length * 200}px` }}>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: `80px 110px 160px ${orgCamps.map(() => "1fr").join(" ")} 32px`, background: "#0D1421", borderRadius: "10px 10px 0 0" }}>
                      {["DIA","HORARI","ACCIÓ",...orgCamps.map((c) => c.name),""].map((h, hi) => (
                        <div key={hi} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 800, color: hi === 0 ? "#fff" : hi <= 2 ? "rgba(255,255,255,0.8)" : orgCamps[hi - 3]?.color ?? "#fff", textTransform: "uppercase", letterSpacing: "0.07em", borderRight: hi < orgCamps.length + 3 ? "1px solid rgba(255,255,255,0.08)" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                          {h}
                          {hi > 2 && hi <= orgCamps.length + 2 && (
                            <button onClick={() => { const newCamps = orgCamps.filter((_, i) => i !== hi - 3); saveOrgCamps(newCamps); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0, marginLeft: "auto", display: "flex", alignItems: "center" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Rows */}
                    {orgRows.map((row, ri) => {
                      const dateObj = days.includes(row.dia) ? new Date(row.dia + "T12:00:00") : null;
                      const dayIdx = days.indexOf(row.dia);
                      const rowBg = dayIdx % 2 === 0 ? "var(--bg-card)" : "#EEF2FF";
                      return (
                        <div key={row.id} style={{ display: "grid", gridTemplateColumns: `80px 110px 160px ${orgCamps.map(() => "1fr").join(" ")} 32px`, borderBottom: "1px solid var(--border-color)", background: rowBg }}>
                          {/* DIA */}
                          <div style={{ padding: "6px 10px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid var(--border-color)" }}>
                            <select value={row.dia} onChange={(e) => updateOrgRow(row.id, { dia: e.target.value })} style={{ background: "transparent", border: "none", fontSize: 11, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", outline: "none", padding: 0 }}>
                              {days.map((d, i) => <option key={d} value={d}>Dia {i + 1}</option>)}
                            </select>
                            {dateObj && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{dateObj.toLocaleDateString("ca-ES", { weekday: "short", day: "numeric", month: "short" })}</span>}
                          </div>
                          {/* HORARI */}
                          <input value={row.horari} onChange={(e) => updateOrgRow(row.id, { horari: e.target.value })} placeholder="09:00 - 11:00h"
                            style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, padding: "8px 10px", outline: "none", borderRight: "1px solid var(--border-color)" }} />
                          {/* ACCIÓ */}
                          <input value={row.accio} onChange={(e) => updateOrgRow(row.id, { accio: e.target.value })} placeholder="Partits, Dinar, Sorteig..."
                            style={{ background: "transparent", border: "none", fontSize: 12, color: "var(--text-primary)", fontWeight: 700, textTransform: "uppercase", padding: "8px 10px", outline: "none", borderRight: "1px solid var(--border-color)" }} />
                          {/* CAMP CELLS */}
                          {orgCamps.map((camp) => (
                            <textarea key={camp.id} value={row.camps[camp.id] || ""} onChange={(e) => updateOrgCell(row.id, camp.id, e.target.value)} placeholder="—"
                              style={{ background: "transparent", border: "none", fontSize: 11, color: "var(--text-secondary)", padding: "8px 10px", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 48, borderRight: "1px solid var(--border-color)" }} />
                          ))}
                          {/* DELETE */}
                          <button onClick={() => saveOrgRows(orgRows.filter((r) => r.id !== row.id))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      );
                    })}
                    {/* Add row footer */}
                    <div style={{ borderTop: "1px solid var(--border-color)" }}>
                      <button onClick={addOrgRow} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface)", border: "none", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer", textAlign: "left", borderRadius: "0 0 10px 10px" }}>+ Afegir fila</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PlansView({ plans, onCreatePlan, onPlanUpdated, onPlanDeleted, autoOpenPlanId, onAutoOpened, onOpenTournament }: PlansViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [listView, setListView] = useState(false);
  const [openPlan, setOpenPlan] = useState<ContentPlan | null>(null);
  const [openTournament, setOpenTournament] = useState<ContentPlan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [planLogos, setPlanLogos] = useState<Record<string, string>>(() => {
    try {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("plan_comp_logo_")) {
          const val = localStorage.getItem(key);
          if (val) result[key.replace("plan_comp_logo_", "")] = val;
        }
      }
      return result;
    } catch { return {}; }
  });

  function getPlanLogo(p: ContentPlan): string | null {
    // 1. Explicit per-plan logo
    if (planLogos[p.id]) return planLogos[p.id];
    // 2. opponentCrest from DB (already on plan object)
    const oc = (p as unknown as Record<string, unknown>).opponentCrest as string | null | undefined;
    if (oc) return oc;
    // 3. Global crest by opponent name
    if (p.opponent) { try { const v = localStorage.getItem(`team_crest_${p.opponent}`); if (v) return v; } catch {} }
    return null;
  }
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!uploadingLogoId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setPlanLogos((prev) => ({ ...prev, [uploadingLogoId]: url }));
      try { localStorage.setItem(`plan_comp_logo_${uploadingLogoId}`, url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removeCompetitionLogo(planId: string) {
    setPlanLogos((prev) => { const n = { ...prev }; delete n[planId]; return n; });
    try { localStorage.removeItem(`plan_comp_logo_${planId}`); } catch {}
  }

  useEffect(() => {
    if (autoOpenPlanId) {
      const plan = plans.find((p) => p.id === autoOpenPlanId);
      if (plan) {
        if (plan.type === "tournament" && onOpenTournament) { onOpenTournament(plan); }
        else if (plan.type === "tournament") { setOpenTournament(plan); }
        else { setOpenPlan(plan); }
        onAutoOpened?.();
      }
    }
  }, [autoOpenPlanId, plans, onAutoOpened]);

  const filtered = plans.filter((p) => !filterStatus || p.status === filterStatus);

  async function archivePlan(plan: ContentPlan) {
    setArchiving(plan.id);
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt: plan.archivedAt ? null : new Date().toISOString() }),
    });
    const updated = await res.json();
    onPlanUpdated(updated);
    setArchiving(null);
  }

  async function deletePlan(id: string) {
    setDeleting(id);
    await fetch(`/api/plans/${id}`, { method: "DELETE" });
    onPlanDeleted(id);
    setDeleting(null);
  }

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start + "T12:00:00");
    const e = new Date(end + "T12:00:00");
    const sStr = s.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const eStr = e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${sStr} – ${eStr}`;
  };

  const progressPct = (plan: ContentPlan) => {
    const stats = (plan as ContentPlan & { itemStats?: { readinessScore?: number } }).itemStats;
    return stats?.readinessScore ?? 0;
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 16px" }}>
      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-input)", borderRadius: 8, padding: 3, border: "1px solid var(--border-color)" }}>
          {["", "draft", "active", "completed", "archived"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: "5px 11px", borderRadius: 6, border: "none", background: filterStatus === s ? "var(--bg-primary)" : "transparent", color: filterStatus === s ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: filterStatus === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {s === "" ? "All" : PLAN_STATUS_META[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setListView(false)} style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid var(--border-color)`, background: !listView ? "var(--bg-hover)" : "transparent", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </button>
          <button onClick={() => setListView(true)} style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid var(--border-color)`, background: listView ? "var(--bg-hover)" : "transparent", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--bg-card)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>No plans yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Create your first content plan to start organising your publishing strategy.</p>
            <button onClick={onCreatePlan} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--color-charcoal)", color: "var(--selected-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Create your first plan →
            </button>
          </div>
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && !listView && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((plan) => {
            const meta = PLAN_TYPE_META[plan.type] ?? PLAN_TYPE_META.custom;
            const statusMeta = PLAN_STATUS_META[plan.status] ?? PLAN_STATUS_META.draft;
            const itemStats = (plan as ContentPlan & { itemStats?: { total: number; published: number; pendingApproval: number; inProduction: number; planned: number; ready: number; readinessScore: number } }).itemStats;
            const itemCount = itemStats?.total ?? (plan._count as { items?: number } | undefined)?.items ?? 0;
            const pct = progressPct(plan);
            return (
              <div
                key={plan.id}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "18px 18px 14px", cursor: "pointer", transition: "box-shadow 0.15s", position: "relative", borderTop: `3px solid ${meta.color}` }}
                onClick={() => plan.type === "tournament" ? (onOpenTournament ? onOpenTournament(plan) : setOpenTournament(plan)) : setOpenPlan(plan)}
              >
                {/* Type + status + actions row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ color: meta.color, display: "flex", alignItems: "center" }}>{meta.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{meta.label}</span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {confirmDeleteId === plan.id ? (
                      <>
                        <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>Eliminar?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); setConfirmDeleteId(null); }}
                          style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#DC2626", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          {deleting === plan.id ? "…" : "Sí"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: statusMeta.bg, color: statusMeta.text }}>{statusMeta.label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); archivePlan(plan); }}
                          title={plan.archivedAt ? "Desarxivar" : "Arxivar"}
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}
                        >
                          {archiving === plan.id ? <span style={{ fontSize: 10 }}>…</span> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(plan.id); }}
                          title="Eliminar pla"
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", flexShrink: 0 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Plan name */}
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3 }}>{plan.name}</h3>

                {/* Client / profile */}
                {plan.clientName && (
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Client:</span> {plan.clientName}
                  </p>
                )}

                {/* Objective */}
                {plan.mainObjective && (
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{plan.mainObjective}</p>
                )}

                {/* Competition + logo */}
                {plan.competition && (
                  <div style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      {getPlanLogo(plan) ? (
                        <>
                          <img src={getPlanLogo(plan)!} onClick={() => { setUploadingLogoId(plan.id); logoInputRef.current?.click(); }} style={{ width: 20, height: 20, objectFit: "contain", borderRadius: 3, cursor: "pointer" }} />
                          <button onClick={() => removeCompetitionLogo(plan.id)} style={{ position: "absolute", top: -5, right: -5, width: 13, height: 13, borderRadius: "50%", background: "#DC2626", border: "none", color: "#fff", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
                        </>
                      ) : (
                        <button onClick={() => { setUploadingLogoId(plan.id); logoInputRef.current?.click(); }} title="Afegir logo de competició" style={{ width: 20, height: 20, borderRadius: 3, border: "1px dashed var(--border-color)", background: "var(--bg-input)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{plan.competition}</span>
                  </div>
                )}

                {/* Date range */}
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {formatDateRange(plan.startDate, plan.endDate)}
                </p>

                {/* Stats + progress bar */}
                <div style={{ marginBottom: 10 }}>
                  {itemCount > 0 ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>READINESS</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: "var(--bg-input)", overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: meta.color, borderRadius: 999, transition: "width 0.3s" }} />
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{itemCount}</span> continguts
                        {(itemStats?.published ?? 0) > 0 && <> · <span style={{ color: "#059669", fontWeight: 600 }}>{itemStats!.published}</span> publicats</>}
                        {(itemStats?.ready ?? 0) > 0 && <> · <span style={{ color: "#2563EB", fontWeight: 600 }}>{itemStats!.ready}</span> llestos</>}
                        {(itemStats?.pendingApproval ?? 0) > 0 && <> · <span style={{ color: "#D97706", fontWeight: 600 }}>{itemStats!.pendingApproval}</span> pendents</>}
                        {(itemStats?.inProduction ?? 0) > 0 && <> · <span style={{ color: "#7C3AED", fontWeight: 600 }}>{itemStats!.inProduction}</span> en prod.</>}
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Sense continguts encara</p>
                  )}
                </div>

                {/* Platforms */}
                {Array.isArray(plan.platforms) && plan.platforms.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(plan.platforms as string[]).map((p) => (
                      <span key={p} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "var(--bg-input)", color: "var(--text-muted)" }}>{p.slice(0, 2).toUpperCase()}</span>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && listView && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 12, padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Plan</span><span>Type</span><span>Dates</span><span>Status</span><span>Items</span><span></span>
          </div>
          {filtered.map((plan) => {
            const meta = PLAN_TYPE_META[plan.type] ?? PLAN_TYPE_META.custom;
            const statusMeta = PLAN_STATUS_META[plan.status] ?? PLAN_STATUS_META.draft;
            const listItemStats = (plan as ContentPlan & { itemStats?: { total: number; published: number; readinessScore: number } }).itemStats;
            const listItemCount = listItemStats?.total ?? (plan._count as { items?: number } | undefined)?.items ?? 0;
            const listPct = (plan as ContentPlan & { itemStats?: { readinessScore?: number } }).itemStats?.readinessScore ?? 0;
            return (
              <div key={plan.id} onClick={() => plan.type === "tournament" ? (onOpenTournament ? onOpenTournament(plan) : setOpenTournament(plan)) : setOpenPlan(plan)}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer", alignItems: "center" }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{plan.name}</p>
                  {plan.clientName && <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{plan.clientName}</p>}
                </div>
                <span style={{ fontSize: 12, color: meta.color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>{meta.icon}{meta.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDateRange(plan.startDate, plan.endDate)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: statusMeta.bg, color: statusMeta.text, width: "fit-content" }}>{statusMeta.label}</span>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{listItemCount}</span>
                  {listItemCount > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}> · {listPct}%</span>}
                </div>
                <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId === plan.id ? (
                    <>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Eliminar?</span>
                      <button onClick={() => { deletePlan(plan.id); setConfirmDeleteId(null); }} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sí</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "none", cursor: "pointer", fontSize: 12 }}>No</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(plan.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "none", cursor: "pointer", fontSize: 12, color: "#EF4444" }}>Eliminar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan workspace drawer */}
      {openPlan && (
        <PlanWorkspace
          plan={openPlan}
          onClose={() => setOpenPlan(null)}
          onUpdated={(p) => { onPlanUpdated(p); setOpenPlan(p); }}
          onDeleted={(id) => { onPlanDeleted(id); setOpenPlan(null); }}
        />
      )}

      {/* Tournament workspace full-screen overlay */}
      {openTournament && (
        <TournamentWorkspace
          plan={openTournament}
          onClose={() => setOpenTournament(null)}
        />
      )}
    </div>
  );
}

// ── Plan Workspace Drawer ─────────────────────────────────────────────────────

function PlanWorkspace({ plan, onClose, onUpdated, onDeleted }: { plan: ContentPlan; onClose: () => void; onUpdated: (p: ContentPlan) => void; onDeleted?: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "calendar" | "workflow">("overview");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = PLAN_TYPE_META[plan.type] ?? PLAN_TYPE_META.custom;
  const statusMeta = PLAN_STATUS_META[plan.status] ?? PLAN_STATUS_META.draft;

  useEffect(() => {
    fetch(`/api/calendar?planId=${plan.id}&from=2000-01-01&to=2099-12-31`)
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoadingItems(false); })
      .catch(() => setLoadingItems(false));
  }, [plan.id]);

  const WORKFLOW_STATUSES = ["idea", "planned", "in_production", "ready", "approved", "scheduled", "published", "cancelled"] as const;
  const WORKFLOW_LABELS: Record<string, string> = { idea: "Idea", planned: "Draft", in_production: "In Production", ready: "Ready", approved: "Approved", scheduled: "Scheduled", published: "Published", cancelled: "Cancelled" };
  const WORKFLOW_COLORS: Record<string, string> = { idea: "#9CA3AF", planned: "#3B82F6", in_production: "#F59E0B", ready: "#8B5CF6", approved: "#10B981", scheduled: "#06B6D4", published: "#059669", cancelled: "#EF4444" };

  const itemsByStatus = WORKFLOW_STATUSES.reduce((acc, s) => {
    acc[s] = items.filter((i) => i.status === s || (s === "planned" && i.status === "planned"));
    return acc;
  }, {} as Record<string, CalendarItem[]>);

  async function markStatus(status: string) {
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated = await res.json();
    onUpdated(updated);
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />
      {/* Drawer */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(700px, 100vw)", background: "var(--bg-primary)", borderLeft: "1px solid var(--border-color)", zIndex: 201, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: meta.color }}>
              <span style={{ transform: "scale(1.6)", display: "flex" }}>{meta.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{meta.label}</p>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{plan.name}</h2>
              {plan.clientName && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{plan.clientName}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select value={plan.status} onChange={(e) => markStatus(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${statusMeta.bg}`, background: statusMeta.bg, color: statusMeta.text, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                {["draft", "active", "completed", "archived"].map((s) => (
                  <option key={s} value={s}>{PLAN_STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>
              {onDeleted && (
                confirmDelete ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Eliminar?</span>
                    <button onClick={async () => { await fetch(`/api/plans/${plan.id}`, { method: "DELETE" }); onDeleted(plan.id); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sí</button>
                    <button onClick={() => setConfirmDelete(false)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-color)", background: "none", cursor: "pointer", fontSize: 12 }}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }} title="Eliminar pla">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                )
              )}
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {(["overview", "calendar", "workflow"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "8px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)", borderBottom: activeTab === tab ? "2px solid var(--color-charcoal)" : "2px solid transparent", marginBottom: -1 }}>
                {tab === "overview" ? "Overview" : tab === "calendar" ? "Calendar" : "Workflow"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { label: "Total items", value: String(items.length) },
                  { label: "Published", value: String(items.filter((i) => i.status === "published").length) },
                  { label: "Pending", value: String(items.filter((i) => ["planned", "in_production"].includes(i.status)).length) },
                ].map((s) => (
                  <div key={s.label} style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Objective */}
              {plan.mainObjective && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Main Objective</p>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{plan.mainObjective}</p>
                </div>
              )}

              {/* Key details grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Date range", value: `${plan.startDate} → ${plan.endDate}` },
                  { label: "Timezone", value: plan.timezone },
                  plan.team && { label: "Team", value: plan.team },
                  plan.opponent && { label: "Opponent", value: plan.opponent },
                  plan.competition && { label: "Competition", value: plan.competition },
                  plan.venue && { label: "Venue", value: plan.venue },
                  plan.targetAudience && { label: "Target audience", value: plan.targetAudience },
                  plan.coverageIntensity && { label: "Coverage", value: plan.coverageIntensity },
                ].filter(Boolean).map((item) => item && (
                  <div key={item.label} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Platforms */}
              {Array.isArray(plan.platforms) && (plan.platforms as string[]).length > 0 && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Platforms</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(plan.platforms as string[]).map((p) => (
                      <span key={p} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--bg-input)", color: "var(--text-secondary)" }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content pillars */}
              {Array.isArray(plan.contentPillars) && (plan.contentPillars as string[]).length > 0 && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Content Pillars</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(plan.contentPillars as string[]).map((p) => (
                      <span key={p} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: meta.color + "18", color: meta.color }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {plan.notes && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{plan.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Calendar tab — simple list of items */}
          {activeTab === "calendar" && (
            <div>
              {loadingItems && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading items…</p>}
              {!loadingItems && items.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No content items in this plan yet.</p>
                </div>
              )}
              {!loadingItems && items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)).map((item) => {
                    const d = new Date(item.plannedDate + "T12:00:00");
                    const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                    const sc = { idea: "#9CA3AF", planned: "#3B82F6", in_production: "#F59E0B", ready: "#8B5CF6", published: "#059669" } as Record<string, string>;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                        <div style={{ width: 3, height: 32, borderRadius: 999, background: sc[item.status] ?? "#9CA3AF", flexShrink: 0 }} />
                        <div style={{ width: 64, flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{day}</p>
                          {item.plannedTime && <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{item.plannedTime.slice(0, 5)}</p>}
                        </div>
                        <p style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.title}</p>
                        {item.platforms.length > 0 && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>{item.platforms[0]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Workflow tab — Kanban columns */}
          {activeTab === "workflow" && (
            <div>
              {loadingItems && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>}
              {!loadingItems && (
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12 }}>
                  {WORKFLOW_STATUSES.map((status) => {
                    const color = WORKFLOW_COLORS[status];
                    const label = WORKFLOW_LABELS[status];
                    const cols = items.filter((i) => i.status === status || (status === "planned" && i.status === "planned"));
                    return (
                      <div key={status} style={{ minWidth: 180, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{cols.length}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {cols.map((item) => (
                            <div key={item.id} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border-color)", fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
                              {item.title}
                              {item.plannedDate && <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--text-muted)" }}>{item.plannedDate}</p>}
                            </div>
                          ))}
                          {cols.length === 0 && <div style={{ padding: "12px 12px", borderRadius: 8, border: "1px dashed var(--border-color)", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Empty</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Templates View ────────────────────────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  { type: "matchday", name: "Matchday Plan", description: "Cover every moment before, during and after a game. Auto-generates build-up, pre-match, live, post-match and next-day phases.", phases: 5, items: 20, best_for: "Football, basketball, rugby clubs" },
  { type: "tournament", name: "Tournament Plan", description: "Coordinate content across multiple days, venues and matches. Includes pre-tournament, daily coverage and post-tournament phases.", phases: 4, items: 40, best_for: "Federations, event organisers" },
  { type: "weekly", name: "Weekly Plan", description: "Build a repeatable seven-day editorial rhythm with match coverage, community content and evergreen posts.", phases: 7, items: 14, best_for: "Clubs, individual creators" },
  { type: "monthly", name: "Monthly Plan", description: "Turn your goals, key dates and content pillars into a complete editorial month with balance indicators.", phases: 4, items: 30, best_for: "Agencies, strategic teams" },
  { type: "campaign", name: "Campaign Plan", description: "Organise content around one measurable objective — ticket sales, product launches, sponsor activations.", phases: 9, items: 25, best_for: "Marketing teams, agencies" },
  { type: "season", name: "Season Plan", description: "Connect the complete sporting calendar. Contains child Matchday, Tournament, Monthly and Campaign plans.", phases: 6, items: 80, best_for: "Clubs, federations, leagues" },
  { type: "single_day", name: "Single Day Plan", description: "Organise one publishing, recording or event coverage day with time blocks and capacity management.", phases: 5, items: 10, best_for: "Event coverage, recording days" },
  { type: "custom", name: "Custom Plan", description: "Define your own phases, fields, workflows and content slots. Save as a personal or organisation template.", phases: 0, items: 0, best_for: "Advanced users" },
];

function TemplatesView({ onSelectTemplate }: { onSelectTemplate: (type: string) => void }) {
  const templates: Array<{
    type: string; name: string; catalan: string; best_for: string; description: string;
    color: string; phases: number; items: number;
    preview: React.ReactNode;
    features: string[];
  }> = [
    {
      type: "matchday", name: "Matchday Plan", catalan: "Dia de Partit",
      best_for: "Clubs de futbol, bàsquet, rugbi",
      description: "Cobreix cada moment abans, durant i després del partit. Genera fases de build-up, pre-partit, en directe, post-partit i dia següent.",
      color: "#1D4ED8", phases: 5, items: 20,
      features: ["Fases automàtiques", "Run of show", "Hub de col·laboració", "Cronòmetre de compte enrere"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {["D-7 Build-up", "Pre-Match", "En Directe", "Post-Match", "D+1 Recap"].map((ph, i) => (
            <div key={ph} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === 2 ? "#ef4444" : "#1D4ED8", flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: i === 2 ? "#1a1a1a" : "#555", fontWeight: i === 2 ? 800 : 500 }}>{ph}</div>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: i <= 2 ? "#1D4ED8" : "#e5e7eb" }} />
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "tournament", name: "Tournament Plan", catalan: "Torneig",
      best_for: "Federacions, organitzadors d'events",
      description: "Coordina contingut durant múltiples dies, recintes i partits. Inclou fases pre-torneig, cobertura diària i post-torneig.",
      color: "#7C3AED", phases: 4, items: 40,
      features: ["Multi-jornada", "Bracket visual", "Cobertura per recinte", "Fitxes de fase"],
      preview: (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, padding: "4px 0" }}>
          {[["QF1","QF2"],["SF"],["F"]].map((round, ri) => (
            <div key={ri} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {ri > 0 && <div style={{ width: 10, height: 1, background: "#7C3AED" }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {round.map((m) => (
                  <div key={m} style={{ background: "#7C3AED" + (ri === 2 ? "ff" : "33"), color: ri === 2 ? "#fff" : "#7C3AED", borderRadius: 4, padding: "3px 7px", fontSize: 9, fontWeight: 800, border: `1px solid #7C3AED${ri === 2 ? "ff" : "88"}` }}>{m}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "weekly", name: "Weekly Plan", catalan: "Setmanal",
      best_for: "Clubs, creadors individuals",
      description: "Construeix un ritme editorial de set dies repetible amb cobertura de partits, contingut de comunitat i posts evergreen.",
      color: "#059669", phases: 7, items: 14,
      features: ["7 pilars de contingut", "Ritme editorial fix", "Plantilla reutilitzable", "Equilibri de formats"],
      preview: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {["Dl","Dt","Dc","Dj","Dv","Ds","Dg"].map((d, i) => (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ fontSize: 8, color: "#6b7280", fontWeight: 700 }}>{d}</div>
              <div style={{ width: "100%", height: i === 5 || i === 6 ? 20 : 10, borderRadius: 2, background: i === 5 || i === 6 ? "#059669" : "#d1fae5" }} />
              {(i === 0 || i === 2 || i === 4) && <div style={{ width: "70%", height: 6, borderRadius: 2, background: "#6ee7b7" }} />}
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "monthly", name: "Monthly Plan", catalan: "Mensual",
      best_for: "Agències, equips estratègics",
      description: "Converteix els teus objectius, dates clau i pilars de contingut en un mes editorial complet amb indicadors d'equilibri.",
      color: "#D97706", phases: 4, items: 30,
      features: ["Vista mensual", "Pilars de contingut", "KPIs editorials", "Indicadors d'equilibri"],
      preview: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
          {Array.from({ length: 20 }, (_, i) => {
            const filled = [1,3,5,7,9,10,12,14,17,19].includes(i);
            const match = [6,13].includes(i);
            return <div key={i} style={{ height: 10, borderRadius: 2, background: match ? "#D97706" : filled ? "#fde68a" : "#f3f4f6" }} />;
          })}
        </div>
      ),
    },
    {
      type: "campaign", name: "Campaign Plan", catalan: "Campanya",
      best_for: "Equips de màrqueting, agències",
      description: "Organitza contingut al voltant d'un objectiu mesurable: venda d'entrades, llançaments de producte, activacions de patrocinadors.",
      color: "#DC2626", phases: 9, items: 25,
      features: ["Objectiu únic", "Embut de conversió", "Tracking de KPIs", "Phases d'activació"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "stretch" }}>
          {[
            { label: "Awareness", w: "100%", c: "#fee2e2" },
            { label: "Engagement", w: "75%", c: "#fca5a5" },
            { label: "Conversion", w: "50%", c: "#DC2626" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: row.w, height: 10, borderRadius: 2, background: row.c }} />
              <div style={{ fontSize: 9, color: "#6b7280", whiteSpace: "nowrap", fontWeight: 600 }}>{row.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "season", name: "Season Plan", catalan: "Temporada",
      best_for: "Clubs, federacions, lligues",
      description: "Connecta el calendari esportiu complet. Conté sub-plans de Matchday, Torneig, Mensual i Campanya.",
      color: "#0891B2", phases: 6, items: 80,
      features: ["Vista de temporada completa", "Sub-plans vinculats", "Timeline de competició", "80+ slots de contingut"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", gap: 1 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 1, background: [7,8,9,10,11,0,1,2].includes(i) ? "#0891B2" : "#e0f2fe" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
            {["Matchday","Torneig","Mensual"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: "#0891B2" }} />
                <span style={{ fontSize: 8, color: "#6b7280", fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      type: "single_day", name: "Single Day Plan", catalan: "Dia Únic",
      best_for: "Cobertura d'events, dies de gravació",
      description: "Organitza un dia de publicació, gravació o cobertura d'event amb blocs de temps i gestió de capacitat.",
      color: "#EA580C", phases: 5, items: 10,
      features: ["Blocs de temps", "Gestió de capacitat", "Slots de publicació", "Coordinació d'equip"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { time: "09:00", label: "Arribada i setup", fill: 0.6 },
            { time: "11:00", label: "Sessió de gravació", fill: 1 },
            { time: "14:00", label: "Edició i revisió", fill: 0.8 },
            { time: "17:00", label: "Publicació", fill: 0.4 },
          ].map((block) => (
            <div key={block.time} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700, width: 28, flexShrink: 0 }}>{block.time}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 2, background: "#ffedd5" }}>
                <div style={{ width: `${block.fill * 100}%`, height: "100%", borderRadius: 2, background: "#EA580C" }} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "custom", name: "Custom Plan", catalan: "Personalitzat",
      best_for: "Usuaris avançats",
      description: "Defineix les teves pròpies fases, camps, fluxos de treball i slots de contingut. Desa com a plantilla personal o d'organització.",
      color: "#4B5563", phases: 0, items: 0,
      features: ["Fases personalitzades", "Camps a mida", "Fluxos de treball propis", "Desa com a plantilla"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {["Fase 1", "Fase 2", "Fase 3"].map((ph) => (
            <div key={ph} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="#9ca3af" strokeWidth="1.5"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>
              </div>
              <div style={{ flex: 1, height: 8, borderRadius: 2, background: "#f3f4f6", border: "1px dashed #d1d5db" }} />
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "signing", name: "Fitxatge", catalan: "Fitxatge",
      best_for: "Clubs, agències de representació",
      description: "Gestiona l'anunci d'un nou fitxatge: teasers, roda de premsa, presentació oficial, contingut de benvinguda i integració a la narrativa del club.",
      color: "#0EA5E9", phases: 4, items: 12,
      features: ["Compte enrere de l'anunci", "Teaser pre-reveal", "Roda de premsa", "Contingut de benvinguda"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[{ label: "Teaser", c: "#BAE6FD" }, { label: "Anunci oficial", c: "#0EA5E9" }, { label: "Presentació", c: "#0284C7" }, { label: "Integració", c: "#075985" }].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c, flexShrink: 0 }} />
              <div style={{ fontSize: 9, color: "#374151", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "sponsorship", name: "Acció de patrocini", catalan: "Patrocini",
      best_for: "Equips de màrqueting, sponsors",
      description: "Planifica l'activació completa d'un patrocini: anunci, contingut de marca, activitats especials i informe de resultats.",
      color: "#D97706", phases: 3, items: 10,
      features: ["Brief de marca", "Activació multi-canal", "Contingut co-branded", "Report de KPIs"],
      preview: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 3, paddingBottom: 4 }}>
          {[40, 60, 90, 70, 50].map((h, i) => (
            <div key={i} style={{ flex: 1, height: h * 0.45, borderRadius: "3px 3px 0 0", background: i === 2 ? "#D97706" : `#D97706${i === 1 || i === 3 ? "88" : "33"}` }} />
          ))}
        </div>
      ),
    },
    {
      type: "media_day", name: "Media Day", catalan: "Media Day",
      best_for: "Clubs, agències, departaments de comunicació",
      description: "Coordina un dia sencer de sessions fotogràfiques, entrevistes, vídeos i contingut per a totes les plataformes.",
      color: "#EC4899", phases: 4, items: 16,
      features: ["Runbook per hora", "Llista d'entrevistats", "Checklist producció", "Distribució post-dia"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[{ time: "09:00", label: "Fotos individuals", fill: 1 }, { time: "11:30", label: "Entrevistes", fill: 0.8 }, { time: "14:00", label: "Vídeos de marca", fill: 0.9 }, { time: "17:00", label: "Publicació", fill: 0.5 }].map((b) => (
            <div key={b.time} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700, width: 28, flexShrink: 0 }}>{b.time}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 2, background: "#fce7f3" }}>
                <div style={{ width: `${b.fill * 100}%`, height: "100%", borderRadius: 2, background: "#EC4899" }} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "press_conference", name: "Roda de premsa", catalan: "Roda de premsa",
      best_for: "Departaments de comunicació, clubs",
      description: "Organitza la comunicació abans, durant i després d'una roda de premsa: preparació, cobertura en directe i distribució del contingut generat.",
      color: "#6366F1", phases: 3, items: 8,
      features: ["Dossier de premsa", "Cobertura en directe", "Quotes per xarxes", "Follow-up als media"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["Prep.", "Directe", "Post"].map((l, i) => (
              <div key={l} style={{ flex: 1, padding: "4px 0", borderRadius: 4, background: i === 1 ? "#6366F1" : "#E0E7FF", textAlign: "center" }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: i === 1 ? "#fff" : "#6366F1" }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 5, borderRadius: 2, background: "#E0E7FF" }}>
            <div style={{ width: "55%", height: "100%", borderRadius: 2, background: "#6366F1" }} />
          </div>
        </div>
      ),
    },
    {
      type: "kit_launch", name: "Presentació d'equipacions", catalan: "Equipacions",
      best_for: "Clubs, marques esportives",
      description: "Llança la nova equipació amb màxim impacte: teasers, reveal oficial, contingut de jugadors, i campanya de venda.",
      color: "#14B8A6", phases: 4, items: 14,
      features: ["Teaser pre-llançament", "Reveal oficial", "Contingut de jugadors", "Campanya de venda"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[{ label: "Teaser", w: "30%" }, { label: "Reveal", w: "100%" }, { label: "Jugadors", w: "70%" }, { label: "Venda", w: "85%" }].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: 9, width: 72, flexShrink: 0, color: "#374151", fontWeight: 600 }}>{s.label}</div>
              <div style={{ flex: 1, height: 6, borderRadius: 2, background: "#CCFBF1" }}>
                <div style={{ width: s.w, height: "100%", borderRadius: 2, background: "#14B8A6" }} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      type: "institutional", name: "Presentació institucional", catalan: "Pres. institucional",
      best_for: "Clubs, federacions, lligues",
      description: "Comunica un anunci institucional clau: nomenament de directiu, nou conveni, inauguració d'instal·lació o qualsevol missatge corporatiu rellevant.",
      color: "#64748B", phases: 3, items: 7,
      features: ["Comunicat oficial", "Cobertura fotogràfica", "Nota de premsa", "Publicació institucional"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch" }}>
          <div style={{ height: 16, borderRadius: 3, background: "#CBD5E1", display: "flex", alignItems: "center", paddingLeft: 6 }}><span style={{ fontSize: 8, fontWeight: 700, color: "#475569" }}>Comunicat oficial</span></div>
          <div style={{ display: "flex", gap: 3 }}>
            {["Nota", "Foto", "XARXES"].map((l, i) => (
              <div key={l} style={{ flex: 1, height: 10, borderRadius: 2, background: i === 2 ? "#64748B" : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: i === 2 ? "#fff" : "#64748B" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      type: "competition_draw", name: "Sorteig de competició", catalan: "Sorteig competició",
      best_for: "Federacions, organitzadors de lligues",
      description: "Cobreix el sorteig de grups o eliminatòries: preparació de contingut previ, cobertura en directe i reaccions post-sorteig.",
      color: "#A855F7", phases: 3, items: 9,
      features: ["Expectació pre-sorteig", "Cobertura en directe", "Infografies de grup", "Reaccions i anàlisi"],
      preview: (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3 }}>
          {[["A","B"],["C","D"]].map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {col.map((g) => (
                <div key={g} style={{ width: 26, height: 16, borderRadius: 3, background: "#F3E8FF", border: "1px solid #A855F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: "#A855F7" }}>G-{g}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ width: 1, height: 38, background: "#A855F7", opacity: 0.3, margin: "0 2px" }} />
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#A855F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: "#fff" }}>SF</span>
          </div>
        </div>
      ),
    },
    {
      type: "giveaway", name: "Sorteig / Concurs", catalan: "Sorteig / Concurs",
      best_for: "Community managers, equips digitals",
      description: "Planifica i executa un sorteig de merchandising, entrades o premis especials per maximitzar l'engagement i la difusió.",
      color: "#F43F5E", phases: 3, items: 8,
      features: ["Anunci del premi", "Mecànica de participació", "Seguiment d'engagement", "Anunci del guanyador"],
      preview: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 0" }}>
          <div style={{ fontSize: 16 }}>🎁</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["Anunci", "Participa", "Guanyador"].map((s, i) => (
              <div key={s} style={{ padding: "3px 6px", borderRadius: 4, background: i === 1 ? "#F43F5E" : "#FFE4E6", display: "flex", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: i === 1 ? "#fff" : "#F43F5E" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Plantilles de pla</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Tria una plantilla per crear el teu pla de contingut amb les estructures pre-definides de cada tipus.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {templates.map((tpl) => (
          <div key={tpl.type}
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border-color)",
              borderRadius: 16, overflow: "hidden",
              display: "flex", flexDirection: "column",
              transition: "box-shadow 0.15s",
            }}
          >
            {/* Colored top bar */}
            <div style={{ height: 4, background: tpl.color }} />

            {/* Card header */}
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: tpl.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: tpl.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{tpl.catalan}</div>
                  <div style={{ fontSize: 10, color: tpl.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tpl.best_for}</div>
                </div>
                {tpl.phases > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{tpl.phases} fases</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>~{tpl.items} slots</span>
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{tpl.description}</p>
            </div>

            {/* Preview area */}
            <div style={{ padding: "12px 18px", background: "var(--bg-input)", borderBottom: "1px solid var(--border-color)", minHeight: 64 }}>
              {tpl.preview}
            </div>

            {/* Features list */}
            <div style={{ padding: "10px 18px", display: "flex", flexWrap: "wrap", gap: 5, borderBottom: "1px solid var(--border-color)" }}>
              {tpl.features.map((f) => (
                <span key={f} style={{ fontSize: 10, fontWeight: 600, color: tpl.color, background: tpl.color + "12", padding: "2px 7px", borderRadius: 5 }}>{f}</span>
              ))}
            </div>

            {/* CTA */}
            <div style={{ padding: "12px 18px", marginTop: "auto" }}>
              <button
                onClick={() => onSelectTemplate(tpl.type)}
                style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: tpl.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
              >
                Usar aquesta plantilla
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageInner />
    </Suspense>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { MATCHDAY_PHASES, resolvePhase, toISO } from "@/lib/relative-time";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContentPlan {
  id: string;
  userId: string;
  name: string;
  type: string;
  sport: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
  team: string | null;
  opponent: string | null;
  competition: string | null;
  venue: string | null;
  homeAway: string | null;
  mainObjective: string | null;
  secondaryObjective: string | null;
  targetAudience: string | null;
  platforms: string[];
  contentPillars: string[];
  teamMembers: string[];
  sponsors: string[];
  kpis: string[];
  clientName: string | null;
  coverageIntensity: string | null;
  colorScheme: string | null;
  parentPlanId: string | null;
  ownerId: string | null;
  approverId: string | null;
  status: string;
  currentVersion: number;
  notes: string | null;
  archivedAt: string | null;
  collaborationEnabled?: boolean;
  guestOrgName?: string | null;
  guestOrgEmail?: string | null;
  inviteToken?: string | null;
  hubStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  phases?: PlanPhase[];
  _count?: { items: number };
}

export interface PlanPhase {
  id: string;
  planId: string;
  phaseKey: string | null;
  label: string;
  description: string | null;
  sortOrder: number;
  anchorType: string;
  startOffsetMinutes: number | null;
  endOffsetMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid var(--border-color)", background: "var(--bg-input)",
  color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
};

// ── Premium SVG icons ─────────────────────────────────────────────────────────

function IconMatchday() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="10" ry="10"/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconTournament() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v2a6 6 0 0 1-12 0V4z"/>
      <path d="M6 6c0 0-3 .5-3 3s3 3 3 3"/>
      <path d="M18 6c0 0 3 .5 3 3s-3 3-3 3"/>
      <path d="M12 12v4M8 20h8M10 16h4"/>
    </svg>
  );
}
function IconDaily() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <circle cx="12" cy="16" r="2"/>
    </svg>
  );
}
function IconWeekly() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2M15 18h2"/>
    </svg>
  );
}
function IconMonthly() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01M17 18h.01"/>
    </svg>
  );
}
function IconCampaign() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}
function IconCustom() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  );
}
function IconSport({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M4.93 4.93l14.14 14.14M4.93 19.07 19.07 4.93"/>
    </svg>
  );
}
function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconPlane() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.8 19.2L16 11l3.5-3.5A3 3 0 1 0 15 4L11 7.2 2.8 5.4l-2 2 7 3.3L6 13H4l-1 2 4 1 1 4 2-1v-2l2.3-1.8z"/>
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_TYPES = [
  { id: "matchday",   label: "Matchday",   description: "Event with pre/live/post phases", Icon: IconMatchday },
  { id: "tournament", label: "Tournament", description: "Competition or tournament day",   Icon: IconTournament },
  { id: "daily",      label: "Daily",      description: "Single day content plan",         Icon: IconDaily },
  { id: "weekly",     label: "Weekly",     description: "Full week editorial plan",        Icon: IconWeekly },
  { id: "monthly",    label: "Monthly",    description: "Monthly content calendar",        Icon: IconMonthly },
  { id: "campaign",   label: "Campaign",   description: "Multi-channel objective",         Icon: IconCampaign },
  { id: "custom",     label: "Custom",     description: "Flexible for any initiative",     Icon: IconCustom },
];

const OBJECTIVES_DEFAULT = [
  "Awareness", "Engagement", "Community growth", "Traffic", "Leads",
  "Sales", "Sponsorship visibility", "Event attendance", "Fan loyalty",
];
const PLATFORMS_DEFAULT = [
  "Instagram", "TikTok", "YouTube", "Twitter", "Facebook", "LinkedIn", "Pinterest",
];
const PILLARS_DEFAULT = [
  "Match & Game", "Behind the Scenes", "Player Stories", "Fan Content",
  "Sponsor Integration", "Community", "Educational", "Entertainment",
];
const SPORTS = [
  "Football", "Basketball", "Handball", "Hockey", "Tennis", "Rugby",
  "Volleyball", "Swimming", "Athletics", "Cycling", "Golf",
];
const SPORT_DURATIONS: Record<string, number> = {
  Football: 105, Basketball: 50, Handball: 70, Hockey: 75, Tennis: 120, Rugby: 90, Volleyball: 90,
};

// ── CreatableMultiSelect ──────────────────────────────────────────────────────

function CreatableMultiSelect({
  label,
  selected,
  options,
  onChange,
  placeholder = "Select or type to add…",
  singleSelect = false,
}: {
  label: string;
  selected: string[];
  options: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allOptions, setAllOptions] = useState(options);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = allOptions.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  const canCreate = query.trim() !== "" && !allOptions.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  function toggle(val: string) {
    if (singleSelect) {
      onChange(selected[0] === val ? [] : [val]);
      setOpen(false);
      setQuery("");
      return;
    }
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  }

  function create() {
    const val = query.trim();
    if (!val) return;
    setAllOptions((prev) => [...prev, val]);
    toggle(val);
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{
          minHeight: 38, padding: "4px 8px", borderRadius: 8, cursor: "text",
          border: `1px solid ${open ? "var(--color-charcoal)" : "var(--border-color)"}`,
          background: "var(--bg-input)", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
        }}
      >
        {selected.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px 2px 10px", borderRadius: 999, background: "var(--color-charcoal)", color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            {s}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selected.filter((x) => x !== s)); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.65)", padding: "0 2px", fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center" }}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); canCreate ? create() : (filtered[0] && toggle(filtered[0])); }
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
          }}
          placeholder={selected.length === 0 ? placeholder : ""}
          style={{ flex: 1, minWidth: 80, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", padding: "3px 4px" }}
        />
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border-color)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)", maxHeight: 200, overflowY: "auto",
        }}>
          {canCreate && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); create(); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-charcoal)", fontWeight: 700, borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-muted)" }}>No options found</div>
          )}
          {filtered.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button key={opt} type="button" onMouseDown={(e) => { e.preventDefault(); toggle(opt); }}
                style={{ width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: isSelected ? "var(--bg-hover)" : "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {opt}
                {isSelected && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-charcoal)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhaseAction {
  id: string;
  title: string;
  platform: string;
}

// ── Phase row ─────────────────────────────────────────────────────────────────

function phaseTimingLabel(startAt: string, endAt: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
      + " " + `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  return `${fmt(startAt)} → ${fmt(endAt)}`;
}

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "IG", TikTok: "TK", YouTube: "YT", Twitter: "X", Facebook: "FB", LinkedIn: "LI",
};

function PhaseRow({ phase, onToggle, onLabelChange, onAddAction, onRemoveAction }: {
  phase: typeof MATCHDAY_PHASES[0] & { enabled: boolean; customLabel: string; startsAt: string; endsAt: string; actions: PhaseAction[] };
  onToggle: () => void;
  onLabelChange: (v: string) => void;
  onAddAction: (a: PhaseAction) => void;
  onRemoveAction: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState("Instagram");
  const [showInput, setShowInput] = useState(false);

  function addAction(title: string) {
    if (!title.trim()) return;
    onAddAction({ id: Math.random().toString(36).slice(2), title: title.trim(), platform: newPlatform });
    setNewTitle("");
  }

  return (
    <div style={{
      border: `1px solid ${phase.enabled ? phase.color + "44" : "var(--border-color)"}`,
      borderRadius: 10, padding: "12px 14px",
      background: phase.enabled ? phase.color + "08" : "transparent", transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button type="button" onClick={onToggle}
          style={{ marginTop: 2, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `2px solid ${phase.enabled ? phase.color : "var(--border-color)"}`, background: phase.enabled ? phase.color : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {phase.enabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={phase.customLabel} onChange={(e) => onLabelChange(e.target.value)} onBlur={() => setEditing(false)} autoFocus
              style={{ ...inputStyle, padding: "4px 8px", fontSize: 13, fontWeight: 700 }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{phase.customLabel}</span>
              <button type="button" onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{phaseTimingLabel(phase.startsAt, phase.endsAt)}</div>

          {phase.enabled && (
            <>
              {/* Suggested content chips */}
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {phase.suggestedContent.map((s) => {
                  const already = phase.actions.some((a) => a.title === s);
                  return (
                    <button key={s} type="button" onClick={() => !already && addAction(s)}
                      style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, border: "none", cursor: already ? "default" : "pointer", background: already ? phase.color + "30" : phase.color + "15", color: phase.color, fontWeight: 600, opacity: already ? 0.5 : 1 }}>
                      {already ? "✓ " : "+ "}{s}
                    </button>
                  );
                })}
              </div>

              {/* Actions list */}
              {phase.actions.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {phase.actions.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 7, background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: phase.color + "20", color: phase.color, flexShrink: 0 }}>
                        {PLATFORM_ICONS[a.platform] ?? a.platform.slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{a.title}</span>
                      <button type="button" onClick={() => onRemoveAction(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add custom action */}
              {showInput ? (
                <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                  <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}
                    style={{ ...inputStyle, width: "auto", padding: "5px 6px", fontSize: 11, flexShrink: 0 }}>
                    {["Instagram", "TikTok", "YouTube", "Twitter", "Facebook", "LinkedIn"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { addAction(newTitle); setShowInput(false); } if (e.key === "Escape") { setShowInput(false); setNewTitle(""); } }}
                    placeholder="Descripció de l'acció…"
                    style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, flex: 1 }} />
                  <button type="button" onClick={() => { addAction(newTitle); setShowInput(false); }}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: phase.color, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowInput(true)}
                  style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: phase.color, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Afegir acció personalitzada
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMinutesToDate(date: string, hhmm: string, minutes: number): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d, h, m));
  const result = new Date(base.getTime() + minutes * 60000);
  return {
    date: result.toISOString().slice(0, 10),
    time: `${String(result.getUTCHours()).padStart(2, "0")}:${String(result.getUTCMinutes()).padStart(2, "0")}`,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PlanBuilderProps {
  defaultDate?: string;
  initialType?: string;
  onClose: () => void;
  onCreated: (plan: ContentPlan) => void;
}

export default function PlanBuilder({ defaultDate, initialType, onClose, onCreated }: PlanBuilderProps) {
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [planType, setPlanType] = useState(initialType || "");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [startDate, setStartDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [timezone] = useState("Europe/Madrid");
  const [objective, setObjective] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Matchday
  const [team, setTeam] = useState("");
  const [opponent, setOpponent] = useState("");
  const [opponentCrest, setOpponentCrest] = useState<string | null>(null);
  const [opponentCrestError, setOpponentCrestError] = useState("");
  const [competition, setCompetition] = useState("");
  const [homeAway, setHomeAway] = useState<"home" | "away">("home");
  const [venue, setVenue] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState("20:00");
  const [eventDuration, setEventDuration] = useState("90");

  const [phaseStates, setPhaseStates] = useState<
    (typeof MATCHDAY_PHASES[0] & { enabled: boolean; customLabel: string; startsAt: string; endsAt: string; actions: PhaseAction[] })[]
  >([]);
  const [phasesComputed, setPhasesComputed] = useState(false);

  // Host script
  const [hostScriptEnabled, setHostScriptEnabled] = useState(false);
  const [hostScript, setHostScript] = useState("");

  const isMatchday = planType === "matchday";
  const TOTAL_STEPS = isMatchday ? 4 : 3;

  function getEventISOPair() {
    if (!eventDate || !eventTime) return null;
    const startISO = toISO(eventDate, eventTime);
    const dur = parseInt(eventDuration) || (sport ? SPORT_DURATIONS[sport] : 90) || 90;
    const endResult = addMinutesToDate(eventDate, eventTime, dur);
    return { startISO, endISO: toISO(endResult.date, endResult.time) };
  }

  function handleOpponentCrestFile(file: File) {
    setOpponentCrestError("");
    if (!file.type.startsWith("image/")) {
      setOpponentCrestError("Ha de ser una imatge (JPG, PNG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setOpponentCrestError("Max 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setOpponentCrest(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function computePhases() {
    const pair = getEventISOPair();
    if (!pair) return;
    const computed = MATCHDAY_PHASES.map((ph) => ({
      ...ph, enabled: true, customLabel: ph.label, actions: [] as PhaseAction[],
      ...resolvePhase(ph, pair.startISO, pair.endISO),
    }));
    setPhaseStates(computed);
    setPhasesComputed(true);
  }

  function canProceedStep1() { return planType !== ""; }
  function canProceedStep2() {
    if (!name.trim() || !startDate || !endDate) return false;
    if (isMatchday && (!team.trim() || !opponent.trim() || !eventDate || !eventTime)) return false;
    return true;
  }

  async function handleCreate() {
    setSaving(true);
    setError("");
    try {
      const pair = isMatchday ? getEventISOPair() : null;
      const phases = isMatchday && phaseStates.length > 0
        ? phaseStates.filter((p) => p.enabled).map((p, i) => ({
            phaseKey: p.phaseKey, label: p.customLabel, description: p.description,
            sortOrder: i, anchorType: p.anchorType,
            startOffsetMinutes: p.startOffsetMinutes, endOffsetMinutes: p.endOffsetMinutes,
            startsAt: p.startsAt, endsAt: p.endsAt,
          }))
        : [];

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), type: planType, sport: sport || null,
          startDate: isMatchday ? eventDate : startDate,
          endDate: isMatchday ? eventDate : endDate,
          timezone,
          eventStartAt: pair?.startISO || null, eventEndAt: pair?.endISO || null,
          team: team || null, opponent: opponent || null,
          competition: competition || null, venue: venue || null,
          homeAway: isMatchday ? homeAway : null,
          mainObjective: objective[0] || null,
          targetAudience: targetAudience || null,
          platforms, contentPillars: pillars,
          notes: [notes, hostScriptEnabled && hostScript ? `GUIÓ HOST:\n${hostScript}` : ""].filter(Boolean).join("\n\n") || null,
          phases,
          opponentCrest: opponentCrest || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const plan = await res.json();

      // Create CalendarItems for phase actions
      if (isMatchday && phaseStates.length > 0) {
        const actionPromises = phaseStates.flatMap((phase) =>
          phase.enabled
            ? phase.actions.map((action) => {
                const d = new Date(phase.startsAt);
                const plannedDate = d.toISOString().slice(0, 10);
                const plannedTime = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
                return fetch("/api/calendar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: action.title,
                    plannedDate,
                    plannedTime,
                    platforms: [action.platform],
                    status: "idea",
                    planId: plan.id,
                  }),
                });
              })
            : []
        );
        await Promise.all(actionPromises);
      }

      onCreated(plan);
    } catch {
      setError("Could not create plan. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const reviewStep = (isMatchday && step === 4) || (!isMatchday && step === 3);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "var(--bg-primary)", borderRadius: 18, width: "100%", maxWidth: 600, maxHeight: "94dvh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border-color)", position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Create plan</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{ height: 3, borderRadius: 999, flex: 1, background: step > i ? "var(--color-charcoal)" : "var(--border-color)", transition: "background 0.2s" }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            Step {step} of {TOTAL_STEPS} —{" "}
            {step === 1 ? "Plan type" : step === 2 ? "Details" : isMatchday && step === 3 ? "Phases" : "Review"}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>What type of plan do you want to create?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {PLAN_TYPES.map((t) => {
                  const sel = planType === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setPlanType(t.id)}
                      style={{ padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left", border: `2px solid ${sel ? "var(--color-charcoal)" : "var(--border-color)"}`, background: sel ? "var(--color-charcoal-subtle)" : "var(--bg-input)", transition: "all 0.15s" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "var(--color-charcoal)" : "var(--bg-hover)", color: sel ? "#fff" : "var(--text-secondary)", transition: "all 0.15s" }}>
                        <t.Icon />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{t.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Plan name *</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={isMatchday ? "FC Barcelona vs Real Madrid — La Liga" : "August Content Plan"} autoFocus />
              </div>

              {isMatchday && (
                <>
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
                    <div style={sectionHeaderStyle}><IconSport /> Match details</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Our team *</label>
                        <input style={inputStyle} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="FC Barcelona" />
                      </div>
                      <div>
                        <label style={labelStyle}>Opponent *</label>
                        <input style={inputStyle} value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Real Madrid" />
                        {/* Opponent crest */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                          <label style={{ display: "block", cursor: "pointer", flexShrink: 0 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, border: "1.5px dashed var(--border-color)", background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              {opponentCrest
                                ? <img src={opponentCrest} alt="Rival crest" style={{ width: 44, height: 44, objectFit: "contain", padding: 3 }} />
                                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M12 2L3 7l2 13 7 2 7-2 2-13L12 2z"/></svg>
                              }
                            </div>
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOpponentCrestFile(f); e.target.value = ""; }} />
                          </label>
                          <div>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Escut del rival (opcional)</p>
                            {opponentCrest && <button type="button" onClick={() => setOpponentCrest(null)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>Eliminar</button>}
                            {opponentCrestError && <p style={{ fontSize: 11, color: "#ef4444", margin: "2px 0 0" }}>{opponentCrestError}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={labelStyle}>Competition</label>
                        <input style={inputStyle} value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="La Liga" />
                      </div>
                      <div>
                        <label style={labelStyle}>Venue</label>
                        <input style={inputStyle} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Camp Nou" />
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={labelStyle}>Home or Away</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["home", "away"] as const).map((ha) => (
                          <button key={ha} type="button" onClick={() => setHomeAway(ha)}
                            style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${homeAway === ha ? "var(--color-charcoal)" : "var(--border-color)"}`, background: homeAway === ha ? "var(--color-charcoal-subtle)" : "transparent", color: homeAway === ha ? "var(--color-charcoal)" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            {ha === "home" ? <IconHome /> : <IconPlane />}
                            {ha === "home" ? "Home" : "Away"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
                    <div style={sectionHeaderStyle}><IconClock /> Event timing</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Event date *</label>
                        <input type="date" style={inputStyle} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Start time *</label>
                        <input type="time" style={inputStyle} value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={labelStyle}>Sport</label>
                        <select style={inputStyle} value={sport} onChange={(e) => { setSport(e.target.value); setEventDuration(String(SPORT_DURATIONS[e.target.value] || 90)); }}>
                          <option value="">Select sport</option>
                          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Duration (min)</label>
                        <input type="number" style={inputStyle} value={eventDuration} onChange={(e) => setEventDuration(e.target.value)} min="10" max="300" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!isMatchday && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Start date *</label>
                      <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>End date *</label>
                      <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Sport</label>
                    <select style={inputStyle} value={sport} onChange={(e) => setSport(e.target.value)}>
                      <option value="">Select sport (optional)</option>
                      {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}

              <CreatableMultiSelect label="Main objective" selected={objective} options={OBJECTIVES_DEFAULT} onChange={setObjective} singleSelect placeholder="Select objective…" />
              <CreatableMultiSelect label="Platforms" selected={platforms} options={PLATFORMS_DEFAULT} onChange={setPlatforms} placeholder="Select platforms…" />
              <CreatableMultiSelect label="Content pillars" selected={pillars} options={PILLARS_DEFAULT} onChange={setPillars} placeholder="Select or add pillars…" />

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…" />
              </div>
            </div>
          )}

          {/* ── STEP 3: Phases (matchday) ── */}
          {step === 3 && isMatchday && (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--text-secondary)" }}>
                Phases calculated from your event timing. Toggle or rename as needed.
              </p>
              {getEventISOPair() && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, padding: "8px 12px", background: "var(--bg-input)", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <IconSport />
                  <strong>{team}</strong> vs <strong>{opponent}</strong> · {eventDate} {eventTime}
                </div>
              )}
              {!phasesComputed && (
                <button type="button" onClick={computePhases}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Calculate phase timings
                </button>
              )}
              {phasesComputed && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {phaseStates.map((phase, i) => (
                      <PhaseRow key={phase.phaseKey} phase={phase}
                        onToggle={() => setPhaseStates((prev) => prev.map((p, j) => j === i ? { ...p, enabled: !p.enabled } : p))}
                        onLabelChange={(v) => setPhaseStates((prev) => prev.map((p, j) => j === i ? { ...p, customLabel: v } : p))}
                        onAddAction={(a) => setPhaseStates((prev) => prev.map((p, j) => j === i ? { ...p, actions: [...p.actions, a] } : p))}
                        onRemoveAction={(id) => setPhaseStates((prev) => prev.map((p, j) => j === i ? { ...p, actions: p.actions.filter((a) => a.id !== id) } : p))}
                      />
                    ))}
                  </div>

                  {/* Host script section */}
                  <div style={{ marginTop: 16, borderRadius: 10, border: `1px solid ${hostScriptEnabled ? "#F59E0B44" : "var(--border-color)"}`, overflow: "hidden" }}>
                    <button type="button" onClick={() => setHostScriptEnabled((v) => !v)}
                      style={{ width: "100%", padding: "12px 14px", background: hostScriptEnabled ? "#F59E0B10" : "var(--bg-input)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${hostScriptEnabled ? "#F59E0B" : "var(--border-color)"}`, background: hostScriptEnabled ? "#F59E0B" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hostScriptEnabled && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Guió de host</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Escriu el guió per al host del dia de partit</div>
                      </div>
                      <svg style={{ marginLeft: "auto", transition: "transform 0.2s", transform: hostScriptEnabled ? "rotate(180deg)" : "rotate(0deg)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {hostScriptEnabled && (
                      <div style={{ padding: "0 14px 14px" }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>
                          {["Obertura", "Pre-partit", "Mig temps", "Post-partit"].map((section) => (
                            <button key={section} type="button"
                              onClick={() => setHostScript((prev) => prev + (prev ? "\n\n" : "") + `## ${section}\n`)}
                              style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-secondary)", cursor: "pointer" }}>
                              + {section}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={hostScript}
                          onChange={(e) => setHostScript(e.target.value)}
                          placeholder={"## Obertura\nBona tarda a tothom! Avui cobrim...\n\n## Pre-partit\n..."}
                          style={{ ...inputStyle, minHeight: 180, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
                          autoFocus
                        />
                        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                          {hostScript.length} caràcters · {hostScript.split(/\s+/).filter(Boolean).length} paraules
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── REVIEW ── */}
          {reviewStep && (
            <div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)" }}>Review your plan before creating it.</p>
              <div style={{ background: "var(--bg-input)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <Row label="Name" value={name} />
                <Row label="Type" value={PLAN_TYPES.find((t) => t.id === planType)?.label || planType} />
                {isMatchday && <Row label="Match" value={`${team} vs ${opponent}`} />}
                {isMatchday && <Row label="Event" value={`${eventDate} · ${eventTime}`} />}
                {!isMatchday && <Row label="Period" value={`${startDate} → ${endDate}`} />}
                {sport && <Row label="Sport" value={sport} />}
                {objective.length > 0 && <Row label="Objective" value={objective.join(", ")} />}
                {platforms.length > 0 && <Row label="Platforms" value={platforms.join(", ")} />}
                {pillars.length > 0 && <Row label="Pillars" value={pillars.join(", ")} />}
                {isMatchday && phaseStates.filter((p) => p.enabled).length > 0 && (
                  <Row label="Phases" value={phaseStates.filter((p) => p.enabled).map((p) => p.customLabel).join(", ")} />
                )}
              </div>
              {isMatchday && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 13, color: "#059669", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12"/></svg>
                  Calendar items will be created automatically for each content action across all phases.
                </div>
              )}
              {error && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#FEE2E2", color: "#DC2626", fontSize: 13 }}>{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", gap: 8, position: "sticky", bottom: 0, background: "var(--bg-primary)" }}>
          <button type="button" onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {!reviewStep ? (
            <button type="button"
              disabled={step === 1 ? !canProceedStep1() : step === 2 ? !canProceedStep2() : false}
              onClick={() => {
                if (step === 1) setStep(2);
                else if (step === 2) { if (isMatchday) { computePhases(); setStep(3); } else setStep(3); }
                else setStep(4);
              }}
              style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (step === 1 ? !canProceedStep1() : step === 2 ? !canProceedStep2() : false) ? 0.4 : 1 }}>
              Continue →
            </button>
          ) : (
            <button type="button" onClick={handleCreate} disabled={saving}
              style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Creating…" : "Create plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)", fontWeight: 600, minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

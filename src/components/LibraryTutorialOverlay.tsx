"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { tutorialTranslations, type TutorialT } from "@/lib/tutorial-i18n";

const STORAGE_KEY = "scp-library-tutorial-done";
const C = "#2563eb";

interface StepDef {
  icon: React.ReactNode;
  selector: string | null;
  padding?: number;
  scrollDown?: boolean;
  social?: boolean;
}

const STEP_DEFS: StepDef[] = [
  {
    selector: '[data-tutorial="filter-sidebar"]',
    padding: 12,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-search"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-classification"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-date"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-sport"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10"/>
        <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24M14.83 9.17l4.24-4.24"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-published"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-account"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-format"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="20" height="20" rx="2"/>
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="platform-filter"]',
    padding: 12,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="card-save-area"]',
    padding: 8,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="feed-content"]',
    padding: 12,
    scrollDown: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="7 10 12 15 17 10"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-collabs"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 11l-4-4-4 4M19 7v8"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-merchandising"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="filter-transfers"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 16V4m0 0L3 8m4-4 4 4"/>
        <path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
      </svg>
    ),
  },
  {
    selector: null,
    social: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
];

const SOCIAL_NETWORKS = [
  {
    id: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/sportscontentplaybook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/sportscontentplaybook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@sportscontentplaybook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z"/>
      </svg>
    ),
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string, padding = 8): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - padding, left: r.left - padding, width: r.width + padding * 2, height: r.height + padding * 2 };
}

function usePanelPos(spotRect: Rect | null) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const panelWidth = isMobile ? vw - 32 : isTablet ? 260 : 300;

  let posStyle: React.CSSProperties;

  if (isMobile) {
    posStyle = { bottom: 24, left: 16, right: 16, width: "auto" };
  } else if (isTablet) {
    posStyle = { bottom: 24, left: "50%", transform: "translateX(-50%)", width: panelWidth };
  } else {
    const panelPad = 16;
    let top = vh / 2 - 180;
    let left = vw / 2 - panelWidth / 2;

    if (spotRect) {
      const spRight = spotRect.left + spotRect.width;
      const spBottom = spotRect.top + spotRect.height;

      if (spRight + panelWidth + panelPad + 24 < vw) {
        left = spRight + panelPad + 8;
        top = Math.max(16, Math.min(spotRect.top, vh - 400));
      } else if (spotRect.left - panelWidth - panelPad - 8 > 0) {
        left = spotRect.left - panelWidth - panelPad - 8;
        top = Math.max(16, Math.min(spotRect.top, vh - 400));
      } else if (spBottom + panelPad + 16 < vh) {
        top = spBottom + panelPad + 8;
        left = Math.max(16, Math.min(spotRect.left, vw - panelWidth - 16));
      } else {
        top = Math.max(16, spotRect.top - 400 - panelPad - 8);
        left = Math.max(16, Math.min(spotRect.left, vw - panelWidth - 16));
      }
    }

    posStyle = { top, left, width: panelWidth };
  }

  return { posStyle, isMobile, isTablet, panelWidth };
}

function PrevButton({ onPrev, label }: { onPrev: () => void; label: string }) {
  return (
    <button
      onClick={onPrev}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; }}
      style={{
        padding: "9px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800,
        background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function SocialPanel({ icon, title, description, onFinish, onPrev, total, t }: {
  icon: React.ReactNode; title: string; description: string;
  onFinish: () => void; onPrev: () => void; total: number; t: TutorialT;
}) {
  const { posStyle, isMobile } = usePanelPos(null);
  const iconSize = isMobile ? 36 : 44;
  const padding = isMobile ? "12px 16px 14px" : "16px 20px 16px";

  return (
    <div style={{
      position: "fixed", zIndex: 3010,
      background: "#111827", borderRadius: 20,
      border: `1px solid ${C}40`,
      boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${C}20`,
      overflow: "hidden",
      maxHeight: isMobile ? "70vh" : "none",
      overflowY: isMobile ? "auto" : "visible",
      ...posStyle,
    }}>
      <div style={{ padding: "10px 16px 0" }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C, background: `${C}18`, padding: "3px 8px", borderRadius: 99,
        }}>
          {t.libraryBadge}
        </span>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${C}, ${C}80)`, marginTop: 10 }} />

      <div style={{ padding }}>
        <div style={{ display: "flex", gap: 4, marginBottom: isMobile ? 10 : 14 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: C }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isMobile ? 8 : 12 }}>
          <div style={{
            width: iconSize, height: iconSize, borderRadius: 12, flexShrink: 0,
            background: `${C}20`, color: C,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {icon}
          </div>
          <div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              {t.stepLabel(total, total)}
            </p>
            <h3 style={{ color: "#fff", fontWeight: 900, fontSize: isMobile ? 14 : 15, lineHeight: 1.2 }}>{title}</h3>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: isMobile ? 11 : 12, lineHeight: 1.6, marginBottom: isMobile ? 10 : 14 }}>
          {description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: isMobile ? 10 : 14 }}>
          {SOCIAL_NETWORKS.map((net) => (
            <a key={net.id} href={net.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none", fontWeight: 700, fontSize: 12,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.6)", display: "flex" }}>{net.icon}</span>
              <span style={{ flex: 1 }}>{net.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 99,
                background: `${C}25`, color: C,
              }}>
                {t.follow}
              </span>
            </a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <PrevButton onPrev={onPrev} label={t.prev} />
          <button onClick={onFinish} style={{
            flex: 1, padding: "9px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: C, color: "#fff", border: "none", cursor: "pointer",
          }}>
            {t.exploreLibrary}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ stepIdx, total, icon, title, description, spotRect, onNext, onPrev, t }: {
  stepIdx: number; total: number; icon: React.ReactNode;
  title: string; description: string; spotRect: Rect | null;
  onNext: () => void; onPrev: () => void; t: TutorialT;
}) {
  const { posStyle, isMobile } = usePanelPos(spotRect);
  const iconSize = isMobile ? 36 : 44;
  const padding = isMobile ? "12px 16px 14px" : "16px 20px 16px";
  const isLast = stepIdx === total - 1;

  return (
    <div style={{
      position: "fixed", zIndex: 3010,
      background: "#111827", borderRadius: 20,
      border: `1px solid ${C}40`,
      boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${C}20`,
      overflow: "hidden",
      transition: "top 0.4s cubic-bezier(0.4,0,0.2,1), left 0.4s cubic-bezier(0.4,0,0.2,1)",
      maxHeight: isMobile ? "55vh" : "none",
      ...posStyle,
    }}>
      <div style={{ padding: "10px 16px 0" }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C, background: `${C}18`, padding: "3px 8px", borderRadius: 99,
        }}>
          {t.libraryBadge}
        </span>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${C}, ${C}80)`, marginTop: 10 }} />

      <div style={{ padding }}>
        <div style={{ display: "flex", gap: 4, marginBottom: isMobile ? 10 : 14 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 99,
              background: i <= stepIdx ? C : "rgba(255,255,255,0.15)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isMobile ? 8 : 12 }}>
          <div style={{
            width: iconSize, height: iconSize, borderRadius: 12, flexShrink: 0,
            background: `${C}20`, color: C,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {icon}
          </div>
          <div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              {t.stepLabel(stepIdx + 1, total)}
            </p>
            <h3 style={{ color: "#fff", fontWeight: 900, fontSize: isMobile ? 14 : 15, lineHeight: 1.2 }}>{title}</h3>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: isMobile ? 11 : 12, lineHeight: 1.6, marginBottom: isMobile ? 12 : 16 }}>
          {description}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          {stepIdx > 0 && <PrevButton onPrev={onPrev} label={t.prev} />}
          <button onClick={onNext} style={{
            flex: 1, padding: "9px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: C, color: "#fff", border: "none", cursor: "pointer",
          }}>
            {isLast ? t.exploreNow : t.next}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryTutorialOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useLanguage();
  const t = tutorialTranslations[locale];

  const STEPS_TEXT = [
    t.lib.s1, t.lib.s2, t.lib.s3, t.lib.s4, t.lib.s5, t.lib.s6,
    t.lib.s7, t.lib.s8, t.lib.s9, t.lib.s10, t.lib.s11,
    t.lib.s13, t.lib.s14, t.lib.s15, t.lib.s12,
  ];

  useEffect(() => {
    try {
      if (params.get("tutorial") === "library" && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {}
  }, [params]);

  const updateSpot = useCallback(() => {
    if (!visible) return;
    const def = STEP_DEFS[step];
    window.dispatchEvent(new CustomEvent("tutorial-step", { detail: { selector: def.selector } }));
    if (!def.selector) { setSpotRect(null); return; }

    setTimeout(() => {
      const el = document.querySelector(def.selector!);
      if (!el) { setSpotRect(null); return; }
      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!inView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const rect = getRect(def.selector!, def.padding ?? 8);
          setSpotRect(rect);
          if (def.scrollDown) setTimeout(() => window.scrollBy({ top: 1800, behavior: "smooth" }), 400);
        }, 500);
      } else {
        setSpotRect(getRect(def.selector!, def.padding ?? 8));
        if (def.scrollDown) setTimeout(() => window.scrollBy({ top: 1800, behavior: "smooth" }), 300);
      }
    }, 320);
  }, [step, visible]);

  useEffect(() => {
    updateSpot();
    window.addEventListener("resize", updateSpot);
    return () => window.removeEventListener("resize", updateSpot);
  }, [updateSpot]);

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setVisible(false);
    router.replace("/feed");
  }

  function next() {
    if (step < STEP_DEFS.length - 1) setStep((s) => s + 1);
    else finish();
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const def = STEP_DEFS[step];
  const txt = STEPS_TEXT[step];

  return (
    <>
      {spotRect ? (
        <div style={{
          position: "fixed",
          top: spotRect.top, left: spotRect.left,
          width: spotRect.width, height: spotRect.height,
          zIndex: 3005, borderRadius: 14,
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 2px ${C}, 0 0 0 5px ${C}40, 0 0 24px ${C}60`,
          pointerEvents: "none",
          transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
        }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, zIndex: 3005, background: "rgba(0,0,0,0.75)", pointerEvents: "none" }} />
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 3008, cursor: "default" }}
        onClick={(e) => e.stopPropagation()} />

      {def.social ? (
        <SocialPanel
          icon={def.icon}
          title={txt.title}
          description={txt.desc}
          onFinish={finish}
          onPrev={prev}
          total={STEP_DEFS.length}
          t={t}
        />
      ) : (
        <InfoPanel
          stepIdx={step}
          total={STEP_DEFS.length}
          icon={def.icon}
          title={txt.title}
          description={txt.desc}
          spotRect={spotRect}
          onNext={next}
          onPrev={prev}
          t={t}
        />
      )}
    </>
  );
}

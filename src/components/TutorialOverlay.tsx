"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { tutorialTranslations, type TutorialT } from "@/lib/tutorial-i18n";

const STORAGE_KEY = "scp-tutorial-done";
const C = "#2563eb";

interface StepDef {
  icon: React.ReactNode;
  selector: string | null;
  padding?: number;
}

const STEP_DEFS: StepDef[] = [
  {
    selector: 'a[href="/feed"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    selector: 'a[href="/saved"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    selector: 'a[href="/news"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="metrics"]',
    padding: 12,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    selector: '[data-tutorial="whatsapp"]',
    padding: 12,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
  },
  {
    selector: 'a[href="/account"]',
    padding: 10,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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

function InfoPanel({
  stepIdx, total, icon, title, description, spotRect, onNext, onPrev, t,
}: {
  stepIdx: number; total: number; icon: React.ReactNode;
  title: string; description: string; spotRect: Rect | null;
  onNext: () => void; onPrev: () => void; t: TutorialT;
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const panelWidth = isMobile ? vw - 32 : isTablet ? 260 : 300;
  const panelPad = 16;

  let posStyle: React.CSSProperties;

  if (isMobile) {
    posStyle = { bottom: 24, left: 16, right: 16, width: "auto" };
  } else if (isTablet) {
    posStyle = { bottom: 24, left: "50%", transform: "translateX(-50%)", width: panelWidth };
  } else {
    let top = vh / 2 - 160;
    let left = vw / 2 - panelWidth / 2;

    if (spotRect) {
      const spRight = spotRect.left + spotRect.width;
      const spBottom = spotRect.top + spotRect.height;

      if (spRight + panelWidth + panelPad + 24 < vw) {
        left = spRight + panelPad + 8;
        top = Math.max(16, Math.min(spotRect.top, vh - 340));
      } else if (spotRect.left - panelWidth - panelPad - 8 > 0) {
        left = spotRect.left - panelWidth - panelPad - 8;
        top = Math.max(16, Math.min(spotRect.top, vh - 340));
      } else if (spBottom + panelPad + 16 < vh) {
        top = spBottom + panelPad + 8;
        left = Math.max(16, Math.min(spotRect.left, vw - panelWidth - 16));
      } else {
        top = Math.max(16, spotRect.top - 340 - panelPad - 8);
        left = Math.max(16, Math.min(spotRect.left, vw - panelWidth - 16));
      }
    }

    posStyle = { top, left, width: panelWidth };
  }

  const isLast = stepIdx === total - 1;
  const iconSize = isMobile ? 36 : 44;
  const padding = isMobile ? "12px 16px 14px" : "16px 20px 16px";

  return (
    <div
      style={{
        position: "fixed", zIndex: 3010,
        background: "#111827", borderRadius: 20,
        border: `1px solid ${C}40`,
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${C}20`,
        overflow: "hidden",
        transition: "top 0.4s cubic-bezier(0.4,0,0.2,1), left 0.4s cubic-bezier(0.4,0,0.2,1)",
        maxHeight: isMobile ? "55vh" : "none",
        ...posStyle,
      }}
    >
      <div style={{ padding: "10px 16px 0" }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C, background: `${C}18`, padding: "3px 8px", borderRadius: 99,
        }}>
          {t.badge}
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
          {stepIdx > 0 && (
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
              {t.prev}
            </button>
          )}
          <button
            onClick={onNext}
            style={{
              flex: 1, padding: "9px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800,
              background: C, color: "#fff", border: "none", cursor: "pointer",
            }}
          >
            {isLast ? t.exploreNow : t.next}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useLanguage();
  const t = tutorialTranslations[locale];

  const STEPS_TEXT = [t.dash.s1, t.dash.s2, t.dash.s3, t.dash.s4, t.dash.s5, t.dash.s6];

  useEffect(() => {
    try {
      if (params.get("tutorial") === "1" && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {}
  }, [params]);

  const updateSpot = useCallback(() => {
    if (!visible) return;
    const def = STEP_DEFS[step];
    if (!def.selector) { setSpotRect(null); return; }
    const el = document.querySelector(def.selector);
    if (!el) { setSpotRect(null); return; }
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight;
    if (!inView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setSpotRect(getRect(def.selector!, def.padding ?? 8)), 500);
    } else {
      setSpotRect(getRect(def.selector, def.padding ?? 8));
    }
  }, [step, visible]);

  useEffect(() => {
    updateSpot();
    window.addEventListener("resize", updateSpot);
    return () => window.removeEventListener("resize", updateSpot);
  }, [updateSpot]);

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setVisible(false);
    router.push("/feed?tutorial=library");
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
    </>
  );
}

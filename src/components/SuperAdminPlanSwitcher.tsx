"use client";

import { useEffect, useState } from "react";
import { TEST_PLAN_KEY } from "@/lib/plan-utils";

const PLANS = [
  { id: "free",         label: "Free" },
  { id: "weekly",       label: "Weekly" },
  { id: "basic_monthly", label: "Basic M" },
  { id: "basic_annual",  label: "Basic A" },
  { id: "pro_monthly",   label: "Pro M" },
  { id: "pro_annual",    label: "Pro A" },
];

export default function SuperAdminPlanSwitcher() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [current, setCurrent] = useState<string>("pro_annual");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/user/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d.superAdmin === true) {
          setIsSuperAdmin(true);
          setCurrent(localStorage.getItem(TEST_PLAN_KEY) ?? "pro_annual");
        }
      })
      .catch(() => {});
  }, []);

  if (!isSuperAdmin) return null;

  function select(id: string) {
    localStorage.setItem(TEST_PLAN_KEY, id);
    setCurrent(id);
    setOpen(false);
    window.location.reload();
  }

  const currentLabel = PLANS.find((p) => p.id === current)?.label ?? current;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        right: 14,
        zIndex: 9999,
      }}
    >
      {open && (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 8,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            minWidth: 148,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#818cf8" }}>
              Vista del pla
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: current === p.id ? "#6366f1" : "var(--bg-input)",
                  color: current === p.id ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(99,102,241,0.35)",
          background: "var(--bg-secondary)",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>
          {currentLabel}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>
  );
}

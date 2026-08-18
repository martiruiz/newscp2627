"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Plans ─────────────────────────────────────────────────────────── */

const PLANS = {
  monthly: [
    {
      id: "weekly",
      key: "weekly",
      name: "Weekly",
      price: "€3,99",
      period: "/setmana",
      badge: null as string | null,
      color: "#0A66C2",
    },
    {
      id: "basic",
      key: "basic_monthly",
      name: "Basic",
      price: "€9,99",
      period: "/mes",
      badge: null as string | null,
      color: "#059669",
    },
    {
      id: "pro",
      key: "pro_monthly",
      name: "Pro",
      price: "€39,99",
      period: "/mes",
      badge: "Més popular",
      color: "#2563EB",
    },
  ],
  annual: [
    {
      id: "weekly",
      key: "weekly",
      name: "Weekly",
      price: "€2,79",
      period: "/setmana",
      badge: null as string | null,
      color: "#0A66C2",
    },
    {
      id: "basic",
      key: "basic_annual",
      name: "Basic",
      price: "€7,99",
      period: "/mes",
      badge: null as string | null,
      color: "#059669",
    },
    {
      id: "pro",
      key: "pro_annual",
      name: "Pro",
      price: "€31,99",
      period: "/mes",
      badge: "Més popular",
      color: "#2563EB",
    },
  ],
};

/* ─── Component ─────────────────────────────────────────────────────── */

export default function PricingBottomSheet() {
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [selected, setSelected] = useState("pro");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  /* drag-to-dismiss */
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  /* open via global event */
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      requestAnimationFrame(() => setVisible(true));
    };
    window.addEventListener("open-pricing-sheet", handler);
    return () => window.removeEventListener("open-pricing-sheet", handler);
  }, []);

  /* lock body scroll while open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setOpen(false), 280);
  }, []);

  /* drag handle */
  const onDragStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const onDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const onDragEnd = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    dragging.current = false;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (dy > 80) {
      close();
    } else {
      sheetRef.current.style.transition = "transform 0.25s cubic-bezier(0.32,0.72,0,1)";
      sheetRef.current.style.transform = "translateY(0)";
      setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.transition = "";
      }, 260);
    }
  }, [close]);

  async function handleCheckout() {
    const plans = PLANS[billing];
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: plan.key }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Unauthorized") {
        close();
        window.location.href = "/admin/login?redirect=/pricing";
      } else {
        alert(data.error ?? "Error al iniciar el pagament");
      }
    } catch {
      alert("Error al connectar amb el servidor de pagaments");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const plans = PLANS[billing];
  const activePlan = plans.find((p) => p.id === selected) ?? plans[2];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9001,
          background: "#0d1829",
          borderRadius: "24px 24px 0 0",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.5)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "90dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Drag handle */}
        <div
          style={{ paddingTop: 12, paddingBottom: 8, cursor: "grab" }}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.25)",
              margin: "0 auto",
            }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={close}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 30,
            height: 30,
            borderRadius: 15,
            background: "rgba(255,255,255,0.1)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div style={{ padding: "0 20px 8px" }}>
          {/* Title */}
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#fff",
              textAlign: "center",
              marginBottom: 16,
              letterSpacing: "-0.02em",
            }}
          >
            Escull el teu pla
          </h2>

          {/* Billing toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 3,
              marginBottom: 16,
              position: "relative",
            }}
          >
            {(["monthly", "annual"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  background: billing === b ? "#fff" : "transparent",
                  color: billing === b ? "#0d1829" : "rgba(255,255,255,0.55)",
                  transition: "all 0.18s",
                  position: "relative",
                }}
              >
                {b === "monthly" ? "Mensual" : "Anual"}
                {b === "annual" && (
                  <span
                    style={{
                      position: "absolute",
                      top: -8,
                      right: 8,
                      background: "#22C55E",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 900,
                      padding: "2px 5px",
                      borderRadius: 6,
                      letterSpacing: "0.04em",
                    }}
                  >
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plan rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {plans.map((plan) => {
              const isSelected = selected === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: isSelected
                      ? `2px solid ${plan.color}`
                      : "2px solid rgba(255,255,255,0.1)",
                    background: isSelected
                      ? `${plan.color}18`
                      : "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                    position: "relative",
                  }}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <span
                      style={{
                        position: "absolute",
                        top: -10,
                        left: 14,
                        background: plan.color,
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: 6,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}

                  {/* Left: radio + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        border: isSelected ? `6px solid ${plan.color}` : "2px solid rgba(255,255,255,0.3)",
                        background: "transparent",
                        flexShrink: 0,
                        transition: "all 0.15s",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: isSelected ? "#fff" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {plan.name}
                    </span>
                  </div>

                  {/* Right: price */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginLeft: 1 }}>
                      {plan.period}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px 0",
              borderRadius: 16,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 900,
              color: "#fff",
              background: activePlan.color,
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.15s",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Redirigint…
              </>
            ) : (
              `Subscriure's a ${activePlan.name}`
            )}
          </button>

          {/* Fine print */}
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              marginTop: 10,
            }}
          >
            ✓ Cancel·la en qualsevol moment
          </p>
        </div>
      </div>
    </>
  );
}

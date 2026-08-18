"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LocalCurrency {
  code: string;
  symbol: string;
  rate: number;
  locale: string;
}

function formatLocalPrice(eur: number, currency: LocalCurrency): string {
  const local = eur * currency.rate;
  if (currency.code === "ARS" || currency.code === "CLP" || currency.code === "PYG" || currency.code === "CRC" || currency.code === "DOP") {
    return `${currency.symbol}${Math.round(local).toLocaleString(currency.locale)}`;
  }
  return `${currency.symbol}${local.toFixed(2).replace(".", ",")}`;
}

/* ─── Plan data ──────────────────────────────────────────────────── */

const PLANS_MONTHLY = [
  {
    id: "weekly",
    name: "Weekly",
    price: 3.99,
    period: "setmana",
    color: "#0A66C2",
    badge: null as string | null,
    planKey: "weekly",
    highlight: false,
    features: [
      "Accés complet a la Content Library",
      "Filtres avançats i cerca",
      "Carpetes il·limitades",
      "Newsletter setmanal",
      "Blog i notícies del sector",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: 9.99,
    period: "mes",
    color: "#059669",
    badge: null as string | null,
    planKey: "basic_monthly",
    highlight: false,
    features: [
      "Tot el de Weekly",
      "Secció Profiles de creadors",
      "Cerca avançada d'influencers",
      "Guardats il·limitats",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 39.99,
    period: "mes",
    color: "#2563EB",
    badge: "Més popular",
    planKey: "pro_monthly",
    highlight: true,
    features: [
      "Tot el de Basic",
      "Panell d'idees de contingut",
      "Exportació CSV",
      "Importació massiva",
      "Fins a 50 perfils personalitzats",
      "Suport prioritari",
    ],
  },
];

const PLANS_ANNUAL = PLANS_MONTHLY.map((p) => {
  if (p.id === "weekly") return { ...p, price: 2.79, period: "setmana", planKey: "weekly" };
  if (p.id === "basic") return { ...p, price: 7.99, period: "mes", planKey: "basic_annual" };
  if (p.id === "pro") return { ...p, price: 31.99, period: "mes", planKey: "pro_annual", badge: "Més popular" };
  return p;
});

const FAQ = [
  {
    q: "Puc cancel·lar en qualsevol moment?",
    a: "Sí. Pots cancel·lar en qualsevol moment des del teu compte. Mantindràs l'accés fins al final del període facturat.",
  },
  {
    q: "Accepteu targetes de crèdit i dèbit?",
    a: "Sí, acceptem Visa, Mastercard, American Express i altres targetes principals. Els pagaments es processen de forma segura a través de Stripe.",
  },
  {
    q: "Hi ha descompte per a equips?",
    a: "Sí, oferim preus especials per a equips de més de 5 persones. Contacta'ns a info@sportscontentplaybook.com.",
  },
  {
    q: "Puc canviar de pla?",
    a: "Sí. Pots fer upgrade o downgrade en qualsevol moment. Si fas upgrade, es cobra la diferència pro-rata.",
  },
];

/* ─── Plan card component ─────────────────────────────────────────── */

function PlanCard({
  plan,
  loading,
  onCheckout,
  localCurrency,
}: {
  plan: (typeof PLANS_MONTHLY)[number];
  loading: string | null;
  onCheckout: (key: string) => void;
  localCurrency: LocalCurrency | null;
}) {
  const isLoadingThis = loading === plan.planKey;

  return (
    <div
      className="relative flex flex-col rounded-2xl p-5 w-full"
      style={{
        border: plan.highlight ? `2px solid ${plan.color}` : "1px solid var(--border-color)",
        background: plan.highlight ? `${plan.color}08` : "var(--bg-card)",
        boxShadow: plan.highlight ? `0 8px 32px ${plan.color}20` : "none",
      }}
    >
      {plan.badge && (
        <span
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap"
          style={{ background: plan.color, color: "#fff" }}
        >
          {plan.badge}
        </span>
      )}

      {/* Price */}
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: plan.color }}>
          {plan.name}
        </p>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
            {localCurrency ? formatLocalPrice(plan.price, localCurrency) : `€${plan.price.toFixed(2).replace(".", ",")}`}
          </span>
          <span className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>/{plan.period}</span>
        </div>
        {localCurrency && (
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            ≈ €{plan.price.toFixed(2).replace(".", ",")} · precio aproximado
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-2 flex-1 mb-5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg className="shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onCheckout(plan.planKey)}
        disabled={isLoadingThis}
        className="w-full py-3.5 rounded-xl text-sm font-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        style={{
          background: plan.highlight ? plan.color : "var(--selected-bg)",
          color: "#fff",
          border: "none",
          touchAction: "manipulation",
        }}
      >
        {isLoadingThis ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Redirigint…
          </span>
        ) : (
          `Subscriure's a ${plan.name}`
        )}
      </button>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────── */

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [localCurrency, setLocalCurrency] = useState<LocalCurrency | null>(null);

  useEffect(() => {
    fetch("/api/geo").then((r) => r.json()).then((d) => {
      if (d.currency) setLocalCurrency(d.currency);
    }).catch(() => {});
  }, []);

  const plans = billing === "annual" ? PLANS_ANNUAL : PLANS_MONTHLY;

  async function handleCheckout(planKey: string) {
    setLoading(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Unauthorized") {
        window.location.href = "/admin/login?redirect=/pricing";
      } else {
        alert(data.error ?? "Error al iniciar el pagament");
      }
    } catch {
      alert("Error al connectar amb el servidor de pagaments");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-2 text-center max-w-lg mx-auto">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-6 transition-all hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Torna a la plataforma
        </Link>

        <h1 className="text-3xl md:text-4xl font-black mb-2 leading-tight">
          Escull el teu pla
        </h1>
        <p className="text-sm md:text-base mb-6" style={{ color: "var(--text-muted)" }}>
          Cancel·la en qualsevol moment.
        </p>

        {/* ── Billing toggle ──────────────────────────────────────── */}
        <div
          className="inline-flex items-center rounded-xl p-1 mb-6 mx-auto"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <button
            onClick={() => setBilling("monthly")}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: billing === "monthly" ? "var(--selected-bg)" : "transparent",
              color: billing === "monthly" ? "var(--selected-text)" : "var(--text-muted)",
            }}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling("annual")}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all relative"
            style={{
              background: billing === "annual" ? "var(--selected-bg)" : "transparent",
              color: billing === "annual" ? "var(--selected-text)" : "var(--text-muted)",
            }}
          >
            Anual
            <span
              className="absolute -top-2 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "#22C55E", color: "#fff" }}
            >
              −20%
            </span>
          </button>
        </div>
      </div>

      {/* ── Plan cards ──────────────────────────────────────────────── */}
      <div className="px-4 max-w-5xl mx-auto">
        {/* Mobile: stack vertically */}
        <div className="flex flex-col gap-4 md:hidden">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} loading={loading} onCheckout={handleCheckout} localCurrency={localCurrency} />
          ))}

          {/* Free plan note */}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3.5"
            style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}
          >
            <div>
              <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Gratis</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Accés bàsic sense targeta</p>
            </div>
            <Link
              href="/feed"
              className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              Continuar →
            </Link>
          </div>
        </div>

        {/* Desktop: grid */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} loading={loading} onCheckout={handleCheckout} localCurrency={localCurrency} />
          ))}
        </div>

        {/* Desktop free plan */}
        <div className="hidden md:flex items-center justify-center gap-3 mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          <span>Vols accés bàsic gratis?</span>
          <Link href="/feed" className="font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>
            Continua gratuïtament →
          </Link>
        </div>
      </div>

      {/* ── Trust signals ─────────────────────────────────────────── */}
      <div className="px-5 py-6 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: "🔒", text: "Pagaments segurs amb Stripe" },
            { icon: "✓", text: "Cancel·lació en qualsevol moment" },
            { icon: "🛡️", text: "Dades protegides (GDPR)" },
            { icon: "💬", text: "Suport en català i castellà" },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <div className="px-4 pb-8 max-w-lg mx-auto">
        <h2 className="text-lg font-black mb-4 text-center" style={{ color: "var(--text-primary)" }}>
          Preguntes freqüents
        </h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-semibold transition-all"
                style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}
              >
                <span className="pr-4 leading-snug">{item.q}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="shrink-0"
                  style={{ transition: "transform 0.2s", transform: openFaq === i ? "rotate(180deg)" : "none" }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {openFaq === i && (
                <div
                  className="px-4 pb-4 text-sm leading-relaxed"
                  style={{ color: "var(--text-muted)", background: "var(--bg-card)", borderTop: "1px solid var(--border-color)" }}
                >
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          Tens dubtes?{" "}
          <a
            href="mailto:info@sportscontentplaybook.com"
            className="font-semibold hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            Contacta'ns
          </a>
        </p>
      </div>
    </div>
  );
}

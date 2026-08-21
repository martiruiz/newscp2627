"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── Tiny phone mockup components ─────────────────────────────────── */

function PhoneFrame({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: 172,
        height: 360,
        borderRadius: 38,
        border: "5px solid #1a1a2e",
        background: "#0D1421",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Dynamic island */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60,
          height: 10,
          background: "#1a1a2e",
          borderRadius: 6,
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
}

function PhoneFeed() {
  const cards = [
    { platform: "IG", color: "#E1306C", sport: "Futbol", lines: [70, 55] },
    { platform: "TW", color: "#1DA1F2", sport: "Bàsquet", lines: [80, 60] },
    { platform: "TK", color: "#69C9D0", sport: "Pàdel", lines: [65, 50] },
  ];
  return (
    <div style={{ paddingTop: 28, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "8px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 18, height: 18, background: "#F5C542", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#0D1421"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", letterSpacing: "0.06em" }}>SCP NOVA</span>
        </div>
        <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </div>
      {/* Cards */}
      <div style={{ flex: 1, overflowY: "hidden", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: "#1A2744", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ height: 54, background: `linear-gradient(135deg, #1e2f50 0%, #162040 100%)`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: c.color, opacity: 0.9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#fff" }}>{c.platform}</span>
              </div>
              <div style={{ position: "absolute", top: 4, right: 6, background: "rgba(245,197,66,0.2)", borderRadius: 4, padding: "1px 4px" }}>
                <span style={{ fontSize: 6, fontWeight: 700, color: "#F5C542" }}>{c.sport}</span>
              </div>
            </div>
            <div style={{ padding: "5px 7px 6px", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: `${c.lines[0]}%` }} />
              <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 3, width: `${c.lines[1]}%` }} />
            </div>
          </div>
        ))}
      </div>
      {/* Bottom nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "6px 0 12px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#111827" }}>
        {[
          <svg key="h" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F5C542" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
          <svg key="g" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
          <div key="p" style={{ width: 22, height: 22, background: "#F5C542", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0D1421" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>,
          <svg key="c" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
          <svg key="u" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
        ]}
      </div>
    </div>
  );
}

function PhoneFilters() {
  const categories = ["Futbol", "Bàsquet", "Pàdel", "Tenis", "Ciclisme", "Rugby"];
  const platforms = ["Instagram", "TikTok", "YouTube", "X / Twitter"];
  return (
    <div style={{ paddingTop: 28, padding: "28px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Filtres intel·ligents</div>
      <div style={{ fontSize: 7, fontWeight: 600, color: "#F5C542", marginBottom: 2 }}>Esports</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {categories.map((c, i) => (
          <div key={c} style={{ background: i === 0 ? "#F5C542" : "rgba(255,255,255,0.08)", borderRadius: 20, padding: "2px 7px" }}>
            <span style={{ fontSize: 6.5, fontWeight: 700, color: i === 0 ? "#0D1421" : "#aaa" }}>{c}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 7, fontWeight: 600, color: "#F5C542", marginTop: 4 }}>Plataforma</div>
      {platforms.map((p, i) => (
        <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 6.5, color: "#ddd" }}>{p}</span>
          <div style={{ width: 20, height: 11, borderRadius: 6, background: i < 2 ? "#F5C542" : "rgba(255,255,255,0.12)", position: "relative" }}>
            <div style={{ width: 9, height: 9, borderRadius: 5, background: "#fff", position: "absolute", top: 1, left: i < 2 ? 10 : 1, transition: "left 0.2s" }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, background: "#F5C542", borderRadius: 8, padding: "5px 0", textAlign: "center" }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: "#0D1421" }}>APLICAR FILTRES</span>
      </div>
    </div>
  );
}

function PhoneSaved() {
  const collections = [
    { label: "Reels Futbol", count: 24, color: "#E1306C" },
    { label: "Best of NBA", count: 18, color: "#1DA1F2" },
    { label: "Viral Pàdel", count: 31, color: "#F5C542" },
    { label: "Tendències", count: 47, color: "#a855f7" },
  ];
  return (
    <div style={{ paddingTop: 28, padding: "28px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>Guardats</div>
        <div style={{ background: "rgba(245,197,66,0.15)", borderRadius: 4, padding: "1px 5px" }}>
          <span style={{ fontSize: 6, fontWeight: 700, color: "#F5C542" }}>PRO</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {collections.map((col) => (
          <div key={col.label} style={{ background: "#1A2744", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ height: 60, background: `linear-gradient(135deg, ${col.color}22 0%, #1A2744 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: `${col.color}33`, border: `1.5px solid ${col.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={col.color} strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </div>
            </div>
            <div style={{ padding: "4px 6px 5px" }}>
              <div style={{ fontSize: 6, fontWeight: 700, color: "#ddd", lineHeight: 1.2 }}>{col.label}</div>
              <div style={{ fontSize: 5.5, color: "#666", marginTop: 1 }}>{col.count} posts</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4, background: "rgba(245,197,66,0.12)", borderRadius: 8, padding: "6px 8px", border: "1px solid rgba(245,197,66,0.2)" }}>
        <div style={{ fontSize: 6.5, fontWeight: 700, color: "#F5C542", marginBottom: 1 }}>Contingut guardat</div>
        <div style={{ fontSize: 6, color: "#888" }}>Organitza per col·leccions temàtiques i accedeix offline</div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/user/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d.email && d.onboardingCompleted === true) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(160deg, #080e1a 0%, #0f1f3d 40%, #080e1a 100%)",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Background grid */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(245,197,66,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,66,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "env(safe-area-inset-top, 0px) 24px env(safe-area-inset-bottom, 0px)",
          paddingTop: "max(env(safe-area-inset-top, 0px), 48px)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 48px)",
          gap: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo + badge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg, #1A2744 0%, #0D1421 100%)",
              border: "1.5px solid rgba(245,197,66,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(245,197,66,0.15), 0 0 0 1px rgba(245,197,66,0.08)",
              overflow: "hidden",
              padding: 6,
            }}
          >
            <img src="/logo.svg" alt="Sports Content Playbook" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div
            style={{
              background: "rgba(245,197,66,0.12)",
              border: "1px solid rgba(245,197,66,0.25)",
              borderRadius: 20,
              padding: "3px 12px",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#F5C542", textTransform: "uppercase" }}>
              Sports Content Playbook
            </span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginTop: 28, maxWidth: 480 }}>
          <h1
            style={{
              fontSize: "clamp(26px, 7vw, 44px)",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            El contingut esportiu{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #F5C542, #f9a825)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              que connecta
            </span>{" "}
            amb la teva audiència
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: "clamp(13px, 3.5vw, 16px)",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6,
              maxWidth: 380,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Descobreix, guarda i analitza el millor contingut de clubs, atletes i marques esportives d'arreu del món.
          </p>
        </div>

        {/* Phone mockups */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 40,
            position: "relative",
          }}
        >
          {/* Glow behind center phone */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              background: "radial-gradient(circle, rgba(245,197,66,0.12) 0%, transparent 70%)",
              pointerEvents: "none",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />

          {/* Left phone – filters */}
          <PhoneFrame
            style={{
              transform: "rotate(-10deg) translateY(20px)",
              opacity: 0.85,
              width: 148,
              height: 310,
            }}
          >
            <PhoneFilters />
          </PhoneFrame>

          {/* Center phone – feed */}
          <PhoneFrame style={{ zIndex: 2 }}>
            <PhoneFeed />
          </PhoneFrame>

          {/* Right phone – saved */}
          <PhoneFrame
            style={{
              transform: "rotate(10deg) translateY(20px)",
              opacity: 0.85,
              width: 148,
              height: 310,
            }}
          >
            <PhoneSaved />
          </PhoneFrame>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginTop: 40,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {[
            { value: "500K+", label: "publicacions" },
            { value: "10+", label: "plataformes" },
            { value: "4.9★", label: "valoració" },
          ].map((stat, i) => (
            <div
              key={stat.value}
              style={{
                padding: "14px 24px",
                textAlign: "center",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: "#F5C542", letterSpacing: "-0.02em" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2, fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex" }}>
            {[
              { src: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg", alt: "FC Barcelona" },
              { src: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg", alt: "Real Madrid" },
              { src: "https://upload.wikimedia.org/wikipedia/en/5/57/UD_Las_Palmas_logo.svg", alt: "UD Las Palmas" },
              { src: "https://upload.wikimedia.org/wikipedia/en/8/8b/KKS_Lech_Pozna%C5%84_logo.svg", alt: "Lech Poznań" },
            ].map((club, i) => (
              <div
                key={i}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: "#fff",
                  border: "2.5px solid #080e1a",
                  marginLeft: i > 0 ? -10 : 0,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <img src={club.src} alt={club.alt} style={{ width: 26, height: 26, objectFit: "contain" }} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            Usat per clubs, agències i creadors
          </span>
        </div>

        {/* CTAs */}
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 320 }}>
          <Link
            href="/onboarding"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "16px 24px",
              borderRadius: 16,
              background: "linear-gradient(135deg, #F5C542 0%, #f9a825 100%)",
              color: "#0D1421",
              fontWeight: 900,
              fontSize: 16,
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(245,197,66,0.35)",
              letterSpacing: "0.01em",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            Comencem
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>

          <Link
            href="/admin/login"
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              fontWeight: 600,
              padding: "8px 16px",
            }}
          >
            Ja tinc compte →
          </Link>
        </div>
      </div>
    </div>
  );
}

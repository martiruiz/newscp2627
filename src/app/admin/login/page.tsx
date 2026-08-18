"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "register";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function AdminLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const errorParam = searchParams.get("error");
  const [error, setError] = useState(() => {
    if (errorParam === "unauthorized") return "Accés denegat. Cal un compte de superadministrador.";
    if (errorParam === "not_invited") return "Aquest compte de Google no té accés. Contacta amb un administrador.";
    if (errorParam === "google_denied") return "Has cancel·lat l'inici de sessió amb Google.";
    if (errorParam === "google_not_configured") return "Google OAuth no està configurat. Afegeix GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET a .env.";
    if (errorParam === "google_token_failed") return "Error en autenticar amb Google. Torna-ho a intentar.";
    return "";
  });
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/users?check=setup")
      .then((r) => r.json())
      .then((d) => setIsSetup(d.needsSetup === true))
      .catch(() => setIsSetup(false));
    try {
      const saved = localStorage.getItem("scp-admin-email");
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Les contrasenyes no coincideixen");
        return;
      }
      if (password.length < 8) {
        setError("La contrasenya ha de tenir almenys 8 caràcters");
        return;
      }
    }

    setLoading(true);
    try {
      const action = mode === "register" ? "register" : isSetup ? "setup" : "login";
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, action, remember }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error"); return; }
      try {
        if (remember) localStorage.setItem("scp-admin-email", email.trim().toLowerCase());
        else localStorage.removeItem("scp-admin-email");
      } catch {}
      router.push("/admin/content-ideas");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === "register";
  const effectiveSetup = isSetup && !isRegister;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#050d1a" }}
    >
      {/* Background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-bg.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center",
          opacity: 0.18, pointerEvents: "none", userSelect: "none",
        }}
      />
      {/* Blue gradient overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(2,8,40,0.92) 0%, rgba(15,40,100,0.78) 40%, rgba(37,99,235,0.55) 70%, rgba(59,130,246,0.25) 100%)",
      }} />
      {/* Radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(37,99,235,0.12) 0%, transparent 70%)",
      }} />
      <div className="w-full max-w-sm" style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Sports Content Playbook"
            style={{ height: 48, width: "auto", maxWidth: 240, objectFit: "contain" }}
          />
        </div>

        {/* Mode toggle */}
        {!isSetup && (
          <div
            className="flex rounded-xl p-1 mb-5"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? "var(--selected-bg)" : "transparent",
                  color: mode === m ? "var(--selected-text)" : "var(--text-muted)",
                }}
              >
                {m === "login" ? "Iniciar sessió" : "Crear compte"}
              </button>
            ))}
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h1 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {effectiveSetup
              ? "Crea el primer compte admin"
              : isRegister
              ? "Crea el teu compte"
              : "Inicia sessió"}
          </h1>
          {effectiveSetup && (
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              No hi ha administradors. Configura el primer compte per continuar.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Name — only on register */}
            {isRegister && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Nom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="El teu nom"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                Correu electrònic
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="correu@exemple.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                Contrasenya
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                >
                  <EyeIcon open={showPass} />
                </button>
              </div>
              {isRegister && (
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Mínim 8 caràcters
                </p>
              )}
            </div>

            {/* Confirm password — only on register */}
            {isRegister && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Confirma la contrasenya
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: confirmPassword && confirmPassword !== password
                        ? "1px solid rgba(239,68,68,0.6)"
                        : "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </div>
            )}

            {/* Remember me — only on login */}
            {!isRegister && !effectiveSetup && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRemember((v) => !v)}
                  className="flex items-center justify-center rounded transition-all shrink-0"
                  style={{
                    width: 16, height: 16,
                    background: remember ? "var(--color-charcoal)" : "var(--bg-input)",
                    border: remember ? "1px solid var(--color-charcoal)" : "1px solid var(--border-color)",
                  }}
                >
                  {remember && (
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Recorda'm 15 dies
                </span>
              </label>
            )}

            {/* Error */}
            {error && (
              <div
                className="text-xs rounded-lg px-3 py-2.5"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
            >
              {loading
                ? isRegister ? "Creant compte…" : effectiveSetup ? "Configurant…" : "Iniciant sessió…"
                : isRegister ? "Crear compte" : effectiveSetup ? "Crear compte i entrar" : "Iniciar sessió"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>o</span>
              <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
            </div>

            {/* Google OAuth */}
            <a
              href="/api/admin/auth/google"
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", textDecoration: "none" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continua amb Google
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return <Suspense><AdminLoginPageInner /></Suspense>;
}

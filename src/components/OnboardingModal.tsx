"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "scp-onboarding-done";
export const PREFS_KEY = "scp-onboarding-prefs";

const SOCIAL_NETWORKS = [
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="1.8"/>
        <circle cx="17.5" cy="6.5" r="1" fill="#E1306C"/>
      </svg>
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#010101",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.04-8.87A8.17 8.17 0 0 0 21 8.38V4.98a4.85 4.85 0 0 1-1.41-2.29z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.253h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "x",
    label: "X",
    color: "#000000",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: "pinterest",
    label: "Pinterest",
    color: "#E60023",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#E60023">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    logo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    ),
  },
];

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState({ club: "", competition: "", creator: "" });
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  if (!visible) return null;

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function toggleNetwork(id: string) {
    setSelectedNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const prefs = { ...form, networks: selectedNetworks };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      const profile = JSON.parse(localStorage.getItem("scp-account-profile") || "{}");
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prefs, email: profile.email || "" }),
      });
    } catch {}
    localStorage.setItem(STORAGE_KEY, "1");
    setSending(false);
    setVisible(false);
    router.push("/account?from=onboarding");
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)", borderRadius: 24, width: "100%", maxWidth: 480,
          border: "1px solid var(--border-color)", overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Header gradient */}
        <div
          className="px-8 pt-8 pb-6"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #374151 100%)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, background: "rgba(255,255,255,0.15)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
                Sports Content Playbook
              </p>
              <p className="font-black text-white text-lg leading-tight">Benvingut/da!</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            Diga&apos;ns una mica sobre tu perquè puguem personalitzar el contingut que veus.
          </p>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Text fields */}
          {[
            { key: "club" as const, label: "Club o organització", placeholder: "p.ex. FC Barcelona, Real Madrid..." },
            { key: "competition" as const, label: "Competició", placeholder: "p.ex. LaLiga, Premier League, NBA..." },
            { key: "creator" as const, label: "Creador de contingut favorit", placeholder: "p.ex. @sportscontentplaybook..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                {label}
              </label>
              <input
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--bg-input)", border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#1F2937"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border-color)"; }}
              />
            </div>
          ))}

          {/* Social network selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
              Xarxa social preferida
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SOCIAL_NETWORKS.map((network) => {
                const isSelected = selectedNetworks.includes(network.id);
                return (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => toggleNetwork(network.id)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                    style={{
                      border: isSelected ? `2px solid ${network.color}` : "1px solid var(--border-color)",
                      background: isSelected ? `${network.color}12` : "var(--bg-input)",
                      transform: isSelected ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    <span style={{ color: network.id === "tiktok" ? "var(--text-primary)" : undefined }}>
                      {network.logo}
                    </span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: isSelected ? network.color : "var(--text-muted)" }}
                    >
                      {network.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={sending}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: "#1F2937", color: "#fff", opacity: sending ? 0.7 : 1 }}
            >
              {sending ? "Enviant..." : "Continuar →"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
            >
              Saltar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

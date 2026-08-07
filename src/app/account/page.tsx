"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Locale, LOCALE_NAMES, LANG_STORAGE_KEY } from "@/lib/i18n";

type Section = "profile" | "payments" | "subscription";

const PAYMENT_HISTORY = [
  { id: "INV-2026-08", date: "Aug 1, 2026", amount: "€29.00", plan: "Pro Monthly", status: "paid" },
  { id: "INV-2026-07", date: "Jul 1, 2026", amount: "€29.00", plan: "Pro Monthly", status: "paid" },
  { id: "INV-2026-06", date: "Jun 1, 2026", amount: "€29.00", plan: "Pro Monthly", status: "paid" },
  { id: "INV-2026-05", date: "May 1, 2026", amount: "€29.00", plan: "Pro Monthly", status: "paid" },
];

const ORG_SIZES = ["1 (solo)", "2–5", "6–15", "16–50", "51–200", "200+"];

const COUNTRIES = [
  "Spain", "France", "Germany", "Italy", "Portugal", "United Kingdom",
  "Netherlands", "Belgium", "Switzerland", "United States", "Other",
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const NAV_ICONS = {
  profile: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  subscription: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  payments: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
};

function SignOutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", borderRadius: 16, width: 360, maxWidth: "92vw",
          border: "1px solid var(--border-color)", padding: "28px 24px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48, background: "rgba(239,68,68,0.12)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>{t("account.signOutTitle")}</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("account.signOutConfirm")}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            {t("account.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {t("account.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionNav({ active, onChange, onSignOut }: { active: Section; onChange: (s: Section) => void; onSignOut: () => void }) {
  const { t } = useLanguage();
  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: t("account.myProfile"), icon: NAV_ICONS.profile },
    { id: "subscription", label: t("account.subscriptionTitle"), icon: NAV_ICONS.subscription },
    { id: "payments", label: t("account.payments"), icon: NAV_ICONS.payments },
  ];
  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all w-full"
            style={{
              background: isActive ? "var(--color-charcoal-subtle)" : "transparent",
              color: isActive ? "var(--selected-bg)" : "var(--text-secondary)",
            }}
          >
            <span style={{ color: isActive ? "var(--selected-bg)" : "var(--text-muted)" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}

      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
        {/* Admin Tools */}
        <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {t("account.admin")}
        </p>
        <Link
          href="/admin/import"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {t("account.import")}
        </Link>
        <Link
          href="/admin"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {t("account.adminPanel")}
        </Link>
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all w-full hover:opacity-80"
          style={{ color: "#ef4444" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t("account.signOut")}
        </button>
      </div>
    </nav>
  );
}

function MobileTabNav({ active, onChange, onSignOut }: { active: Section; onChange: (s: Section) => void; onSignOut: () => void }) {
  const { t } = useLanguage();
  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: t("account.myProfile"), icon: NAV_ICONS.profile },
    { id: "subscription", label: t("account.subscriptionTitle"), icon: NAV_ICONS.subscription },
    { id: "payments", label: t("account.payments"), icon: NAV_ICONS.payments },
  ];
  return (
    <div
      className="flex overflow-x-auto gap-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {navItems.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
            style={{
              background: isActive ? "var(--color-charcoal-subtle)" : "var(--bg-card)",
              border: `1px solid ${isActive ? "rgba(31,41,55,0.4)" : "var(--border-color)"}`,
              color: isActive ? "var(--selected-bg)" : "var(--text-secondary)",
            }}
          >
            <span style={{ color: isActive ? "var(--selected-bg)" : "var(--text-muted)" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
      <Link
        href="/admin/import"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
      >
        {t("account.import")}
      </Link>
      <button
        onClick={onSignOut}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444" }}
      >
        {t("account.signOut")}
      </button>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
      style={{
        background: disabled ? "var(--bg-secondary)" : "var(--bg-input)",
        border: "1px solid var(--border-color)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : undefined,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none"
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border-color)",
        color: "var(--text-primary)",
      }}
    >
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const PROFILE_KEY = "scp-account-profile";
const PHOTO_KEY = "scp-account-photo";
const PREFS_KEY = "scp-onboarding-prefs";

const DEFAULT_FORM = {
  name: "",
  surname: "",
  email: "",
  company: "",
  orgSize: "",
  address: "",
  city: "",
  postalCode: "",
  country: "Spain",
  vatId: "",
};

function ProfileSection({ fromOnboarding }: { fromOnboarding?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [prefs, setPrefs] = useState({ club: "", competition: "", creator: "" });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [dragging, setDragging] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const profileName = useProfileName();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PHOTO_KEY);
      if (stored) setPhoto(stored);
    } catch {}
  }, []);

  function handleFile(file: File) {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("El fitxer ha de ser una imatge (JPG, PNG o WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("La imatge no pot superar els 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPhoto(dataUrl);
      try { localStorage.setItem(PHOTO_KEY, dataUrl); } catch {}
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) setForm(JSON.parse(stored));
    } catch {}
    try {
      const storedPrefs = localStorage.getItem(PREFS_KEY);
      if (storedPrefs) setPrefs(JSON.parse(storedPrefs));
    } catch {}
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setP = (k: keyof typeof prefs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPrefs((p) => ({ ...p, [k]: e.target.value }));

  function handleSave() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(form)); } catch {}
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    if (fromOnboarding) {
      router.push("/dashboard?tutorial=1");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Onboarding banner */}
      {fromOnboarding && (
        <div
          className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #374151 100%)" }}
        >
          <div className="shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-0.5">Completa el teu perfil</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
              Omple les dades del teu perfil i prem Guardar canvis per accedir al tutorial de la plataforma.
            </p>
          </div>
        </div>
      )}

      {/* Profile photo */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{t("profile.photo")}</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{t("profile.photoSubtitle")}</p>
        <div className="flex items-center gap-4">
          {/* Clickable avatar */}
          <label
            className="shrink-0 relative cursor-pointer group"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <div
              className="rounded-2xl overflow-hidden flex items-center justify-center font-black text-2xl"
              style={{ width: 68, height: 68, background: photo ? "transparent" : "linear-gradient(135deg, #1F2937, #111827)", color: "#fff" }}
            >
              {photo
                ? <img src={photo} alt="Profile" style={{ width: 68, height: 68, objectFit: "cover" }} />
                : (profileName.initials || "ME")}
            </div>
            {/* Hover overlay */}
            <div
              className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.45)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{profileName.full || t("account.myProfile")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG, PNG · Max 2 MB</p>
          </div>
        </div>
        {photoError && (
          <p className="text-xs mt-2" style={{ color: "#ef4444" }}>{photoError}</p>
        )}
      </div>

      {/* Personal info */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-5" style={{ color: "var(--text-primary)" }}>
          {t("profile.personalInfo")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label={t("profile.firstName")}>
            <Input value={form.name} onChange={set("name")} placeholder={t("profile.firstName")} />
          </FieldGroup>
          <FieldGroup label={t("profile.lastName")}>
            <Input value={form.surname} onChange={set("surname")} placeholder={t("profile.lastName")} />
          </FieldGroup>
          <FieldGroup label={t("profile.email")}>
            <Input value={form.email} onChange={set("email")} type="email" placeholder="email@example.com" />
          </FieldGroup>
          <FieldGroup label={t("profile.company")}>
            <Input value={form.company} onChange={set("company")} placeholder={t("profile.company")} />
          </FieldGroup>
          <FieldGroup label={t("profile.orgSize")}>
            <Select value={form.orgSize} onChange={set("orgSize")} options={ORG_SIZES} />
          </FieldGroup>
          <FieldGroup label={t("account.language")}>
            <LanguageInlineSelect />
          </FieldGroup>
        </div>
      </div>

      {/* Preferences (club, competition, creator) */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
          Les teves preferències
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Personalitza el contingut que veus a la plataforma
        </p>
        <div className="grid grid-cols-1 gap-4">
          {[
            { key: "club" as const, label: "Club o organització", placeholder: "p.ex. FC Barcelona, Real Madrid..." },
            { key: "competition" as const, label: "Competició", placeholder: "p.ex. LaLiga, Premier League, NBA..." },
            { key: "creator" as const, label: "Creador de contingut favorit", placeholder: "p.ex. @sportscontentplaybook..." },
          ].map(({ key, label, placeholder }) => (
            <FieldGroup key={key} label={label}>
              <input
                value={prefs[key]}
                onChange={setP(key)}
                placeholder={placeholder}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </FieldGroup>
          ))}
        </div>
      </div>

      {/* Billing address */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-5" style={{ color: "var(--text-primary)" }}>
          {t("profile.billingAddress")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldGroup label={t("profile.street")}>
              <Input value={form.address} onChange={set("address")} placeholder="Carrer de la Llibertat, 14" />
            </FieldGroup>
          </div>
          <FieldGroup label={t("profile.city")}>
            <Input value={form.city} onChange={set("city")} placeholder="Barcelona" />
          </FieldGroup>
          <FieldGroup label={t("profile.postalCode")}>
            <Input value={form.postalCode} onChange={set("postalCode")} placeholder="08001" />
          </FieldGroup>
          <FieldGroup label={t("profile.country")}>
            <Select value={form.country} onChange={set("country")} options={COUNTRIES} />
          </FieldGroup>
          <FieldGroup label={t("profile.vatId")}>
            <Input value={form.vatId} onChange={set("vatId")} placeholder="ES-XXXXXXXXX" />
          </FieldGroup>
        </div>
      </div>

      {/* Password */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{t("profile.password")}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {t("account.keepSecure")}
            </p>
          </div>
          <button
            onClick={() => setChangingPw((v) => !v)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            {changingPw ? t("account.cancel") : t("profile.changePassword")}
          </button>
        </div>

        {changingPw && (
          <div className="grid grid-cols-1 gap-4 mt-2">
            <FieldGroup label={t("profile.currentPassword")}>
              <Input value={pwForm.current} onChange={(v) => setPwForm((f) => ({ ...f, current: v }))} type="password" placeholder="••••••••" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t("profile.newPassword")}>
                <Input value={pwForm.next} onChange={(v) => setPwForm((f) => ({ ...f, next: v }))} type="password" placeholder="••••••••" />
              </FieldGroup>
              <FieldGroup label={t("profile.confirmPassword")}>
                <Input value={pwForm.confirm} onChange={(v) => setPwForm((f) => ({ ...f, confirm: v }))} type="password" placeholder="••••••••" />
              </FieldGroup>
            </div>
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold self-start transition-all hover:opacity-90"
              style={{ background: "var(--selected-bg)", color: "#fff" }}
            >
              {t("profile.updatePassword")}
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: "var(--selected-bg)", color: "#fff" }}
        >
          {saved ? (
            <>
              <CheckIcon />
              {t("account.saved")}
            </>
          ) : fromOnboarding ? (
            "Guardar i continuar →"
          ) : (
            t("profile.saveChanges")
          )}
        </button>
        {saved && !fromOnboarding && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("profile.profileUpdated")}
          </span>
        )}
      </div>
    </div>
  );
}

function LanguageInlineSelect() {
  const { locale, setLocale } = useLanguage();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none appearance-none"
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border-color)",
        color: "var(--text-primary)",
      }}
    >
      {(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([code, label]) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}

function SubscriptionSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const currentPlan = "free";

  const PLANS = [
    {
      id: "free",
      name: "Free",
      monthly: 0,
      annual: 0,
      color: "var(--text-primary)",
      features: [
        "Accés limitat a la Content Library",
        "Filtres bàsics per plataforma",
        "Desa fins a 3 carpetes",
        "Visualització del feed de publicacions",
      ],
      missing: [
        "Filtres avançats i cerca",
        "Newsletter setmanal",
        "Blog i notícies del sector",
        "Exportació CSV",
        "Suport prioritari",
      ],
    },
    {
      id: "basic",
      name: "Basic",
      monthly: 9.99,
      annual: 7.99,
      color: "#0A66C2",
      features: [
        "Accés complet a la Content Library",
        "Filtres avançats i cerca",
        "Carpetes il·limitades",
        "Newsletter setmanal",
        "Blog i notícies del sector",
      ],
      missing: [
        "Exportació CSV",
        "Panell d'idees de contingut",
        "Suport prioritari",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      monthly: 39.99,
      annual: 29.99,
      color: "var(--selected-bg)",
      features: [
        "Tot el de Basic",
        "Panell d'idees de contingut",
        "Exportació CSV",
        "Eines d'administració",
        "Importació massiva de contingut",
        "Suport prioritari",
      ],
      missing: [],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Billing toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl self-start w-fit" style={{ background: "var(--bg-input)" }}>
        {(["monthly", "annual"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: billing === b ? "var(--selected-bg)" : "transparent",
              color: billing === b ? "#fff" : "var(--text-muted)",
            }}
          >
            {b === "monthly" ? "Mensual" : "Anual"}
            {b === "annual" && (
              <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#22C55E", color: "#fff" }}>
                −20%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = billing === "monthly" ? plan.monthly : plan.annual;
          return (
            <div
              key={plan.id}
              className="rounded-2xl p-5 flex flex-col"
              style={{
                border: isCurrent ? `2px solid ${plan.color}` : "1px solid var(--border-color)",
                background: isCurrent ? `rgba(31,41,55,0.04)` : "var(--bg-card)",
                position: "relative",
              }}
            >
              {isCurrent && (
                <span
                  className="absolute -top-3 left-4 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                  style={{ background: plan.color, color: "#fff" }}
                >
                  Pla actual
                </span>
              )}

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                    {price === 0 ? "Gratis" : `€${price}`}
                  </span>
                  {price > 0 && (
                    <span className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                      /mes
                    </span>
                  )}
                </div>
                {billing === "annual" && price > 0 && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Facturat anualment (€{(price * 12).toFixed(0)}/any)
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0" style={{ color: "#22C55E" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{f}</span>
                  </div>
                ))}
                {plan.missing.map((f) => (
                  <div key={f} className="flex items-start gap-2 opacity-40">
                    <span className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                style={{
                  background: isCurrent ? "var(--bg-input)" : "var(--selected-bg)",
                  color: isCurrent ? "var(--text-muted)" : "#fff",
                  border: isCurrent ? "1px solid var(--border-color)" : "none",
                  cursor: isCurrent ? "default" : "pointer",
                }}
                disabled={isCurrent}
              >
                {isCurrent ? "Pla actual" : `Canviar a ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentsSection() {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}
        >
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Payment history
          </h3>
          <button
            className="text-xs font-semibold transition-all hover:underline"
            style={{ color: "var(--selected-bg)" }}
          >
            Download all
          </button>
        </div>

        {/* Payment method */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg text-xs font-black"
              style={{
                width: 40,
                height: 28,
                background: "linear-gradient(135deg, #1a1f71, #2632a0)",
                color: "#fff",
              }}
            >
              VISA
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Visa ending in 4242
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Expires 12/2028</p>
            </div>
          </div>
          <button
            className="text-xs font-semibold transition-all hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Update
          </button>
        </div>

        {/* Invoices */}
        <div style={{ background: "var(--bg-card)" }}>
          {PAYMENT_HISTORY.map((p, i) => (
            <div
              key={p.id}
              className="px-6 py-3.5 flex items-center justify-between"
              style={{
                borderBottom: i < PAYMENT_HISTORY.length - 1 ? "1px solid var(--border-color)" : "none",
              }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {p.plan}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {p.id} · {p.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                >
                  Paid
                </span>
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {p.amount}
                </span>
                <button
                  className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
                  style={{
                    width: 28,
                    height: 28,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-muted)",
                  }}
                  title="Download invoice"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useProfileName() {
  const [name, setName] = useState({ full: "", initials: "" });
  useEffect(() => {
    function load() {
      try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
          const p = JSON.parse(stored);
          const first = (p.name || "").trim();
          const last = (p.surname || "").trim();
          const full = [first, last].filter(Boolean).join(" ") || "My Account";
          const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "ME";
          setName({ full, initials });
        }
      } catch {}
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);
  return name;
}

export default function AccountPage() {
  const [section, setSection] = useState<Section>("profile");
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [fromOnboarding, setFromOnboarding] = useState(false);
  const profileName = useProfileName();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromOnboarding(params.get("from") === "onboarding");
    const tab = params.get("tab");
    if (tab === "subscription") setSection("subscription");
  }, []);

  async function handleSignOut() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  const SECTION_TITLES: Record<Section, { title: string; subtitle: string }> = {
    profile: { title: t("account.myProfile"), subtitle: t("account.profileSubtitle") },
    subscription: { title: t("account.subscriptionTitle"), subtitle: t("account.subscriptionSubtitle") },
    payments: { title: t("account.payments"), subtitle: t("account.paymentsSubtitle") },
  };

  const { title, subtitle } = SECTION_TITLES[section];

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ── MOBILE LAYOUT ── */}
      <div className="flex flex-col md:hidden px-4 pt-6 pb-4">
        {/* Mobile header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center rounded-xl font-black text-sm shrink-0"
            style={{ width: 44, height: 44, background: "var(--selected-bg)", color: "#fff" }}
          >
            {profileName.initials || "ME"}
          </div>
          <div>
            <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>{profileName.full || t("account.myProfile")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("account.proplan")}</p>
          </div>
        </div>

        {/* Mobile tab row */}
        <div className="mb-5">
          <MobileTabNav active={section} onChange={setSection} onSignOut={() => setShowSignOutModal(true)} />
        </div>

        {/* Section title */}
        <div className="mb-5">
          <h1 className="text-lg font-black mb-0.5">{title}</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>

        {/* Content */}
        <div>
          {section === "profile" && <ProfileSection fromOnboarding={fromOnboarding} />}
          {section === "subscription" && <SubscriptionSection />}
          {section === "payments" && <PaymentsSection />}
        </div>
      </div>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-black mb-1">{title}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Left nav */}
          <div
            className="shrink-0 rounded-2xl p-3 sticky top-6"
            style={{
              width: 220,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-center gap-3 px-2 py-3 mb-2">
              <div
                className="flex items-center justify-center rounded-xl font-black text-sm shrink-0"
                style={{ width: 38, height: 38, background: "var(--selected-bg)", color: "#fff" }}
              >
                {profileName.initials || "ME"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {profileName.full || t("account.myProfile")}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  {t("account.proplan")}
                </p>
              </div>
            </div>
            <div className="mb-1 mx-1" style={{ borderTop: "1px solid var(--border-color)" }} />
            <SectionNav active={section} onChange={setSection} onSignOut={() => setShowSignOutModal(true)} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {section === "profile" && <ProfileSection fromOnboarding={fromOnboarding} />}
            {section === "subscription" && <SubscriptionSection />}
            {section === "payments" && <PaymentsSection />}
          </div>
        </div>
      </div>

      {showSignOutModal && (
        <SignOutModal
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutModal(false)}
        />
      )}
    </div>
  );
}


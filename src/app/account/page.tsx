"use client";

import { useState, useEffect } from "react";

type Section = "profile" | "payments" | "subscription" | "photo";

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

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "profile",
    label: "My Profile",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "photo",
    label: "Photo",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: "subscription",
    label: "Plan",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "payments",
    label: "Payments",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
];

function SectionNav({ active, onChange }: { active: Section; onChange: (s: Section) => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all w-full"
            style={{
              background: isActive ? "rgba(245,197,66,0.12)" : "transparent",
              color: isActive ? "#F5C542" : "var(--text-secondary)",
            }}
          >
            <span style={{ color: isActive ? "#F5C542" : "var(--text-muted)" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}

      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all w-full hover:opacity-80"
          style={{ color: "#ef4444" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}

function MobileTabNav({ active, onChange }: { active: Section; onChange: (s: Section) => void }) {
  return (
    <div
      className="flex overflow-x-auto gap-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
            style={{
              background: isActive ? "rgba(245,197,66,0.15)" : "var(--bg-card)",
              border: `1px solid ${isActive ? "rgba(245,197,66,0.4)" : "var(--border-color)"}`,
              color: isActive ? "#F5C542" : "var(--text-secondary)",
            }}
          >
            <span style={{ color: isActive ? "#F5C542" : "var(--text-muted)" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
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

function ProfileSection() {
  const [saved, setSaved] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) setForm(JSON.parse(stored));
    } catch {}
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleSave() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(form)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Personal info */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-5" style={{ color: "var(--text-primary)" }}>
          Personal information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="First name">
            <Input value={form.name} onChange={set("name")} placeholder="First name" />
          </FieldGroup>
          <FieldGroup label="Last name">
            <Input value={form.surname} onChange={set("surname")} placeholder="Last name" />
          </FieldGroup>
          <FieldGroup label="Email address">
            <Input value={form.email} onChange={set("email")} type="email" placeholder="email@example.com" />
          </FieldGroup>
          <FieldGroup label="Company / Club / Organization">
            <Input value={form.company} onChange={set("company")} placeholder="Your organization" />
          </FieldGroup>
          <FieldGroup label="Organization size">
            <Select value={form.orgSize} onChange={set("orgSize")} options={ORG_SIZES} />
          </FieldGroup>
        </div>
      </div>

      {/* Billing address */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-5" style={{ color: "var(--text-primary)" }}>
          Billing address
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldGroup label="Street address">
              <Input value={form.address} onChange={set("address")} placeholder="Carrer de la Llibertat, 14" />
            </FieldGroup>
          </div>
          <FieldGroup label="City">
            <Input value={form.city} onChange={set("city")} placeholder="Barcelona" />
          </FieldGroup>
          <FieldGroup label="Postal code">
            <Input value={form.postalCode} onChange={set("postalCode")} placeholder="08001" />
          </FieldGroup>
          <FieldGroup label="Country">
            <Select value={form.country} onChange={set("country")} options={COUNTRIES} />
          </FieldGroup>
          <FieldGroup label="NIF / VAT ID">
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
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Password</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Keep your account secure
            </p>
          </div>
          <button
            onClick={() => setChangingPw((v) => !v)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            {changingPw ? "Cancel" : "Change password"}
          </button>
        </div>

        {changingPw && (
          <div className="grid grid-cols-1 gap-4 mt-2">
            <FieldGroup label="Current password">
              <Input value={pwForm.current} onChange={(v) => setPwForm((f) => ({ ...f, current: v }))} type="password" placeholder="••••••••" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="New password">
                <Input value={pwForm.next} onChange={(v) => setPwForm((f) => ({ ...f, next: v }))} type="password" placeholder="••••••••" />
              </FieldGroup>
              <FieldGroup label="Confirm password">
                <Input value={pwForm.confirm} onChange={(v) => setPwForm((f) => ({ ...f, confirm: v }))} type="password" placeholder="••••••••" />
              </FieldGroup>
            </div>
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold self-start transition-all hover:opacity-90"
              style={{ background: "#F5C542", color: "#fff" }}
            >
              Update password
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: "#F5C542", color: "#fff" }}
        >
          {saved ? (
            <>
              <CheckIcon />
              Saved!
            </>
          ) : (
            "Save changes"
          )}
        </button>
        {saved && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Your profile has been updated.
          </span>
        )}
      </div>
    </div>
  );
}

function PhotoSection({ initials, fullName }: { initials: string; fullName: string }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
          Profile photo
        </h3>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          This photo will be shown in your dashboard profile.
        </p>

        {/* Current avatar */}
        <div className="flex items-center gap-5 mb-6">
          <div
            className="flex items-center justify-center rounded-2xl font-black text-2xl shrink-0"
            style={{
              width: 80,
              height: 80,
              background: "linear-gradient(135deg, #F5C542, #F5C542)",
              color: "#fff",
            }}
          >
            {initials || "ME"}
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{fullName || "My Account"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP · Max 2 MB</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); }}
          className="rounded-xl flex flex-col items-center justify-center py-10 transition-all cursor-pointer"
          style={{
            border: `2px dashed ${dragging ? "#F5C542" : "var(--border-color)"}`,
            background: dragging ? "rgba(245,197,66,0.05)" : "var(--bg-input)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl mb-3"
            style={{ width: 44, height: 44, background: "rgba(245,197,66,0.1)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5C542" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Drop your photo here
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            or{" "}
            <label
              className="cursor-pointer font-semibold hover:underline"
              style={{ color: "#F5C542" }}
            >
              browse your files
              <input type="file" accept="image/*" className="hidden" />
            </label>
          </p>
        </div>
      </div>
    </div>
  );
}

function SubscriptionSection() {
  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(245,197,66,0.08) 0%, rgba(245,197,66,0.03) 100%)",
          border: "1px solid rgba(245,197,66,0.25)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,197,66,0.15)", color: "#F5C542" }}
              >
                Active
              </span>
            </div>
            <h3 className="font-black text-xl" style={{ color: "var(--text-primary)" }}>
              Pro Plan
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              €29 / month · Renews September 1, 2026
            </p>
          </div>
          <div className="text-right">
            <div className="font-black text-2xl" style={{ color: "#F5C542" }}>€29</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>/month</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {[
            "Full Content Library access",
            "Advanced filters & search",
            "Save & organize content",
            "Weekly newsletter",
            "Blog & industry news",
            "Priority support",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "#F5C542" }}>
                <CheckIcon />
              </span>
              {feature}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{ background: "#F5C542", color: "#fff" }}
          >
            Manage subscription
          </button>
          <button
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
          >
            Cancel plan
          </button>
        </div>
      </div>

      {/* Upgrade options */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
          Upgrade to Team
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Collaborate with your whole sports communication team.
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-black text-lg" style={{ color: "var(--text-primary)" }}>€79</span>
            <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>/month · Up to 10 users</span>
          </div>
          <button
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            View Team plan
          </button>
        </div>
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
            style={{ color: "#F5C542" }}
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
  const profileName = useProfileName();

  const SECTION_TITLES: Record<Section, { title: string; subtitle: string }> = {
    profile: { title: "My Profile", subtitle: "Manage your personal information and billing details" },
    photo: { title: "Profile Photo", subtitle: "Upload or update your avatar" },
    subscription: { title: "Subscription", subtitle: "View and manage your current plan" },
    payments: { title: "Payments", subtitle: "Invoice history and payment method" },
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
            style={{ width: 44, height: 44, background: "#F5C542", color: "#fff" }}
          >
            {profileName.initials || "ME"}
          </div>
          <div>
            <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>{profileName.full || "My Account"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pro plan</p>
          </div>
        </div>

        {/* Mobile tab row */}
        <div className="mb-5">
          <MobileTabNav active={section} onChange={setSection} />
        </div>

        {/* Section title */}
        <div className="mb-5">
          <h1 className="text-lg font-black mb-0.5">{title}</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>

        {/* Content */}
        <div>
          {section === "profile" && <ProfileSection />}
          {section === "photo" && <PhotoSection initials={profileName.initials} fullName={profileName.full} />}
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
                style={{ width: 38, height: 38, background: "#F5C542", color: "#fff" }}
              >
                {profileName.initials || "ME"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {profileName.full || "My Account"}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                  Pro plan
                </p>
              </div>
            </div>
            <div className="mb-1 mx-1" style={{ borderTop: "1px solid var(--border-color)" }} />
            <SectionNav active={section} onChange={setSection} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {section === "profile" && <ProfileSection />}
            {section === "photo" && <PhotoSection initials={profileName.initials} fullName={profileName.full} />}
            {section === "subscription" && <SubscriptionSection />}
            {section === "payments" && <PaymentsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

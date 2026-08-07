"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  createdAt: string;
}

const PLANS = [
  { value: "free", label: "Free", badge: "Free", color: "#6b7280" },
  { value: "basic_monthly", label: "Basic · €9.99/mes", badge: "Basic mensual", color: "#3b82f6" },
  { value: "basic_annual", label: "Basic · €9.99/any", badge: "Basic anual", color: "#3b82f6" },
  { value: "pro_monthly", label: "Pro · €39.99/mes", badge: "Pro mensual", color: "#a855f7" },
  { value: "pro_annual", label: "Pro · €39.99/any", badge: "Pro anual", color: "#a855f7" },
];

function planInfo(plan: string) {
  return PLANS.find((p) => p.value === plan) ?? PLANS[0];
}

const AVATAR_COLORS = ["var(--color-charcoal)", "#3b82f6", "#a855f7", "#10b981", "#f97316", "#ef4444"];
function avatarColor(email: string) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("ca-CA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"app" | "admin">("app");

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [userType, setUserType] = useState<"ROLE_USER" | "ROLE_ADMIN">("ROLE_USER");
  const [plan, setPlan] = useState("free");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const [usersRes, meRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/auth"),
    ]);
    const usersData = await usersRes.json();
    setUsers(usersData.users ?? []);
    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUserId(meData.user?.id ?? null);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: userType,
        plan: userType === "ROLE_USER" ? plan : "free",
      }),
    });
    const data = await res.json();
    if (data.error) { setCreateError(data.error); setCreating(false); return; }
    setEmail(""); setPassword(""); setPlan("free");
    await fetchUsers();
    setCreating(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    await fetchUsers();
    setDeletingId(null);
  }

  const appUsers = users.filter((u) => u.role === "ROLE_USER");
  const adminUsers = users.filter((u) => u.role !== "ROLE_USER");
  const displayed = tab === "app" ? appUsers : adminUsers;

  return (
    <div className="p-8" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Users</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Manage app users and admin access
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-5xl">
        {/* ── Create form ── */}
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>Create new user</h2>

          {/* Type selector */}
          <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: "var(--bg-input)" }}>
            {(["ROLE_USER", "ROLE_ADMIN"] as const).map((r) => {
              const active = userType === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setUserType(r); setCreateError(""); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? "var(--bg-card)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  {r === "ROLE_USER" ? "👤 Usuari" : "🔧 Admin"}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setCreateError(""); }}
                required
                placeholder="usuari@exemple.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid ${createError ? "#ef4444" : "var(--border-color)"}`,
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setCreateError(""); }}
                  required
                  placeholder="Mínim 8 caràcters"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: `1px solid ${createError ? "#ef4444" : "var(--border-color)"}`,
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPass ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Plan selector — only for regular users */}
            {userType === "ROLE_USER" && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                  Pla
                </label>
                <div className="space-y-2">
                  {PLANS.map((p) => {
                    const active = plan === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPlan(p.value)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
                        style={{
                          background: active ? "var(--color-charcoal-subtle)" : "var(--bg-input)",
                          border: `1.5px solid ${active ? "var(--color-charcoal)" : "var(--border-color)"}`,
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: active ? "var(--color-charcoal)" : "var(--text-muted)" }}
                        />
                        <span className="flex-1 font-medium">{p.label}</span>
                        {active && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-charcoal)" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {createError && (
              <p className="text-xs" style={{ color: "#ef4444" }}>{createError}</p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
            >
              {creating ? "Creant..." : "Crear usuari"}
            </button>
          </form>
        </div>

        {/* ── Users list ── */}
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            {([
              { id: "app", label: "Usuaris app", count: appUsers.length },
              { id: "admin", label: "Admins", count: adminUsers.length },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t.id ? "var(--bg-card)" : "transparent",
                  color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {t.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: tab === t.id ? "var(--color-charcoal-subtle)" : "var(--bg-input)",
                    color: tab === t.id ? "var(--color-charcoal)" : "var(--text-muted)",
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
            {/* Header */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5"
              style={{
                gridTemplateColumns: "1fr auto auto auto",
                gap: "1rem",
                background: "var(--bg-secondary)",
                borderBottom: "1px solid var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              <span>Email</span>
              <span>{tab === "app" ? "Pla" : "Rol"}</span>
              <span>Creat</span>
              <span>Accions</span>
            </div>

            {displayed.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                {tab === "app" ? "Cap usuari d'app" : "Cap admin"}
              </div>
            ) : (
              displayed.map((user, i) => {
                const p = planInfo(user.plan);
                return (
                  <div
                    key={user.id}
                    className="grid items-center px-4 py-3"
                    style={{
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: "1rem",
                      borderBottom: i < displayed.length - 1 ? "1px solid var(--border-color)" : "none",
                    }}
                  >
                    {/* Email + avatar */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: avatarColor(user.email) }}
                      >
                        {user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {user.email}
                          </span>
                          {user.id === currentUserId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
                              style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>
                              YOU
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan or Role badge */}
                    {tab === "app" ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wide whitespace-nowrap"
                        style={{ background: `${p.color}1a`, color: p.color }}
                      >
                        {p.badge}
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wide whitespace-nowrap"
                        style={{
                          background: user.role === "ROLE_SUPERADMIN" ? "var(--color-charcoal-subtle)" : "rgba(59,130,246,0.12)",
                          color: user.role === "ROLE_SUPERADMIN" ? "var(--color-charcoal)" : "#3b82f6",
                        }}
                      >
                        {user.role}
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {formatDate(user.createdAt)}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id || user.id === currentUserId}
                      className="p-1.5 rounded transition-all hover:opacity-70 disabled:opacity-25"
                      style={{ color: "var(--text-muted)" }}
                      title={user.id === currentUserId ? "No et pots eliminar tu mateix" : "Eliminar usuari"}
                    >
                      {deletingId === user.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

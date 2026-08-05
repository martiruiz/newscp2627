"use client";

import { useState, useEffect, useCallback } from "react";

interface User { id: string; email: string; name: string | null; role: string; createdAt: string }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error) { setCreateError(data.error); setCreating(false); return; }
    setEmail("");
    setPassword("");
    await fetchUsers();
    setCreating(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    await fetchUsers();
    setDeletingId(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString("ca-CA", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function initials(email: string) {
    return email[0].toUpperCase();
  }

  const AVATAR_COLORS = ["#F5C542", "#3b82f6", "#a855f7", "#10b981", "#f97316", "#ef4444"];
  function avatarColor(email: string) {
    let hash = 0;
    for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  return (
    <div className="p-8" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Users</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Manage admin users who can access the admin panel
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-5xl">
        {/* Create form */}
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h2 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Create new admin</h2>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>New users get ROLE_ADMIN by default</p>

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
                placeholder="admin@example.com"
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
                  placeholder="At least 8 characters"
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

            {createError && (
              <p className="text-xs" style={{ color: "#ef4444" }}>{createError}</p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "#F5C542", color: "#000" }}
            >
              {creating ? "Creating..." : "Create user"}
            </button>
          </form>
        </div>

        {/* Users list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Admin users</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{users.length} users</span>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)" }}
          >
            {/* Table header */}
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
              <span>Roles</span>
              <span>Created</span>
              <span>Actions</span>
            </div>

            {users.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>No users yet</div>
            ) : (
              users.map((user, i) => (
                <div
                  key={user.id}
                  className="grid items-center px-4 py-3"
                  style={{
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: "1rem",
                    borderBottom: i < users.length - 1 ? "1px solid var(--border-color)" : "none",
                  }}
                >
                  {/* Email + avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: avatarColor(user.email) }}
                    >
                      {initials(user.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {user.email}
                        </span>
                        {user.id === currentUserId && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
                            style={{ background: "rgba(200,144,40,0.2)", color: "#F5C542" }}
                          >
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role */}
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wide whitespace-nowrap"
                    style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
                  >
                    {user.role}
                  </span>

                  {/* Date */}
                  <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {formatDate(user.createdAt)}
                  </span>

                  {/* Actions */}
                  <div>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingId === user.id || user.id === currentUserId}
                      className="p-1.5 rounded transition-all hover:opacity-70 disabled:opacity-25"
                      style={{ color: "var(--text-muted)" }}
                      title={user.id === currentUserId ? "Cannot delete yourself" : "Delete user"}
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
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

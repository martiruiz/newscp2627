"use client";

import { useState, useEffect, useCallback } from "react";

interface Pub {
  id: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  rawTitle: string | null;
  platform: string;
  contentFormat: string | null;
  sports: string[];
  isSaved: boolean;
}

interface SavedItem {
  id: string;
  publicationId: string;
  publication: Pub;
}

interface Plan {
  id: string;
  name: string;
  phases?: { id: string; label: string }[];
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>;
  if (p === "tiktok") return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.14 8.14 0 0 0 4.77 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>;
  if (p === "youtube") return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>;
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/></svg>;
}

function MiniCard({
  pub,
  onAdd,
}: {
  pub: Pub;
  onAdd: (pub: Pub) => void;
}) {
  const label = pub.accountUsername || pub.rawTitle || pub.platform;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
        borderBottom: "1px solid var(--border-color)", cursor: "default",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-secondary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        <PlatformIcon platform={pub.platform} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 4, alignItems: "center", marginTop: 1 }}>
          <PlatformIcon platform={pub.platform} />
          <span>{pub.platform}</span>
          {pub.contentFormat && <span>· {pub.contentFormat}</span>}
        </div>
      </div>
      <button
        onClick={() => onAdd(pub)}
        title="Add to plan"
        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  );
}

function QuickAddModal({
  pub,
  onClose,
}: {
  pub: Pub;
  onClose: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((data) => {
        const active = data.filter((p: { archivedAt: string | null }) => !p.archivedAt);
        setPlans(active);
        if (active[0]) setPlanId(active[0].id);
      })
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleAdd() {
    if (!planId) return;
    setSaving(true);
    try {
      const title = pub.accountUsername ? `@${pub.accountUsername} · ${pub.platform}` : `${pub.platform} content`;
      const itemRes = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, plannedDate: date, status: "planned", sourceType: "scp",
          sourceContentId: pub.id, platforms: [pub.platform],
          planId, phaseId: phaseId || null,
          referenceUrl: pub.canonicalUrl, creatorName: pub.accountUsername,
        }),
      });
      const item = await itemRes.json();
      if (item.id) {
        await fetch("/api/content-references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarItemId: item.id, publicationId: pub.id }),
        });
      }
      setDone(true);
    } catch { /* non-critical */ }
    setSaving(false);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)",
    background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-primary)", borderRadius: 14, width: "100%", maxWidth: 380, border: "1px solid var(--border-color)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add to plan</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ margin: "0 auto 8px", display: "block" }}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Added!</p>
            <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <div>
              <label style={lbl}>Plan</label>
              <select value={planId} onChange={(e) => { setPlanId(e.target.value); setPhaseId(""); }} style={{ ...inp, appearance: "auto" }}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {selectedPlan?.phases && selectedPlan.phases.length > 0 && (
              <div>
                <label style={lbl}>Phase</label>
                <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={{ ...inp, appearance: "auto" }}>
                  <option value="">— No specific phase —</option>
                  {selectedPlan.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Planned date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
            </div>
            <button onClick={handleAdd} disabled={!planId || saving} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: planId ? "#0D1421" : "var(--bg-secondary)", color: planId ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: planId ? "pointer" : "default" }}>
              {saving ? "Adding…" : "Add to plan"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface InspirationPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function InspirationPanel({ open, onClose }: InspirationPanelProps) {
  const [tab, setTab] = useState<"saved" | "library">("saved");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [library, setLibrary] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(false);
  const [addPub, setAddPub] = useState<Pub | null>(null);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/saved");
      const data = await r.json();
      setSaved(Array.isArray(data.posts) ? data.posts : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadLibrary = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (q) params.set("q", q);
      const r = await fetch(`/api/publications?${params}`);
      const data = await r.json();
      setLibrary(Array.isArray(data.publications) ? data.publications : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (tab === "saved") loadSaved();
    else loadLibrary(search);
  }, [open, tab, loadSaved, loadLibrary, search]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: open ? 0 : -360,
    width: 340,
    height: "100dvh",
    background: "var(--bg-primary)",
    borderLeft: "1px solid var(--border-color)",
    zIndex: 500,
    display: "flex",
    flexDirection: "column",
    transition: "right 0.28s cubic-bezier(0.4,0,0.2,1)",
    boxShadow: open ? "-4px 0 24px rgba(0,0,0,0.15)" : "none",
  };

  const savedPubs: Pub[] = saved.map((s) => ({ ...s.publication, id: s.publicationId }));
  const items = tab === "saved" ? savedPubs : library;
  const filtered = search
    ? items.filter((p) =>
        (p.accountUsername || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.rawTitle || "").toLowerCase().includes(search.toLowerCase()) ||
        p.platform.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <>
      {open && <div style={{ position: "fixed", inset: 0, zIndex: 499 }} onClick={onClose} />}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ padding: "14px 16px 0", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Inspiration</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
            {(["saved", "library"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(""); }}
                style={{ flex: 1, padding: "8px 0", background: "none", border: "none", borderBottom: tab === t ? "2px solid #0D1421" : "2px solid transparent", fontSize: 12, fontWeight: tab === t ? 700 : 500, color: tab === t ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer", textTransform: "capitalize" }}
              >
                {t === "saved" ? "Saved" : "Library"}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                {tab === "saved" ? "No saved content yet." : "No results."}
              </p>
              {tab === "saved" && (
                <a href="/feed" style={{ fontSize: 12, color: "var(--accent-blue)", marginTop: 8, display: "inline-block" }}>Browse Library →</a>
              )}
            </div>
          )}
          {!loading && filtered.map((pub) => (
            <MiniCard key={pub.id} pub={pub} onAdd={(p) => setAddPub(p)} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-color)", flexShrink: 0 }}>
          <a
            href={tab === "saved" ? "/feed?saved=true" : "/feed"}
            style={{ display: "block", textAlign: "center", fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
          >
            {tab === "saved" ? "Open Saved →" : "Open Library →"}
          </a>
        </div>
      </div>

      {addPub && <QuickAddModal pub={addPub} onClose={() => setAddPub(null)} />}
    </>
  );
}

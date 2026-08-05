"use client";

import { useState, useEffect, useRef } from "react";

interface Folder {
  id: string;
  name: string;
  count: number;
}

interface Props {
  publicationId: string;
  isSaved: boolean;
  onClose: () => void;
  onSaved: (saved: boolean) => void;
}

export default function FolderPickerModal({ publicationId, isSaved, onClose, onSaved }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [unsaving, setUnsaving] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => { setFolders(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const filtered = folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  async function saveToFolder(folderId: string) {
    setSavingId(folderId);
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicationId, folderId }),
    });
    setSavingId(null);
    onSaved(true);
    onClose();
  }

  async function saveGeneral() {
    setUnsaving(true);
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicationId }),
    });
    const data = await res.json();
    onSaved(data.saved);
    setUnsaving(false);
    onClose();
  }

  async function createFolder() {
    if (!newName.trim()) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders((prev) => [folder, ...prev]);
      setNewName("");
      setCreating(false);
      await saveToFolder(folder.id);
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)", borderRadius: 16, width: 360, maxWidth: "92vw",
          border: "1px solid var(--border-color)", overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Save to folder</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ position: "relative" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              style={{
                width: "100%", padding: "7px 10px 7px 32px", borderRadius: 8, fontSize: 13,
                background: "var(--bg-input)", border: "1px solid var(--border-color)",
                color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Folder list */}
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {search ? "No folders match" : "No folders yet"}
            </div>
          ) : (
            filtered.map((folder) => (
              <button
                key={folder.id}
                onClick={() => saveToFolder(folder.id)}
                disabled={savingId === folder.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                  textAlign: "left", color: "var(--text-primary)",
                  borderBottom: "1px solid var(--border-color)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(200,144,40,0.15)" stroke="#F5C542" strokeWidth="1.8">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, truncate: "ellipsis" }}>{folder.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{folder.count} items</div>
                </div>
                {savingId === folder.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                )}
              </button>
            ))
          )}
        </div>

        {/* Create new folder */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-color)" }}>
          {creating ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Folder name…"
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 13,
                  background: "var(--bg-input)", border: "1px solid var(--border-color)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
              <button
                onClick={createFolder}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#F5C542", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                style={{ padding: "7px 10px", borderRadius: 8, fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setCreating(true)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(200,144,40,0.1)",
                  border: "1px solid rgba(200,144,40,0.3)", color: "#F5C542", cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                New folder
              </button>
              {isSaved && (
                <button
                  onClick={saveGeneral}
                  disabled={unsaving}
                  style={{
                    padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444", cursor: "pointer",
                  }}
                >
                  Unsave
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

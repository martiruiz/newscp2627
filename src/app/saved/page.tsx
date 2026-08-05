"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import PublicationCard from "@/components/PublicationCard";

interface Folder {
  id: string;
  name: string;
  count: number;
  createdAt: string;
}

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  sport: string | null;
  entityType: string | null;
  entityName: string | null;
  contentFormat: string | null;
  competitions: string[];
  classifications: string[];
  isSaved: boolean;
}

function FolderCard({
  folder,
  onClick,
  onRename,
  onDelete,
  onShare,
}: {
  folder: Folder;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(folder.name);
  }, [folder.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function submitRename() {
    if (name.trim() && name.trim() !== folder.name) onRename(name.trim());
    else setName(folder.name);
    setEditing(false);
  }

  return (
    <div
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border-color)",
        borderRadius: 16, padding: 20, cursor: "pointer", position: "relative",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Folder icon */}
      <div onClick={onClick}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, marginBottom: 14,
          background: "rgba(200,144,40,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(200,144,40,0.3)" stroke="#F5C542" strokeWidth="1.6">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>

        {/* Name */}
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") { setName(folder.name); setEditing(false); } }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 15, fontWeight: 700, color: "var(--text-primary)", background: "var(--bg-input)",
              border: "1px solid #F5C542", borderRadius: 6, padding: "2px 6px", width: "100%",
              outline: "none", marginBottom: 4,
            }}
          />
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, wordBreak: "break-word" }}>
            {folder.name}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{folder.count} items</div>
      </div>

      {/* Menu button */}
      <div ref={menuRef} style={{ position: "absolute", top: 12, right: 12 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          style={{
            width: 28, height: 28, borderRadius: 8, background: menuOpen ? "var(--bg-input)" : "transparent",
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", right: 0, top: 32, background: "var(--bg-card)",
            border: "1px solid var(--border-color)", borderRadius: 10, minWidth: 160, zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
          }}>
            {[
              { label: "Rename", icon: "✏️", action: () => { setEditing(true); setMenuOpen(false); } },
              { label: "Share via WhatsApp", icon: "💬", action: () => { onShare(); setMenuOpen(false); } },
              { label: "Share via Email", icon: "📧", action: () => { onShare(); setMenuOpen(false); } },
              { label: "Delete folder", icon: "🗑️", action: () => { onDelete(); setMenuOpen(false); }, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={(e) => { e.stopPropagation(); item.action(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13,
                  color: (item as { danger?: boolean }).danger ? "#ef4444" : "var(--text-primary)",
                  borderBottom: item.label !== "Delete folder" ? "1px solid var(--border-color)" : "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MasonryGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  const cols: React.ReactNode[][] = [[], [], []];
  items.forEach((item, i) => cols[i % 3].push(item));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-4">{col}</div>
      ))}
    </div>
  );
}

export default function SavedPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [openFolder, setOpenFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderPubs, setFolderPubs] = useState<Publication[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(false);
  const readyUpTo = useRef(0);
  const loadedSet = useRef(new Set<string>());

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    const data = await res.json();
    setFolders(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const openFolderView = useCallback(async (id: string, name: string) => {
    setOpenFolder({ id, name });
    setLoadingPubs(true);
    const res = await fetch(`/api/folders/${id}/posts`);
    const data = await res.json();
    setFolderPubs(data.publications ?? []);
    setLoadingPubs(false);
  }, []);

  async function createFolder() {
    if (!newName.trim()) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setCreating(false);
      await loadFolders();
    }
  }

  async function renameFolder(id: string, name: string) {
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await loadFolders();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and all its saved items?")) return;
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (openFolder?.id === id) setOpenFolder(null);
    await loadFolders();
  }

  function shareFolder(folder: Folder) {
    const text = `Check out my "${folder.name}" folder with ${folder.count} items on SCP Nova`;
    const url = `${window.location.origin}/saved`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(folder.name)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
    // Show quick share dialog
    const choice = window.confirm("Share via WhatsApp? (Cancel = Email)");
    window.open(choice ? whatsappUrl : emailUrl, "_blank");
  }

  const filtered = folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  /* ── FOLDER DETAIL VIEW ─────────────────────────────────────────── */
  if (openFolder) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)", padding: "24px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Back button */}
          <button
            onClick={() => setOpenFolder(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 20, background: "none", border: "none",
              cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            All folders
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "rgba(200,144,40,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(200,144,40,0.3)" stroke="#F5C542" strokeWidth="1.6">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{openFolder.name}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{folderPubs.length} items</p>
            </div>
          </div>

          {loadingPubs ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
          ) : folderPubs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>This folder is empty.</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Save content from the Content Library.</p>
            </div>
          ) : (
            <MasonryGrid>
              {folderPubs.map((pub, i) => (
                <PublicationCard
                  key={`${pub.platform}-${pub.externalPostId}`}
                  publication={pub}
                  animationDelay={i * 60}
                  shouldAnimate={true}
                  onLoaded={() => {}}
                />
              ))}
            </MasonryGrid>
          )}
        </div>
      </div>
    );
  }

  /* ── FOLDER GRID VIEW ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Saved</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {folders.length} folder{folders.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10,
              background: "#F5C542", color: "#fff", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, boxShadow: "0 2px 12px rgba(200,144,40,0.3)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New folder
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search folders…"
            style={{
              width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10, fontSize: 14,
              background: "var(--bg-card)", border: "1px solid var(--border-color)",
              color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Create new folder inline */}
        {creating && (
          <div style={{
            display: "flex", gap: 8, marginBottom: 16, padding: 16, borderRadius: 12,
            background: "var(--bg-card)", border: "1px solid rgba(200,144,40,0.4)",
          }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Folder name…"
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14,
                background: "var(--bg-input)", border: "1px solid var(--border-color)",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            <button
              onClick={createFolder}
              style={{ padding: "8px 18px", borderRadius: 8, background: "#F5C542", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Folder grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {search ? "No folders match" : "No folders yet"}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {search ? "Try a different search." : "Create a folder and start saving content from the Content Library."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onClick={() => openFolderView(folder.id, folder.name)}
                onRename={(name) => renameFolder(folder.id, name)}
                onDelete={() => deleteFolder(folder.id)}
                onShare={() => shareFolder(folder)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

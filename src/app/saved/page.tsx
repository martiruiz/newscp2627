"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PublicationCard from "@/components/PublicationCard";

interface Folder {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  coverPlatforms: string[];
  coverImages: (string | null)[];
}

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  originalUrl: string | null;
  sports: string[];
  entityTypes: string[];
  entityName: string | null;
  contentFormat: string | null;
  competitions: string[];
  classifications: string[];
  isSaved: boolean;
}

const PLATFORM_GRADIENTS: Record<string, string> = {
  Instagram: "linear-gradient(135deg,#833AB4,#C13584,#F56040)",
  TikTok:    "linear-gradient(135deg,#010101,#1a1a2e,#69C9D0)",
  YouTube:   "linear-gradient(135deg,#FF0000,#CC0000)",
  LinkedIn:  "linear-gradient(135deg,#0A66C2,#084d8f)",
  X:         "linear-gradient(135deg,#14171A,#2d3748)",
  Facebook:  "linear-gradient(135deg,#1877F2,#0c5cc7)",
  Snapchat:  "linear-gradient(135deg,#FFFC00,#f0d800)",
  Threads:   "linear-gradient(135deg,#000000,#333)",
  Reddit:    "linear-gradient(135deg,#FF4500,#cc3700)",
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  Instagram: <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  TikTok:    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  YouTube:   <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  LinkedIn:  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  X:         <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  Facebook:  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
};

function FolderCover({ platforms, images }: { platforms: string[]; images: (string | null)[] }) {
  const cells = [0, 1, 2, 3];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", aspectRatio: "1", borderRadius: "15px 15px 0 0", overflow: "hidden" }}>
      {cells.map((i) => {
        const plat = platforms[i];
        const img = images?.[i];
        return (
          <div
            key={i}
            style={{
              background: plat ? PLATFORM_GRADIENTS[plat] ?? "linear-gradient(135deg,#2d3748,#1a202c)" : "var(--bg-input)",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: i % 2 === 0 ? "1px solid rgba(0,0,0,0.15)" : "none",
              borderBottom: i < 2 ? "1px solid rgba(0,0,0,0.15)" : "none",
              position: "relative", overflow: "hidden",
            }}
          >
            {img
              ? <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              : plat && <span style={{ opacity: 0.7 }}>{PLATFORM_ICONS[plat]}</span>
            }
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "Today";
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

function FolderCard({
  folder,
  onClick,
  onRename,
  onDelete,
}: {
  folder: Folder;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(folder.name); }, [folder.name]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
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
      onClick={onClick}
      style={{
        borderRadius: 16, overflow: "visible", cursor: "pointer",
        background: "var(--bg-card)", border: "1px solid var(--border-color)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
        zIndex: menuOpen ? 100 : "auto",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <FolderCover platforms={folder.coverPlatforms} images={folder.coverImages ?? []} />

      <div style={{ padding: "12px 14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") { setName(folder.name); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
                background: "var(--bg-input)", border: "1px solid #1F2937",
                borderRadius: 6, padding: "2px 6px", width: "100%", outline: "none",
              }}
            />
          ) : (
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {folder.name}
            </p>
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
            {folder.count} {folder.count === 1 ? "item" : "items"} · {timeAgo(folder.createdAt)}
          </p>
        </div>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: menuOpen ? "var(--bg-input)" : "transparent",
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
              position: "absolute", right: 0, top: 34, background: "var(--bg-card)",
              border: "1px solid var(--border-color)", borderRadius: 10, minWidth: 180, zIndex: 9999,
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)", overflow: "hidden",
            }}>
              {[
                {
                  label: "Share via email",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                  action: () => {
                    const url = `${window.location.origin}/saved`;
                    const subject = encodeURIComponent(`Check out my "${folder.name}" folder`);
                    const body = encodeURIComponent(`Hi,\n\nI wanted to share my "${folder.name}" folder with you on Sports Content Playbook.\n\nYou can view it here: ${url}\n\nBest,`);
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                    setMenuOpen(false);
                  },
                },
                {
                  label: "Rename",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                  action: () => { setEditing(true); setMenuOpen(false); },
                },
                {
                  label: "Delete folder",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
                  action: () => { onDelete(); setMenuOpen(false); },
                  danger: true,
                },
              ].map((item, idx, arr) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13,
                    color: (item as { danger?: boolean }).danger ? "#ef4444" : "var(--text-primary)",
                    borderBottom: idx < arr.length - 1 ? "1px solid var(--border-color)" : "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ opacity: 0.7, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        background: "var(--bg-card)", border: "2px dashed var(--border-color)",
        transition: "border-color 0.15s, transform 0.15s",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--selected-bg)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-color)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{
        aspectRatio: "1", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "var(--color-charcoal-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--selected-bg)" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--selected-bg)", margin: 0 }}>New folder</p>
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

function useProfileName() {
  const [profile, setProfile] = useState({ full: "", initials: "ME", company: "" });
  useEffect(() => {
    try {
      const stored = localStorage.getItem("scp-account-profile");
      if (stored) {
        const p = JSON.parse(stored);
        const first = (p.name || "").trim();
        const last = (p.surname || "").trim();
        const full = [first, last].filter(Boolean).join(" ");
        const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "ME";
        setProfile({ full: full || "My Account", initials, company: (p.company || "").trim() });
      }
    } catch {}
  }, []);
  return profile;
}

function useProfilePhoto() {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("scp-account-photo");
      if (stored) setPhoto(stored);
    } catch {}
  }, []);
  return photo;
}

export default function SavedPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [openFolder, setOpenFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderPubs, setFolderPubs] = useState<Publication[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);
  const profile = useProfileName();
  const photo = useProfilePhoto();

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    const data = await res.json();
    setFolders(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { if (creating) newNameRef.current?.focus(); }, [creating]);

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
    if (res.ok) { setNewName(""); setCreating(false); await loadFolders(); }
  }

  async function renameFolder(id: string, name: string) {
    await fetch(`/api/folders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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

  /* ── FOLDER DETAIL VIEW ── */
  if (openFolder) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)", padding: "24px 20px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <button
            onClick={() => setOpenFolder(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 24,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            All folders
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{openFolder.name}</h1>
            <span style={{ fontSize: 13, color: "var(--text-muted)", paddingTop: 4 }}>{folderPubs.length} items</span>
          </div>

          {loadingPubs ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
          ) : folderPubs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>This folder is empty</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Save content from the Content Library.</p>
            </div>
          ) : (
            <MasonryGrid>
              {folderPubs.map((pub, i) => (
                <PublicationCard
                  key={`${pub.platform}-${pub.externalPostId}`}
                  publication={pub}
                  animationDelay={i * 60}
                  shouldAnimate
                  onLoaded={() => {}}
                />
              ))}
            </MasonryGrid>
          )}
        </div>
      </div>
    );
  }

  /* ── FOLDER GRID VIEW ── */
  const totalItems = folders.reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40, gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 6px" }}>
              Your saved ideas
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              {folders.length} folder{folders.length !== 1 ? "s" : ""} · {totalItems} items
            </p>
          </div>

          {/* Profile card */}
          <Link href="/account" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 16,
              background: "var(--bg-card)", border: "1px solid var(--border-color)", flexShrink: 0,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(31,41,55,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
            >
              <div style={{
                width: 46, height: 46, borderRadius: "50%", overflow: "hidden",
                background: "linear-gradient(135deg,#1F2937,#111827)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: "#fff",
              }}>
                {photo
                  ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : profile.initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap" }}>
                  {profile.full || "My Account"}
                </p>
                {profile.company && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{profile.company}</p>
              )}
              </div>
            </div>
          </Link>
        </div>

        {/* New folder input */}
        {creating && (
          <div style={{
            display: "flex", gap: 8, marginBottom: 24, padding: 16, borderRadius: 14,
            background: "var(--bg-card)", border: "1px solid rgba(31,41,55,0.35)",
          }}>
            <input
              ref={newNameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Folder name…"
              style={{
                flex: 1, padding: "9px 14px", borderRadius: 10, fontSize: 14,
                background: "var(--bg-input)", border: "1px solid var(--border-color)",
                color: "var(--text-primary)", outline: "none",
              }}
            />
            <button
              onClick={createFolder}
              style={{ padding: "9px 20px", borderRadius: 10, background: "var(--selected-bg)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              style={{ padding: "9px 14px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border-color)", aspectRatio: "0.85" }} className="animate-pulse" />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No folders yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>Create a folder and start saving content from the Content Library.</p>
            <button
              onClick={() => setCreating(true)}
              style={{ padding: "10px 24px", borderRadius: 12, background: "var(--selected-bg)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
            >
              Create first folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onClick={() => openFolderView(folder.id, folder.name)}
                onRename={(name) => renameFolder(folder.id, name)}
                onDelete={() => deleteFolder(folder.id)}
              />
            ))}
            <CreateCard onClick={() => setCreating(true)} />
          </div>
        )}
      </div>
    </div>
  );
}

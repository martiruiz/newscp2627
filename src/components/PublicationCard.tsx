"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import InstagramEmbed from "./InstagramEmbed";
import YouTubeFeedEmbed from "./YouTubeFeedEmbed";
import TikTokFeedEmbed from "./TikTokFeedEmbed";
import TwitterEmbed from "./TwitterEmbed";
import LinkedInEmbed from "./LinkedInEmbed";
import FacebookEmbed from "./FacebookEmbed";
import FolderPickerModal from "./FolderPickerModal";
import { getPlatformLogo } from "./SocialLogos";

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  originalUrl: string | null;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  sports: string[];
  entityTypes: string[];
  entityName: string | null;
  contentFormat: string | null;
  competitions: string[];
  classifications: string[];
  isSaved: boolean;
}

interface PublicationCardProps {
  publication: Publication;
  animationDelay?: number;
  shouldAnimate?: boolean;
  onLoaded?: () => void;
  eager?: boolean;
}

function buildProfileUrl(platform: string, username: string): string {
  switch (platform.toLowerCase()) {
    case "youtube": return `https://www.youtube.com/@${username}`;
    case "tiktok": return `https://www.tiktok.com/@${username}`;
    case "twitter": case "x": return `https://x.com/${username}`;
    case "facebook": return `https://www.facebook.com/${username}`;
    case "linkedin": return `https://www.linkedin.com/in/${username}`;
    case "pinterest": return `https://www.pinterest.com/${username}/`;
    default: return `https://www.instagram.com/${username}/`;
  }
}

function EmbedSkeleton({ height = 380 }: { height?: number }) {
  return (
    <div className="embed-skeleton" style={{ minHeight: height, borderRadius: 8 }}>
      <div style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="embed-skeleton-line" style={{ width: 38, height: 38, borderRadius: "50%" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="embed-skeleton-line" style={{ height: 11, width: "40%" }} />
            <div className="embed-skeleton-line" style={{ height: 10, width: "26%" }} />
          </div>
        </div>
        <div className="embed-skeleton-line" style={{ height: height - 120, borderRadius: 8 }} />
      </div>
    </div>
  );
}

function PinterestEmbed({ embedSrc, onLoaded }: { embedSrc: string; onLoaded?: () => void }) {
  const [loading, setLoading] = useState(true);
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", background: "var(--bg-input)", position: "relative" }}>
      {loading && <EmbedSkeleton height={500} />}
      <iframe
        src={embedSrc}
        style={{ border: "none", display: loading ? "none" : "block", width: "100%", maxWidth: 450, minHeight: 500 }}
        scrolling="no"
        title="Pinterest pin"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        onLoad={() => { setLoading(false); onLoaded?.(); }}
      />
    </div>
  );
}

function isFullWidth(platform: string): boolean {
  const p = platform.toLowerCase();
  return p === "youtube" || p === "tiktok";
}

function PlatformEmbed({
  publication,
  onLoaded,
  eager,
}: {
  publication: Publication;
  onLoaded?: () => void;
  eager?: boolean;
}) {
  const platform = publication.platform.toLowerCase();

  if (platform === "youtube") {
    const isShort = publication.canonicalUrl.includes("/shorts/");
    return (
      <YouTubeFeedEmbed
        videoId={publication.externalPostId}
        embedUrl={publication.embedUrl}
        title={publication.contentFormat}
        onLoaded={onLoaded}
        isShort={isShort}
      />
    );
  }

  if (platform === "tiktok") {
    return (
      <TikTokFeedEmbed
        videoId={publication.externalPostId}
        canonicalUrl={publication.canonicalUrl}
        onLoaded={onLoaded}
      />
    );
  }

  if (platform === "instagram") {
    return (
      <InstagramEmbed
        shortcode={publication.externalPostId}
        canonicalUrl={publication.canonicalUrl}
        platform={publication.platform}
        onLoaded={onLoaded}
        eager={eager}
      />
    );
  }

  if (platform === "twitter" || platform === "x") {
    return (
      <TwitterEmbed
        tweetId={publication.externalPostId}
        canonicalUrl={publication.canonicalUrl}
        onLoaded={onLoaded}
      />
    );
  }

  if (platform === "linkedin") {
    return (
      <LinkedInEmbed
        originalUrl={publication.originalUrl || publication.canonicalUrl}
        canonicalUrl={publication.canonicalUrl}
        onLoaded={onLoaded}
      />
    );
  }

  if (platform === "facebook") {
    return (
      <FacebookEmbed
        originalUrl={publication.originalUrl || publication.canonicalUrl}
        canonicalUrl={publication.canonicalUrl}
        onLoaded={onLoaded}
      />
    );
  }

  if (platform === "pinterest") {
    const pinId = publication.externalPostId;
    const embedSrc = `https://assets.pinterest.com/ext/embed.html?id=${pinId}`;
    return <PinterestEmbed embedSrc={embedSrc} onLoaded={onLoaded} />;
  }

  // Fallback for unknown platforms
  const Logo = getPlatformLogo(platform);
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      onLoaded?.();
    }
  }, [onLoaded]);
  return (
    <div className="embed-unavailable">
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "rgba(128,128,128,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Logo size={22} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, margin: 0 }}>
          Post no disponible
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "4px 0 0" }}>
          El contingut ha estat eliminat o és privat
        </p>
      </div>
      <a
        href={publication.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 4, opacity: 0.85,
        }}
      >
        Veure a {publication.platform}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  );
}

const CLASSIFICATION_META: Record<string, { gradient: string; icon: React.ReactNode; title: string }> = {
  "Top Picks": {
    gradient: "linear-gradient(135deg, #E8567A 0%, #A82346 100%)",
    title: "Top Picks",
    icon: (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  "Overperforming": {
    gradient: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)",
    title: "Overperforming",
    icon: (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  "Replicable Ideas": {
    gradient: "linear-gradient(135deg, #52D68A 0%, #1B8A4E 100%)",
    title: "Replicable Ideas",
    icon: (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    ),
  },
};

function AddToPlanModal({ publication, onClose }: { publication: Publication; onClose: () => void }) {
  const [plans, setPlans] = useState<{ id: string; name: string; type: string; phases?: { id: string; label: string }[] }[]>([]);
  const [planId, setPlanId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/plans").then((r) => r.json()).then((data) => {
      setPlans(data.filter((p: { archivedAt: string | null }) => !p.archivedAt));
      if (data[0]) setPlanId(data[0].id);
    }).catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleAdd() {
    if (!planId) return;
    setSaving(true);
    try {
      const title = publication.accountUsername
        ? `@${publication.accountUsername} · ${publication.platform}`
        : `${publication.platform} content`;
      const itemRes = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          plannedDate: date,
          status: "planned",
          sourceType: "scp",
          sourceContentId: publication.id,
          platforms: [publication.platform],
          planId: planId || null,
          phaseId: phaseId || null,
          referenceUrl: publication.canonicalUrl,
          thumbnailUrl: null,
          creatorName: publication.accountUsername,
          sport: publication.sports?.[0] || null,
          contentFormat: publication.contentFormat || null,
        }),
      });
      const item = await itemRes.json();
      if (item.id) {
        await fetch("/api/content-references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarItemId: item.id, publicationId: publication.id }),
        });
      }
      setDone(true);
    } catch { /* non-critical */ }
    setSaving(false);
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const modal: React.CSSProperties = {
    background: "var(--bg-primary)", borderRadius: 16, width: "100%", maxWidth: 400,
    border: "1px solid var(--border-color)", padding: 24, display: "flex", flexDirection: "column", gap: 16,
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)",
    background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add to plan</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ margin: "0 0 16px", color: "var(--text-primary)", fontWeight: 600 }}>Added to plan!</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border-color)", background: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
              <a href="/calendar?tab=plans" style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0D1421", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>View plan</a>
            </div>
          </div>
        ) : (
          <>
            {publication.accountUsername && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/></svg>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>@{publication.accountUsername} · {publication.platform}</span>
              </div>
            )}
            <div>
              <label style={lbl}>Plan</label>
              <select value={planId} onChange={(e) => { setPlanId(e.target.value); setPhaseId(""); }} style={{ ...inp, appearance: "auto" }}>
                <option value="">Select a plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {selectedPlan?.phases && selectedPlan.phases.length > 0 && (
              <div>
                <label style={lbl}>Phase (optional)</label>
                <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={{ ...inp, appearance: "auto" }}>
                  <option value="">No specific phase</option>
                  {selectedPlan.phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>{ph.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Planned date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
            </div>
            <button
              onClick={handleAdd}
              disabled={!planId || saving}
              style={{ padding: "11px 0", borderRadius: 10, border: "none", background: planId ? "#0D1421" : "var(--bg-secondary)", color: planId ? "#fff" : "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: planId ? "pointer" : "default", transition: "opacity 0.15s" }}
            >
              {saving ? "Adding…" : "Add to plan"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PublicationCard({ publication, animationDelay = 0, shouldAnimate = false, onLoaded, eager = false }: PublicationCardProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(!shouldAnimate);
  const [isSaved, setIsSaved] = useState(publication.isSaved);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) return;
    const timer = setTimeout(() => setVisible(true), animationDelay);
    return () => clearTimeout(timer);
  }, [shouldAnimate, animationDelay]);

  const handleSave = useCallback(() => {
    setShowFolderPicker(true);
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden group/card"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out, box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 20px 60px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.3)";
        el.style.borderColor = "rgba(31,41,55,0.25)";
        el.style.transition = "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--border-color)";
        el.style.transition = "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease";
      }}
    >
      <div data-tutorial="card-save-area" className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {publication.accountUsername && (
            <a
              href={buildProfileUrl(publication.platform, publication.accountUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {publication.accountUsername}
            </a>
          )}
          {publication.entityName && publication.entityName !== publication.accountUsername && (
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {publication.entityName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {publication.classifications.map((cls) => {
            const meta = CLASSIFICATION_META[cls];
            if (!meta) return null;
            return (
              <span
                key={cls}
                title={meta.title}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: meta.gradient,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {meta.icon}
              </span>
            );
          })}
          <button
            onClick={() => setShowAddToPlan(true)}
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            title="Add to plan"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="17"/><line x1="10" y1="15" x2="14" y2="15"/>
            </svg>
          </button>
          <button
            onClick={() => {
              try { sessionStorage.setItem("scp-pending-calendar-pub", JSON.stringify(publication)); } catch {}
              if (window.location.pathname === "/calendar") {
                window.dispatchEvent(new CustomEvent("open-calendar-add", { detail: { publication } }));
              } else {
                router.push("/calendar");
              }
            }}
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            title="Add to calendar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="15" x2="12" y2="19"/><line x1="10" y1="17" x2="14" y2="17"/>
            </svg>
          </button>
          <button
            onClick={handleSave}
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            title={isSaved ? "Saved" : "Save"}
          >
            {isSaved ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent-blue)" stroke="var(--accent-blue)" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="pb-1" style={{ paddingLeft: isFullWidth(publication.platform) ? 0 : 4, paddingRight: isFullWidth(publication.platform) ? 0 : 4 }}>
        <PlatformEmbed publication={publication} onLoaded={onLoaded} eager={eager} />
      </div>
      {showFolderPicker && (
        <FolderPickerModal
          publicationId={publication.id}
          isSaved={isSaved}
          onClose={() => setShowFolderPicker(false)}
          onSaved={(saved) => setIsSaved(saved)}
        />
      )}
      {showAddToPlan && (
        <AddToPlanModal publication={publication} onClose={() => setShowAddToPlan(false)} />
      )}
    </div>
  );
}

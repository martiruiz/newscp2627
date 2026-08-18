"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export default function PublicationCard({ publication, animationDelay = 0, shouldAnimate = false, onLoaded, eager = false }: PublicationCardProps) {
  const [visible, setVisible] = useState(!shouldAnimate);
  const [isSaved, setIsSaved] = useState(publication.isSaved);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

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
    </div>
  );
}

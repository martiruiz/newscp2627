"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import InstagramEmbed from "./InstagramEmbed";
import YouTubeFeedEmbed from "./YouTubeFeedEmbed";
import TikTokFeedEmbed from "./TikTokFeedEmbed";
import TwitterEmbed from "./TwitterEmbed";
import LinkedInEmbed from "./LinkedInEmbed";
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
  sport: string | null;
  entityType: string | null;
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
    default: return `https://www.instagram.com/${username}/`;
  }
}

function FacebookEmbedInline({
  originalUrl,
  canonicalUrl,
  onLoaded,
}: {
  originalUrl: string;
  canonicalUrl: string;
  onLoaded?: () => void;
}) {
  const notifiedRef = useRef(false);
  const [errored, setErrored] = useState(false);
  const notify = useCallback(() => {
    if (!notifiedRef.current) { notifiedRef.current = true; onLoaded?.(); }
  }, [onLoaded]);

  const isFb = originalUrl.includes("facebook.com");
  const embedUrl = isFb
    ? `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(originalUrl)}&show_text=true&width=500`
    : null;

  if (!embedUrl || errored) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, background: "var(--bg-input)", minHeight: 180 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8, background: "#1877F2", color: "#fff", textDecoration: "none" }}>View on Facebook</a>
      </div>
    );
  }

  return (
    <iframe
      src={embedUrl}
      style={{ border: "none", display: "block", width: "100%", minHeight: 500 }}
      scrolling="no"
      title="Facebook post"
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
      onLoad={notify}
      onError={() => { setErrored(true); notify(); }}
    />
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
    return (
      <YouTubeFeedEmbed
        videoId={publication.externalPostId}
        embedUrl={publication.embedUrl}
        title={publication.contentFormat}
        onLoaded={onLoaded}
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
      <FacebookEmbedInline
        originalUrl={publication.originalUrl || publication.canonicalUrl}
        canonicalUrl={publication.canonicalUrl}
        onLoaded={onLoaded}
      />
    );
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
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, padding: 32, background: "var(--bg-input)", minHeight: 180,
      }}
    >
      <Logo size={40} />
      <a
        href={publication.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8,
          background: "var(--accent-blue)", color: "#fff", textDecoration: "none",
        }}
      >
        View on {publication.platform}
      </a>
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  "Top Picks": "var(--badge-top)",
  "Replicable Ideas": "var(--badge-replicable)",
  "Overperforming": "var(--badge-overperforming)",
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
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
      }}
    >
      {publication.classifications.length > 0 && (
        <div className="flex gap-2 px-3 pt-3">
          {publication.classifications.map((cls) => (
            <span
              key={cls}
              className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ background: BADGE_COLORS[cls] || "var(--accent-blue)" }}
            >
              {cls}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
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
        <div className="flex items-center gap-2 shrink-0">
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

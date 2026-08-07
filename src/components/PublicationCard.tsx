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

function PlatformLoader({ color, icon }: { color: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg"
      style={{ background: "var(--bg-input)", minHeight: 200 }}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: color }} />
        <div className="relative animate-pulse">{icon}</div>
      </div>
      <span className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>Loading...</span>
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const notify = useCallback(() => {
    if (!notifiedRef.current) { notifiedRef.current = true; setLoading(false); onLoaded?.(); }
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
    <div style={{ position: "relative" }}>
      {loading && (
        <PlatformLoader color="#1877F2" icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        } />
      )}
      <iframe
        src={embedUrl}
        style={{ border: "none", display: loading ? "none" : "block", width: "100%", minHeight: 500 }}
        scrolling="no"
        title="Facebook post"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        onLoad={notify}
        onError={() => { setErrored(true); notify(); }}
      />
    </div>
  );
}

function PinterestEmbed({ embedSrc, onLoaded }: { embedSrc: string; onLoaded?: () => void }) {
  const [loading, setLoading] = useState(true);
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", background: "var(--bg-input)", position: "relative" }}>
      {loading && (
        <PlatformLoader color="#E60023" icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#E60023">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
        } />
      )}
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
      <FacebookEmbedInline
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

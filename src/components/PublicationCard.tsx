"use client";

import { useState, useEffect, useCallback } from "react";
import InstagramEmbed from "./InstagramEmbed";

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

interface PublicationCardProps {
  publication: Publication;
  animationDelay?: number;
  shouldAnimate?: boolean;
  onLoaded?: () => void;
  eager?: boolean;
}

const BADGE_COLORS: Record<string, string> = {
  "Top Picks": "var(--badge-top)",
  "Replicable Ideas": "var(--badge-replicable)",
  "Overperforming": "var(--badge-overperforming)",
};

export default function PublicationCard({ publication, animationDelay = 0, shouldAnimate = false, onLoaded, eager = false }: PublicationCardProps) {
  const [visible, setVisible] = useState(!shouldAnimate);
  const [isSaved, setIsSaved] = useState(publication.isSaved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shouldAnimate) return;
    const timer = setTimeout(() => setVisible(true), animationDelay);
    return () => clearTimeout(timer);
  }, [shouldAnimate, animationDelay]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicationId: publication.id }),
      });
      const data = await res.json();
      setIsSaved(data.saved);
    } finally {
      setSaving(false);
    }
  }, [publication.id, saving]);

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
              href={`https://www.instagram.com/${publication.accountUsername}/`}
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
            disabled={saving}
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            title={isSaved ? "Unsave" : "Save"}
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

      <div className="px-1 pb-1">
        <InstagramEmbed
          shortcode={publication.externalPostId}
          canonicalUrl={publication.canonicalUrl}
          platform={publication.platform}
          onLoaded={onLoaded}
          eager={eager}
        />
      </div>
    </div>
  );
}

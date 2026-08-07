"use client";

import { useState } from "react";
import { YouTubeLogo } from "./SocialLogos";

interface Props {
  videoId: string;
  embedUrl: string;
  title?: string | null;
  onLoaded?: () => void;
  isShort?: boolean;
}

export default function YouTubeFeedEmbed({ videoId, embedUrl, title, onLoaded, isShort = false }: Props) {
  const [playing, setPlaying] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(
    isShort
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  );
  const paddingBottom = isShort ? "177.78%" : "56.25%";

  if (playing) {
    return (
      <div style={{ position: "relative", width: "100%", paddingBottom }}>
        <iframe
          src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      style={{ position: "relative", width: "100%", paddingBottom, background: "#0f0f0f", cursor: "pointer" }}
    >
      <img
        src={thumbSrc}
        alt={title ?? ""}
        onLoad={() => onLoaded?.()}
        onError={() => {
          if (thumbSrc.includes("maxresdefault")) {
            setThumbSrc(`https://img.youtube.com/vi/${videoId}/sddefault.jpg`);
          } else if (thumbSrc.includes("sddefault")) {
            setThumbSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
          } else {
            onLoaded?.();
          }
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }}
      />
      {/* Play button */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isShort ? (
          /* Shorts: circular red play button like TikTok style */
          <div
            className="group-hover:scale-110 transition-transform"
            style={{
              width: 52, height: 52, borderRadius: "50%", background: "#FF0000",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(255,0,0,0.5)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        ) : (
          /* Regular YouTube: rectangular red button */
          <div
            className="group-hover:scale-110 transition-transform"
            style={{
              width: 60, height: 42, borderRadius: 10, background: "#FF0000",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(255,0,0,0.4)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
      </div>
      {/* Shorts badge top-left / YouTube logo bottom-right */}
      {isShort ? (
        <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 7px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="8.5" rx="4.25" fill="#FF0000" transform="rotate(-26 12 7.25)" />
            <rect x="2" y="12.5" width="20" height="8.5" rx="4.25" fill="#FF0000" transform="rotate(26 12 16.75)" />
            <polygon points="9.5,9.5 9.5,14.5 16,12" fill="white" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>Shorts</span>
        </div>
      ) : (
        <div style={{ position: "absolute", bottom: 8, right: 8, opacity: 0.9 }}>
          <YouTubeLogo size={30} />
        </div>
      )}
    </div>
  );
}

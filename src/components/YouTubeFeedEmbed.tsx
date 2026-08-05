"use client";

import { useState } from "react";
import { YouTubeLogo } from "./SocialLogos";

interface Props {
  videoId: string;
  embedUrl: string;
  title?: string | null;
  onLoaded?: () => void;
}

export default function YouTubeFeedEmbed({ videoId, embedUrl, title, onLoaded }: Props) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (playing) {
    return (
      <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
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
      style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#0f0f0f", cursor: "pointer" }}
    >
      <img
        src={thumb}
        alt={title ?? ""}
        onLoad={() => onLoaded?.()}
        onError={() => onLoaded?.()}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Red YouTube play button */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      </div>
      {/* YouTube logo bottom-right */}
      <div style={{ position: "absolute", bottom: 8, right: 8, opacity: 0.9 }}>
        <YouTubeLogo size={30} />
      </div>
    </div>
  );
}

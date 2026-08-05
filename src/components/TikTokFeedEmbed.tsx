"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TikTokLogo } from "./SocialLogos";

interface Props {
  videoId: string;
  canonicalUrl: string;
  title?: string | null;
  onLoaded?: () => void;
}

export default function TikTokFeedEmbed({ videoId, canonicalUrl, title, onLoaded }: Props) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const notifiedRef = useRef(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(() => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      onLoaded?.();
    }
  }, [onLoaded]);

  useEffect(() => {
    fetch(`/api/admin/tiktok-thumb?videoId=${videoId}`)
      .then((r) => r.json())
      .then((d) => {
        setThumb(d.thumb ?? null);
        if (!d.thumb) notify();
      })
      .catch(() => notify());
  }, [videoId, notify]);

  // Reset iframe-ready state each time playback is stopped
  useEffect(() => {
    if (!playing) {
      setIframeReady(false);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    }
  }, [playing]);

  // postMessage listener — auto-return to thumbnail when video ends
  useEffect(() => {
    if (!playing) return;

    const handler = (event: MessageEvent) => {
      // Validate origin
      if (!event.origin.includes("tiktok.com")) return;
      // Validate source — only handle messages from THIS iframe
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // player/v1 fires onStateChange value=0 when video ends
        if (data?.type === "onStateChange" && data?.value === 0) {
          setPlaying(false);
        }
      } catch {
        // ignore malformed messages
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [playing]);

  // Fallback error timeout: if iframe doesn't load within 12s, return to thumbnail
  const handleIframeLoad = useCallback(() => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setIframeReady(true);
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    // If iframe never loads, silently return to thumbnail after 12s
    errorTimeoutRef.current = setTimeout(() => setPlaying(false), 12000);
  }, []);

  // Common blurred background — fills any gap around the player with themed blur
  const blurLayer = (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "-15%",
        backgroundImage: thumb ? `url(${thumb})` : undefined,
        backgroundColor: "#0a0a0a",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(24px) brightness(0.32) saturate(1.3)",
        transform: "scale(1.1)",
        pointerEvents: "none",
      }}
    />
  );

  // Subtle vignette overlay — improves contrast without competing with the video
  const overlayLayer = (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.22) 100%)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );

  /* ── PLAYING STATE ─────────────────────────────────────────────── */
  if (playing) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "177.78%", // 9:16
          overflow: "hidden",
        }}
      >
        {/* Layer 1: blurred background — hides any gaps / white margins */}
        {blurLayer}

        {/* Layer 2: vignette overlay */}
        {overlayLayer}

        {/*
          Layer 3a: TikTok player/v1
          - autoplay=1   → starts immediately after user clicks
          - loop=0        → no loop; postMessage value=0 triggers auto-return
          - music_info=0  → hides music bar (reduces extra height)
          - description=0 → hides description UI at bottom
          - native_context_menu=0 → disables TikTok right-click menu
          - rel=0         → no related-videos panel after playback
        */}
        <iframe
          ref={iframeRef}
          key={videoId}
          src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=0&music_info=0&description=0&native_context_menu=0&rel=0`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            zIndex: 2,
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={title ?? "TikTok video"}
          onLoad={handleIframeLoad}
        />

        {/*
          Layer 3b: thumbnail cover — stays on top until iframe signals ready.
          This prevents any black flash while the player initialises.
          Fades out via CSS transition once iframeReady becomes true.
        */}
        {thumb && (
          <img
            src={thumb}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 3,
              opacity: iframeReady ? 0 : 1,
              transition: "opacity 0.35s ease",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    );
  }

  /* ── THUMBNAIL STATE ───────────────────────────────────────────── */
  return (
    <div
      onClick={handlePlay}
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "177.78%",
        cursor: "pointer",
        overflow: "hidden",
        background: "#0a0a0a",
      }}
    >
      {/* Layer 1: blurred background (visible while thumb image loads) */}
      {blurLayer}

      {/* Layer 2: vignette */}
      {overlayLayer}

      {/* Layer 3: thumbnail image */}
      {thumb ? (
        <img
          src={thumb}
          alt={title ?? ""}
          onLoad={() => { setThumbLoaded(true); notify(); }}
          onError={() => notify()}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: thumbLoaded ? 0.92 : 0,
            transition: "opacity 0.3s",
            zIndex: 2,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <TikTokLogo size={56} />
        </div>
      )}

      {/* Play button — centred, above thumbnail */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 4,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>

      {/* TikTok branding badge */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(0,0,0,0.55)",
          borderRadius: 8,
          padding: "4px 8px",
          zIndex: 4,
        }}
      >
        <TikTokLogo size={14} />
        <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>TikTok</span>
      </div>

      {/* External link */}
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          background: "rgba(0,0,0,0.55)",
          borderRadius: 8,
          padding: "4px 8px",
          color: "white",
          fontSize: 11,
          textDecoration: "none",
          zIndex: 4,
        }}
      >
        ↗
      </a>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function FacebookLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function EmbedSkeleton({ height = 420 }: { height?: number }) {
  return (
    <div className="embed-skeleton" style={{ minHeight: height, borderRadius: 8 }}>
      <div style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="embed-skeleton-line" style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="embed-skeleton-line" style={{ height: 12, width: "42%" }} />
            <div className="embed-skeleton-line" style={{ height: 10, width: "28%" }} />
          </div>
        </div>
        <div className="embed-skeleton-line" style={{ height: 14, width: "85%" }} />
        <div className="embed-skeleton-line" style={{ height: 14, width: "65%" }} />
        <div className="embed-skeleton-line" style={{ height: height - 200, borderRadius: 8 }} />
      </div>
    </div>
  );
}

function UnavailableState({ canonicalUrl }: { canonicalUrl: string }) {
  return (
    <div className="embed-unavailable">
      <div style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(24,119,242,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <FacebookLogo size={22} />
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
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#1877F2",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
          opacity: 0.85,
        }}
      >
        Veure a Facebook
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  );
}

export default function FacebookEmbed({
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
  const [loaded, setLoaded] = useState(false);
  const [iframeVisible, setIframeVisible] = useState(false);

  const notify = useCallback(() => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      onLoaded?.();
    }
  }, [onLoaded]);

  const isFbUrl = originalUrl.includes("facebook.com");
  const embedUrl = isFbUrl
    ? `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(originalUrl)}&show_text=true&width=500`
    : null;

  // Facebook sends postMessage resize events when the embed is ready.
  // A height < 280 means the post is unavailable (FB shows a minimal error card).
  useEffect(() => {
    if (!embedUrl) return;

    function handleMessage(e: MessageEvent) {
      if (!e.origin.includes("facebook.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.action === "resize" && typeof data.value === "number") {
          if (data.value < 280) {
            setErrored(true);
          } else {
            setIframeVisible(true);
          }
          notify();
        }
      } catch {}
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [embedUrl, notify]);

  // Fallback: if iframe loaded but no resize postMessage after 7s, show it anyway
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      setIframeVisible(true);
      notify();
    }, 7000);
    return () => clearTimeout(t);
  }, [loaded, notify]);

  if (!embedUrl || errored) {
    return <UnavailableState canonicalUrl={canonicalUrl} />;
  }

  return (
    <div style={{ position: "relative", minHeight: 200 }}>
      {!iframeVisible && <EmbedSkeleton height={420} />}
      <iframe
        src={embedUrl}
        style={{
          border: "none",
          display: iframeVisible ? "block" : "none",
          width: "100%",
          minHeight: 500,
          overflow: "hidden",
        }}
        scrolling="no"
        title="Facebook post"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); notify(); }}
      />
    </div>
  );
}

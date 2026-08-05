"use client";

import { useCallback, useRef, useState } from "react";

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

  if (!embedUrl || errored) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, background: "var(--bg-input)", minHeight: 180 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        <a href={canonicalUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8, background: "#1877F2", color: "#fff", textDecoration: "none" }}>
          View on Facebook
        </a>
      </div>
    );
  }

  return (
    <iframe
      src={embedUrl}
      style={{ border: "none", display: "block", width: "100%", minHeight: 500, overflow: "hidden" }}
      scrolling="no"
      title="Facebook post"
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
      onLoad={notify}
      onError={() => { setErrored(true); notify(); }}
    />
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

export default function LinkedInEmbed({
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

  // Build embed URL from originalUrl: swap /feed/update/ → /embed/feed/update/
  // originalUrl example: https://www.linkedin.com/feed/update/urn:li:activity:7488871671395799040/
  const embedUrl = originalUrl.includes("linkedin.com")
    ? originalUrl
        .replace("https://www.linkedin.com/feed/update/", "https://www.linkedin.com/embed/feed/update/")
        .replace(/\/$/, "")
    : null;

  if (!embedUrl || errored) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, background: "var(--bg-input)", minHeight: 180 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <a href={canonicalUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8, background: "#0A66C2", color: "#fff", textDecoration: "none" }}>
          View on LinkedIn
        </a>
      </div>
    );
  }

  return (
    <div style={{ overflow: "hidden" }}>
      <iframe
        src={embedUrl}
        style={{ border: "none", display: "block", width: "100%", height: 1000, overflow: "hidden" }}
        scrolling="no"
        title="LinkedIn post"
        allowFullScreen
        onLoad={notify}
        onError={() => { setErrored(true); notify(); }}
      />
    </div>
  );
}

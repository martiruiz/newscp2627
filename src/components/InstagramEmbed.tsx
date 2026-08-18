"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getPlatformLogo } from "./SocialLogos";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

let scriptLoaded = false;
let scriptLoading = false;

function loadInstagramScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (scriptLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  scriptLoading = true;
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="instagram.com/embed.js"]')) {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error("Failed to load Instagram embed script"));
    };
    document.body.appendChild(script);
  });
}

interface InstagramEmbedProps {
  shortcode: string;
  canonicalUrl: string;
  platform?: string;
  onLoaded?: () => void;
  eager?: boolean;
}

export default function InstagramEmbed({ shortcode, canonicalUrl, platform = "Instagram", onLoaded, eager = false }: InstagramEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "rendered" | "error">("loading");
  const startedRef = useRef(false);
  const notifiedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const Logo = getPlatformLogo(platform);

  const notifyLoaded = useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    setStatus("rendered");
    onLoaded?.();
  }, [onLoaded]);

  const startProcessing = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    loadInstagramScript()
      .then(() => {
        window.instgrm?.Embeds?.process();

        const container = containerRef.current;
        if (!container) { notifyLoaded(); return; }

        function watchIframe(iframe: HTMLIFrameElement) {
          // Wait for iframe document to load, then 300 ms for Instagram's
          // resize postMessage to be processed before showing the card.
          let resizeTimer: ReturnType<typeof setTimeout> | null = null;

          const done = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            if (globalFallback) clearTimeout(globalFallback);
            cleanupRef.current = null;
            notifyLoaded();
          };

          const onIframeLoad = () => {
            resizeTimer = setTimeout(done, 300);
            cleanupRef.current = () => { if (resizeTimer) clearTimeout(resizeTimer); };
          };

          // Safety: show after 8 s even if load never fires
          const globalFallback = setTimeout(done, 8000);

          iframe.addEventListener("load", onIframeLoad, { once: true });
          cleanupRef.current = () => {
            iframe.removeEventListener("load", onIframeLoad);
            clearTimeout(globalFallback);
            if (resizeTimer) clearTimeout(resizeTimer);
          };
        }

        // Instagram may have already injected the iframe synchronously
        const existing = container.querySelector("iframe");
        if (existing) { watchIframe(existing); return; }

        // Otherwise watch for it
        let globalFallback: ReturnType<typeof setTimeout>;
        const mo = new MutationObserver(() => {
          const iframe = container.querySelector("iframe");
          if (iframe) {
            mo.disconnect();
            clearTimeout(globalFallback);
            watchIframe(iframe);
          }
        });
        mo.observe(container, { childList: true, subtree: true });
        globalFallback = setTimeout(() => { mo.disconnect(); notifyLoaded(); }, 9000);
        cleanupRef.current = () => { mo.disconnect(); clearTimeout(globalFallback); };
      })
      .catch(() => {
        setStatus("error");
        notifyLoaded();
      });
  }, [notifyLoaded]);

  // Cleanup MutationObserver / safety timer on unmount
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  useEffect(() => {
    if (eager) {
      startProcessing();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          startProcessing();
        }
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) io.observe(containerRef.current);
    return () => io.disconnect();
  }, [eager, startProcessing]);

  if (status === "error") {
    return (
      <div className="embed-unavailable">
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(225,48,108,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#E1306C",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            opacity: 0.85,
          }}
        >
          Veure a {platform}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      {status === "loading" && (
        <div className="embed-skeleton" style={{ minHeight: 460, borderRadius: 8 }}>
          <div style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="embed-skeleton-line" style={{ width: 38, height: 38, borderRadius: "50%" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                <div className="embed-skeleton-line" style={{ height: 11, width: "38%" }} />
                <div className="embed-skeleton-line" style={{ height: 10, width: "24%" }} />
              </div>
            </div>
            <div className="embed-skeleton-line" style={{ height: 340, borderRadius: 8 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <div className="embed-skeleton-line" style={{ height: 24, width: 24, borderRadius: "50%" }} />
              <div className="embed-skeleton-line" style={{ height: 24, width: 24, borderRadius: "50%" }} />
              <div className="embed-skeleton-line" style={{ height: 24, width: 24, borderRadius: "50%" }} />
            </div>
          </div>
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={canonicalUrl}
        data-instgrm-version="14"
        key={shortcode}
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: "0",
          margin: "0",
          padding: "0",
          display: status === "loading" ? "none" : "block",
        }}
      />
    </div>
  );
}

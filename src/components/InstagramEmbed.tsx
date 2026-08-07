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

        // Check immediately — sometimes the iframe is already there
        if (container.querySelector("iframe")) { notifyLoaded(); return; }

        // MutationObserver fires the instant Instagram injects the iframe
        const mo = new MutationObserver(() => {
          if (container.querySelector("iframe")) {
            doCleanup();
            notifyLoaded();
          }
        });
        mo.observe(container, { childList: true, subtree: true, attributes: true });

        const timer = setTimeout(() => { doCleanup(); notifyLoaded(); }, 7000);

        function doCleanup() {
          mo.disconnect();
          clearTimeout(timer);
          cleanupRef.current = null;
        }
        cleanupRef.current = doCleanup;
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
      <div
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg"
        style={{ background: "var(--bg-input)", minHeight: "200px" }}
      >
        <Logo size={40} />
        <span style={{ color: "var(--text-muted)" }} className="text-sm">
          Publication unavailable
        </span>
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-4 py-1.5 rounded-md"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          View on {platform}
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      {status === "loading" && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg"
          style={{ background: "var(--bg-input)", minHeight: "400px" }}
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}
            />
            <div className="relative animate-pulse">
              <Logo size={48} />
            </div>
          </div>
          <span className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>
            Loading...
          </span>
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

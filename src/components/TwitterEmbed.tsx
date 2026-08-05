"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (
          id: string,
          container: HTMLElement,
          options?: Record<string, unknown>,
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTwitterScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (window.twttr?.widgets) { resolve(); return; }
    const existing = document.getElementById("twitter-wjs");
    if (existing) {
      const wait = setInterval(() => {
        if (window.twttr?.widgets) { clearInterval(wait); resolve(); }
      }, 80);
      return;
    }
    const s = document.createElement("script");
    s.id = "twitter-wjs";
    s.src = "https://platform.twitter.com/widgets.js";
    s.charset = "utf-8";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; resolve(); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function detectTheme(): "dark" | "light" {
  const root = document.documentElement;
  if (root.dataset.theme === "dark") return "dark";
  if (root.dataset.theme === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function TwitterEmbed({
  tweetId,
  canonicalUrl,
  onLoaded,
}: {
  tweetId: string;
  canonicalUrl: string;
  onLoaded?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const notify = useCallback(() => onLoaded?.(), [onLoaded]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    // Cancel flag prevents the StrictMode double-invoke from appending two tweets
    let cancelled = false;

    // Safety: call notify after 6 s in case the Twitter script or createTweet hangs
    const safetyTimer = setTimeout(() => { if (!cancelled) notify(); }, 6000);

    loadTwitterScript().then(() => {
      if (cancelled) return;
      if (!window.twttr?.widgets?.createTweet) {
        clearTimeout(safetyTimer);
        notify();
        return;
      }
      window.twttr.widgets
        .createTweet(tweetId, container, {
          theme: detectTheme(),
          dnt: true,
          conversation: "none",
          cards: "visible",
          align: "center",
        })
        .then((el) => {
          clearTimeout(safetyTimer);
          if (cancelled) {
            container.innerHTML = "";
            return;
          }
          if (!el) {
            container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:24px;gap:10px;flex-direction:column">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <a href="${canonicalUrl}" target="_blank" rel="noopener noreferrer"
                style="font-size:12px;color:#1d9bf0;text-decoration:none;font-weight:600;">View on X ↗</a>
            </div>`;
          }
          notify();
        })
        .catch(() => { clearTimeout(safetyTimer); if (!cancelled) notify(); });
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      container.innerHTML = "";
    };
  }, [tweetId, canonicalUrl, notify]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}
    />
  );
}

"use client";

import { useEffect, useRef, useId } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
    twttr?: { widgets: { createTweet: (id: string, el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLElement | undefined>; load: (el?: HTMLElement) => void; }; };
  }
}

let igScriptLoading = false;

function loadInstagramScript(): Promise<void> {
  // Check window.instgrm, not the DOM — the embed HTML injects a <script> React won't execute
  if (window.instgrm?.Embeds) return Promise.resolve();
  if (igScriptLoading) {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (window.instgrm?.Embeds) { clearInterval(t); resolve(); }
      }, 100);
    });
  }
  igScriptLoading = true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.setAttribute("data-blog-embed", "true");
    s.onload = () => { igScriptLoading = false; resolve(); };
    s.onerror = () => { igScriptLoading = false; resolve(); };
    document.body.appendChild(s);
  });
}

interface BlogEmbedsProps {
  embeds: (string | null)[];
}

export default function BlogEmbeds({ embeds }: BlogEmbedsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "_");
  const activeEmbeds = embeds.filter(Boolean) as string[];
  const n = activeEmbeds.length;

  // Desktop width per item
  const desktopWidth =
    n === 1 ? "100%" :
    n <= 3 ? `calc(${100 / n}% - ${(n - 1) * 16 / n}px)` :
    "clamp(280px, 40vw, 400px)";

  useEffect(() => {
    if (!containerRef.current || n === 0) return;

    const hasInstagram = activeEmbeds.some(
      (e) => e.includes("instagram") || e.includes("instgrm")
    );
    if (hasInstagram) {
      loadInstagramScript().then(() => {
        // Retry process() a few times to ensure blockquotes are in DOM
        [200, 800, 2000].forEach((delay) =>
          setTimeout(() => window.instgrm?.Embeds?.process(), delay)
        );
      });
    }

    const hasTwitter = activeEmbeds.some((e) => e.includes("twitter") || e.includes("tweet"));
    if (hasTwitter) {
      [300, 1000].forEach((delay) =>
        setTimeout(() => window.twttr?.widgets?.load(containerRef.current!), delay)
      );
    }
  }, [activeEmbeds.join(",")]);

  if (n === 0) return null;

  return (
    <div className="mb-8 -mx-6 sm:mx-0">
      {/* Responsive widths: mobile = 1 per view, desktop = side by side */}
      <style>{`
        .be-track-${uid} {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 0 24px 12px;
        }
        .be-track-${uid}::-webkit-scrollbar { display: none; }
        .be-item-${uid} {
          flex-shrink: 0;
          scroll-snap-align: start;
          width: calc(100vw - 48px - 24px);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
        }
        @media (min-width: 640px) {
          .be-track-${uid} { padding: 0 0 12px; }
          .be-item-${uid} { width: ${desktopWidth}; }
        }
      `}</style>
      <div ref={containerRef} className={`be-track-${uid}`}>
        {activeEmbeds.map((embed, i) => (
          <div
            key={i}
            className={`be-item-${uid}`}
            dangerouslySetInnerHTML={{ __html: embed }}
          />
        ))}
      </div>
    </div>
  );
}

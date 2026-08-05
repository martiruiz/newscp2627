"use client";

import { useState, useEffect, useRef } from "react";

interface NewsArticle {
  id: string;
  url: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  platform: string | null;
  publishedAt: string | null;
  createdAt: string;
}

type DateFilter = "7" | "14" | "30" | "all";

const PLATFORMS = ["Instagram", "TikTok", "X", "YouTube", "Facebook", "LinkedIn", "Snapchat", "WhatsApp", "Pinterest", "Threads", "Reddit"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_STYLES: Record<Platform, { gradient: string; icon: React.ReactNode }> = {
  Instagram: {
    gradient: "linear-gradient(135deg, #833AB4 0%, #C13584 40%, #F56040 75%, #FCAF45 100%)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  TikTok: {
    gradient: "linear-gradient(135deg, #010101 0%, #1a1a2e 50%, #16213e 100%)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  },
  X: {
    gradient: "linear-gradient(135deg, #14171A 0%, #1a1a2e 100%)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  YouTube: {
    gradient: "linear-gradient(135deg, #FF0000 0%, #CC0000 100%)",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  Facebook: {
    gradient: "linear-gradient(135deg, #1877F2 0%, #166FE5 100%)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  LinkedIn: {
    gradient: "linear-gradient(135deg, #0A66C2 0%, #084d8f 100%)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  Snapchat: {
    gradient: "linear-gradient(135deg, #FFFC00 0%, #FFE400 100%)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.289 4.408-.358.326-.379 1.066.28 1.498.48.21.982.23 1.32.095.365-.197.49-.186.614-.186.26 0 .484.095.484.443 0 .678-.919 1.044-1.32 1.286-.356.218-.443.354-.326 1.036.227 1.304 1.086 1.867 2.08 3.035.17.203.368.613.368.613-1.27.332-1.738 1.136-1.8 1.32-.09.269-.18.337-.36.337-.18 0-.36-.068-.54-.135-1.035-.332-2.115-.53-3.239.135-.954.562-1.454 1.483-3.785 1.483-2.33 0-3.33-.921-3.784-1.483-1.125-.665-2.204-.467-3.239-.135-.18.067-.36.135-.54.135-.18 0-.27-.068-.36-.337-.062-.184-.53-.988-1.8-1.32 0 0 .198-.41.368-.613.994-1.168 1.853-1.731 2.08-3.035.117-.682.03-.818-.326-1.036-.401-.242-1.32-.608-1.32-1.286 0-.348.224-.443.484-.443.124 0 .249-.011.614.186.338.135.84.115 1.32-.095.659-.432.638-1.172.28-1.498-.114-1.189-.24-3.215.289-4.408C7.859 1.069 11.216.793 12.206.793z"/>
      </svg>
    ),
  },
  WhatsApp: {
    gradient: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    ),
  },
  Pinterest: {
    gradient: "linear-gradient(135deg, #E60023 0%, #ad081b 100%)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
      </svg>
    ),
  },
  Threads: {
    gradient: "linear-gradient(135deg, #101010 0%, #2d2d2d 100%)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 192 192" fill="currentColor">
        <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 6.969 9.978 15.695 12.737 25.755l16.146-4.25c-3.44-12.687-8.853-23.565-16.219-32.394C147.036 9.994 125.202.195 97.07 0h-.113C68.882.195 47.292 10.016 32.788 29.613 19.882 47.064 13.224 71.587 13.001 96.04v.92c.223 24.453 6.881 48.977 19.787 66.427C47.292 182.984 68.882 192.805 96.957 193h.113c24.96-.173 42.554-6.708 57.048-21.189 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-18.945-24.723-24.553zM97.39 133.996c-10.437.588-21.263-4.098-21.82-14.135-.427-8.024 5.701-16.979 24.086-18.037 2.108-.121 4.171-.18 6.19-.18 6.058 0 11.716.591 16.834 1.744-1.916 23.98-15.658 30.024-25.29 30.608z"/>
      </svg>
    ),
  },
  Reddit: {
    gradient: "linear-gradient(135deg, #FF4500 0%, #cc3700 100%)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
  },
};

function AllCard({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all w-[82px] h-[82px] md:w-[112px] md:h-[112px]"
      style={{
        background: lit ? "linear-gradient(135deg, #F5C542 0%, #F5C542 100%)" : "var(--bg-card)",
        border: active ? "none" : "1px solid var(--border-color)",
        color: lit ? "#fff" : "var(--text-muted)",
        boxShadow: lit ? "0 8px 24px rgba(245,197,66,0.35)" : "none",
        transform: lit ? "translateY(-2px)" : "none",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <span className="text-[10px] md:text-xs font-semibold">All</span>
    </button>
  );
}

function PlatformCard({
  name,
  active,
  onClick,
}: {
  name: Platform;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const style = PLATFORM_STYLES[name];
  const lit = active || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all w-[82px] h-[82px] md:w-[112px] md:h-[112px]"
      style={{
        background: lit ? style.gradient : "var(--bg-card)",
        border: active ? "none" : "1px solid var(--border-color)",
        color: lit ? "#fff" : "var(--text-muted)",
        boxShadow: lit ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
        transform: lit ? "translateY(-2px)" : "none",
      }}
    >
      {style.icon}
      <span className="text-[10px] md:text-xs font-semibold">{name}</span>
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AddNewsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    excerpt: string | null;
    imageUrl: string | null;
    platform: string | null;
    publishedAt: string | null;
  } | null>(null);

  const reqId = useRef(0);

  async function handleScrape() {
    if (!url.trim()) return;
    const id = ++reqId.current;
    setScraping(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/news/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (id !== reqId.current) return;
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not extract the article. The website may be blocking automated requests — try a different URL.");
        return;
      }
      setPreview(data);
    } catch {
      if (id !== reqId.current) return;
      setError("Could not reach the article. Check the URL and try again.");
    } finally {
      if (id === reqId.current) setScraping(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), ...preview }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not save the article. Try again."); return; }
      onSaved();
      onClose();
    } catch {
      setError("Could not save the article. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl overflow-hidden flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(600px, 94vw)",
          maxHeight: "85vh",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
              Add news article
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Paste the article URL and we'll extract the details automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-all hover:opacity-70"
            style={{ width: 28, height: 28, color: "var(--text-muted)", background: "var(--bg-input)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* URL input */}
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setPreview(null); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleScrape(); }}
              placeholder="https://sportspro.com/article/..."
              className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleScrape}
              disabled={!url.trim() || scraping}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shrink-0 disabled:opacity-50"
              style={{ background: "#F5C542", color: "#fff" }}
            >
              {scraping ? "Extracting…" : "Extract"}
            </button>
          </div>

          {error && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="flex-1 leading-relaxed">{error}</span>
              <button onClick={() => setError(null)} className="shrink-0 hover:opacity-70 transition-opacity">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              {/* Image */}
              {preview.imageUrl && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <img
                    src={preview.imageUrl}
                    alt=""
                    className="w-full object-cover"
                    style={{ maxHeight: 180 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* Title + Excerpt */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Title</label>
                <input
                  value={preview.title}
                  onChange={(e) => setPreview((p) => p ? { ...p, title: e.target.value } : p)}
                  className="w-full text-sm font-bold outline-none rounded-lg px-2 py-1.5"
                  style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                />
                <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Excerpt</label>
                <textarea
                  value={preview.excerpt ?? ""}
                  onChange={(e) => setPreview((p) => p ? { ...p, excerpt: e.target.value } : p)}
                  rows={3}
                  placeholder="Short description of the article…"
                  className="w-full text-xs outline-none rounded-lg px-2 py-1.5 resize-none"
                  style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                />
              </div>

              {/* Platform + Date row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Platform */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                  <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Platform</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["Instagram","TikTok","X","YouTube","Facebook","LinkedIn","Snapchat","WhatsApp","Pinterest","Threads","Reddit"] as const).map((pl) => {
                      const active = preview.platform === pl;
                      return (
                        <button
                          key={pl}
                          onClick={() => setPreview((p) => p ? { ...p, platform: active ? null : pl } : p)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                          style={{
                            background: active ? "#F5C542" : "var(--bg-card)",
                            color: active ? "#fff" : "var(--text-muted)",
                            border: active ? "none" : "1px solid var(--border-color)",
                          }}
                        >
                          {pl}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPreview((p) => p ? { ...p, platform: null } : p)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                      style={{
                        background: !preview.platform ? "#F5C542" : "var(--bg-card)",
                        color: !preview.platform ? "#fff" : "var(--text-muted)",
                        border: !preview.platform ? "none" : "1px solid var(--border-color)",
                      }}
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Published date */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                  <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Publication date</label>
                  <input
                    type="date"
                    value={preview.publishedAt ? preview.publishedAt.slice(0, 10) : ""}
                    onChange={(e) => setPreview((p) => p ? { ...p, publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null } : p)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      colorScheme: "dark",
                    }}
                  />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Used to filter by Last 7/14/30 days
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!preview || saving}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#F5C542", color: "#fff" }}
          >
            {saving ? "Saving…" : "Publish article"}
          </button>
        </div>
      </div>
    </>
  );
}

function ArticleCard({ article, onDelete }: { article: NewsArticle; onDelete: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  return (
    <article
      className="rounded-2xl overflow-hidden flex gap-0 transition-all hover:shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex-1 p-4 md:p-6 flex flex-col">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-3">
          {article.platform && (
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(245,197,66,0.12)", color: "#F5C542" }}
            >
              {article.platform}
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {formatDate(article.publishedAt ?? article.createdAt)}
          </span>

          {/* Delete */}
          <button
            onClick={() => onDelete(article.id)}
            className="ml-auto flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:opacity-70"
            style={{ width: 24, height: 24, color: "var(--text-muted)" }}
            title="Remove"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer" className="group flex-1 flex flex-col">
          <h2
            className="font-bold text-base leading-snug mb-2 group-hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            {article.title}
          </h2>
          {article.excerpt && (
            <p
              className="text-sm leading-relaxed line-clamp-3"
              style={{ color: "var(--text-muted)" }}
            >
              {article.excerpt}
            </p>
          )}
        </a>

        <div className="mt-4">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
            style={{ color: "#F5C542" }}
          >
            Read full article
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 0 1-1h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Image */}
      {article.imageUrl && !imgError && (
        <div className="relative shrink-0 overflow-hidden hidden md:block" style={{ width: 240 }}>
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <button
            onClick={() => setZoomed(true)}
            className="absolute bottom-3 right-3 flex items-center justify-center rounded-full transition-all hover:opacity-90"
            style={{ width: 32, height: 32, background: "rgba(0,0,0,0.6)", color: "#fff" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {zoomed && (
            <>
              <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setZoomed(false)} />
              <div className="fixed z-50 rounded-2xl overflow-hidden" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "90vw", maxHeight: "85vh" }}>
                <img src={article.imageUrl} alt={article.title} className="max-w-full max-h-full object-contain" />
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

const SUPERADMIN_EMAILS = ["guinewagency@gmail.com", "marti@agenciaguinew.com"];

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatforms, setActivePlatforms] = useState<Set<Platform>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      let raw = localStorage.getItem("scp-account-profile");
      if (!raw) {
        const defaultProfile = { email: "guinewagency@gmail.com", name: "", surname: "", company: "", orgSize: "", address: "", city: "", postalCode: "", country: "Spain", vatId: "" };
        localStorage.setItem("scp-account-profile", JSON.stringify(defaultProfile));
        raw = JSON.stringify(defaultProfile);
      }
      const { email } = JSON.parse(raw);
      setIsSuperAdmin(SUPERADMIN_EMAILS.includes((email ?? "").toLowerCase()));
    } catch {}
  }, []);

  async function fetchArticles() {
    setLoading(true);
    const params = new URLSearchParams();
    if (activePlatforms.size > 0) params.set("platform", [...activePlatforms].join(","));
    if (dateFilter !== "all") params.set("days", dateFilter);
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/news?${params}`);
    const data = await res.json();
    setArticles(data.articles || []);
    setLoading(false);
  }

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(fetchArticles, search ? 300 : 0);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatforms, dateFilter, search]);

  function togglePlatform(p: Platform) {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/news?id=${id}`, { method: "DELETE" });
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  const DATE_OPTS: { id: DateFilter; label: string }[] = [
    { id: "7", label: "Last 7 days" },
    { id: "14", label: "Last 14 days" },
    { id: "30", label: "Last month" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Hero */}
      <div
        className="text-center px-6 py-8 md:py-16"
        style={{
          background: "linear-gradient(180deg, rgba(245,197,66,0.06) 0%, transparent 100%)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em] mb-4"
          style={{ color: "#F5C542" }}
        >
          Real-time news
        </p>
        <h1 className="font-black text-2xl md:text-4xl leading-tight mb-4" style={{ color: "var(--text-primary)" }}>
          Everything happening on social,{" "}
          <span style={{ color: "#F5C542" }}>in one place</span>
        </h1>
        <p className="text-sm max-w-lg mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
          We collect and organize the latest updates from every platform so you don&apos;t have to.
          Changes, trends and features—always up to date.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Platform filter */}
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
            Filter by platform
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <AllCard active={activePlatforms.size === 0} onClick={() => setActivePlatforms(new Set())} />
            {PLATFORMS.map((p) => (
              <PlatformCard
                key={p}
                name={p}
                active={activePlatforms.has(p)}
                onClick={() => togglePlatform(p)}
              />
            ))}
          </div>
        </div>

        {/* Date + Search */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-5 md:gap-6 mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-muted)" }}>
              Filter by date
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DATE_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDateFilter(opt.id)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: dateFilter === opt.id ? "#F5C542" : "var(--bg-card)",
                    color: dateFilter === opt.id ? "#fff" : "var(--text-muted)",
                    border: dateFilter === opt.id ? "none" : "1px solid var(--border-color)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 md:min-w-56">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-muted)" }}>
              Search all news
            </p>
            <div className="relative">
              <svg
                className="absolute"
                style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-9 pr-4 py-2 rounded-full text-sm outline-none"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {isSuperAdmin && (
            <div className="ml-auto mt-5">
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90"
                style={{ background: "#F5C542", color: "#fff" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add article
              </button>
            </div>
          )}
        </div>

        {/* Articles */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ height: 180, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div
            className="rounded-2xl py-20 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <p className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>No articles yet</p>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              {activePlatforms.size > 0 || dateFilter !== "all" || search
                ? "No articles match your current filters."
                : "Be the first to add a news article."}
            </p>
            {activePlatforms.size === 0 && dateFilter === "all" && !search && isSuperAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "#F5C542", color: "#fff" }}
              >
                Add first article
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddNewsModal onClose={() => setShowAdd(false)} onSaved={fetchArticles} />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PublicationCard from "@/components/PublicationCard";
import DashboardNotificationBell from "@/components/DashboardNotificationBell";

interface Publication {
  id: string;
  externalPostId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  publishedAt: string | null;
  platform: string;
  sport: string | null;
  entityType: string | null;
  entityName: string | null;
  contentFormat: string | null;
  competitions: string[];
  classifications: string[];
  isSaved: boolean;
}

const TOOLS = [
  {
    label: "News",
    href: "/news",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
      </svg>
    ),
  },
  {
    label: "Blog",
    href: "/blog",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    label: "Support",
    href: "/support",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    label: "Saved",
    href: "/saved",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Plan",
    href: "/plan",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#C13584",
  TikTok: "#69C9D0",
  X: "#1d9bf0",
  YouTube: "#FF0000",
  Facebook: "#1877F2",
  LinkedIn: "#0A66C2",
  Snapchat: "#FFFC00",
  WhatsApp: "#25D366",
  Pinterest: "#E60023",
  Threads: "#000000",
  Reddit: "#FF4500",
};

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("Good morning");
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [newsItems, setNewsItems] = useState<{ id: string; url: string; title: string; platform: string | null; publishedAt: string | null; createdAt: string }[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 18) setGreeting("Good afternoon");
    else if (h >= 18) setGreeting("Good evening");

    fetch("/api/publications?limit=5&order=latest")
      .then((r) => r.json())
      .then((d) => { setPublications(d.publications || []); setLoadingPubs(false); })
      .catch(() => setLoadingPubs(false));

    fetch("/api/news?limit=3")
      .then((r) => r.json())
      .then((d) => setNewsItems(d.articles || []))
      .catch(() => {});
  }, []);

  function onCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveSlide(idx);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* ── MOBILE LAYOUT ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:hidden flex-1">

        {/* Mobile header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 36, height: 36, background: "linear-gradient(135deg, #F5C542, #F5C542)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="leading-none">
              <div className="font-black text-xs tracking-tight" style={{ color: "var(--text-primary)" }}>SPORTS CONTENT</div>
              <div className="text-[8px] font-bold tracking-widest uppercase" style={{ color: "#F5C542" }}>PLAYBOOK</div>
            </div>
          </div>
          <DashboardNotificationBell />
        </div>

        {/* Greeting */}
        <div className="px-5 mb-5">
          <h1 className="text-xl font-black mb-0.5">{greeting}, Creator!</h1>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Created by creators, for creators</p>
        </div>

        {/* Publication carousel */}
        <div className="mb-2">
          <div className="flex items-center justify-between px-5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Latest content</p>
            <Link href="/feed" className="text-[10px] font-bold" style={{ color: "#F5C542" }}>See all →</Link>
          </div>

          {loadingPubs ? (
            <div className="flex gap-4 px-5">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl animate-pulse shrink-0" style={{ width: "80vw", height: 200, background: "var(--bg-card)" }} />
              ))}
            </div>
          ) : publications.length === 0 ? (
            <div className="mx-5 rounded-2xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No content yet.{" "}
                <a href="/admin/import" className="hover:underline" style={{ color: "#F5C542" }}>Import some →</a>
              </p>
            </div>
          ) : (
            <>
              <div
                ref={carouselRef}
                onScroll={onCarouselScroll}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5"
                style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
              >
                {publications.map((pub) => (
                  <div key={pub.id} className="shrink-0 snap-center" style={{ width: "82vw" }}>
                    <PublicationCard publication={pub} eager />
                  </div>
                ))}
              </div>
              {/* Dots */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {publications.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      carouselRef.current?.scrollTo({ left: i * carouselRef.current.clientWidth, behavior: "smooth" });
                    }}
                    className="rounded-full transition-all"
                    style={{
                      width: i === activeSlide ? 18 : 6,
                      height: 6,
                      background: i === activeSlide ? "#F5C542" : "var(--border-color)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* WhatsApp community banner (mobile compact) */}
        <div className="mx-5 my-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #075e54 0%, #25d366 100%)" }}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm leading-tight">Uneix-te a la comunitat</p>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.8)" }}>Creadors de contingut esportiu</p>
            </div>
            <a href="#" className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all" style={{ background: "#fff", color: "#075e54" }}>Unir-me</a>
          </div>
        </div>

        {/* Tools grid */}
        <div className="px-5 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Tools</p>
          <div className="grid grid-cols-3 gap-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.label}
                href={tool.href}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl py-4 px-2 transition-all active:scale-95"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                <span style={{ color: "var(--text-muted)" }}>{tool.icon}</span>
                <span className="text-[10px] font-bold text-center leading-tight" style={{ color: "var(--text-primary)", whiteSpace: "pre-line" }}>
                  {tool.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile news preview */}
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Sports & Creator News</p>
            <Link href="/news" className="text-[10px] font-bold" style={{ color: "#F5C542" }}>See all →</Link>
          </div>
          <div className="space-y-2">
            {newsItems.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No news yet. Add some from the News section.</p>
            ) : newsItems.slice(0, 3).map((item) => {
              const color = item.platform ? (PLATFORM_COLORS[item.platform] ?? "#3b82f6") : "#3b82f6";
              return (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl p-3 transition-all" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div className="flex-1 min-w-0">
                    {item.platform && (
                      <div className="text-[9px] font-bold uppercase mb-1 px-1.5 py-0.5 rounded w-fit" style={{ background: `${color}20`, color }}>
                        {item.platform}
                      </div>
                    )}
                    <p className="text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-1" style={{ color: "var(--text-muted)" }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT ────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col flex-1 p-6">
        <div>
          {/* Desktop header */}
          <div className="flex items-center gap-6 mb-8">
            <div className="shrink-0">
              <h1 className="text-xl font-bold mb-0.5">{greeting}, Creator!</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Your hub for sports content ideas, trends and growth.</p>
            </div>
            <div className="flex items-center gap-3 ml-auto shrink-0">
              <DashboardNotificationBell />
            </div>
          </div>

          {/* Desktop publications grid */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Latest published content</h2>
              <Link href="/feed" className="text-xs font-medium hover:underline" style={{ color: "#F5C542" }}>View all in Content Library →</Link>
            </div>
            {loadingPubs ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl animate-pulse" style={{ height: 240, background: "var(--bg-card)", border: "1px solid var(--border-color)" }} />
                ))}
              </div>
            ) : publications.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No content yet. <a href="/admin/import" className="hover:underline" style={{ color: "#F5C542" }}>Import some →</a></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publications.slice(0, 3).map((pub) => (
                  <PublicationCard key={pub.id} publication={pub} eager />
                ))}
              </div>
            )}
          </section>

          {/* Desktop middle row: Blog + Newsletter + Social */}
          <div className="grid gap-6 mb-10" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {/* Blog */}
            <section className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm">Blog</h2>
                <a href="#" className="text-xs" style={{ color: "#F5C542" }}>See all →</a>
              </div>
              <div className="space-y-4">
                {[
                  { title: "How to Build a Winning Sports Content Calendar", date: "May 15, 2026", readTime: "6 min", tag: "Strategy", tagColor: "#3b82f6" },
                  { title: "Short-Form vs Long-Form: What Actually Works in Sports?", date: "May 10, 2026", readTime: "5 min", tag: "Formats", tagColor: "#f97316" },
                  { title: "5 AI Tools Every Sports Creator Should Be Using", date: "May 6, 2026", readTime: "7 min", tag: "Tools", tagColor: "#a855f7" },
                ].map((post) => (
                  <a key={post.title} href="#" className="block group">
                    <div className="flex items-start gap-2.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: post.tagColor + "22", color: post.tagColor }}>{post.tag}</span>
                      <div>
                        <p className="text-xs font-medium leading-snug mb-1 group-hover:underline" style={{ color: "var(--text-primary)" }}>{post.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{post.date} · {post.readTime} read</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Newsletter */}
            <DesktopNewsletter />

            {/* Follow SCP */}
            <section className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h2 className="font-bold text-sm mb-4">Follow SCP</h2>
              <div className="space-y-2.5">
                {[
                  { name: "Instagram", handle: "@scp_playbook", gradient: "linear-gradient(135deg,#833AB4,#C13584,#F56040)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
                  { name: "TikTok", handle: "@scpplaybook", gradient: "linear-gradient(135deg,#010101,#1a1a2e)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
                  { name: "YouTube", handle: "SCP Playbook", gradient: "linear-gradient(135deg,#FF0000,#CC0000)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
                  { name: "X", handle: "@SCP_Playbook", gradient: "linear-gradient(135deg,#14171A,#1a1a2e)", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { name: "LinkedIn", handle: "SCP Playbook", gradient: "linear-gradient(135deg,#0A66C2,#084d8f)", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
                ].map((sn) => (
                  <a key={sn.name} href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:opacity-90" style={{ background: "var(--bg-input)" }}>
                    <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: sn.gradient }}>
                      <span style={{ color: "white", display: "flex" }}>{sn.icon}</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{sn.name}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sn.handle}</div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto" style={{ color: "var(--text-muted)" }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 0 1-1h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                ))}
              </div>
            </section>
          </div>

          {/* WhatsApp community banner (desktop) */}
          <section className="mb-10 rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #075e54 0%, #128c7e 40%, #25d366 100%)" }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)" }} />
            <div className="relative flex flex-col sm:flex-row items-center gap-6 px-8 py-7">
              <div className="shrink-0 flex items-center justify-center rounded-2xl" style={{ width: 64, height: 64, background: "rgba(255,255,255,0.15)" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-2" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                  <span>●</span> Comunitat exclusiva
                </div>
                <h2 className="text-lg font-black text-white mb-1 leading-tight">Uneix-te a la comunitat de creadors de contingut</h2>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>Connecta amb altres creadors del món esportiu, comparteix estratègies, tendències i col·labora en temps real al nostre grup de WhatsApp.</p>
              </div>
              <div className="shrink-0">
                <a href="#" className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 hover:shadow-lg" style={{ background: "#fff", color: "#075e54", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                  Unir-me ara
                </a>
              </div>
            </div>
          </section>

          {/* Desktop news */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Sports & Creator News</h2>
              <Link href="/news" className="text-xs font-medium hover:underline" style={{ color: "#F5C542" }}>See all →</Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {newsItems.length === 0 ? (
                <p className="text-xs col-span-3 text-center py-6" style={{ color: "var(--text-muted)" }}>No news yet. Add some from the News section.</p>
              ) : newsItems.slice(0, 3).map((item) => {
                const color = item.platform ? (PLATFORM_COLORS[item.platform] ?? "#3b82f6") : "#3b82f6";
                const dateStr = item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl p-4 transition-all hover:border-opacity-80 group" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    {item.platform && (
                      <div className="text-[9px] font-bold uppercase tracking-wide mb-2 px-1.5 py-0.5 rounded w-fit" style={{ background: `${color}20`, color }}>
                        {item.platform}
                      </div>
                    )}
                    <p className="text-xs font-medium leading-relaxed mb-2 group-hover:underline" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{dateStr}</p>
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DesktopNewsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  return (
    <section className="rounded-xl p-5 flex flex-col" style={{ background: "linear-gradient(135deg, rgba(200,144,40,0.08) 0%, rgba(200,144,40,0.03) 100%)", border: "1px solid rgba(200,144,40,0.2)" }}>
      <div className="mb-auto">
        <div className="text-2xl mb-2">📬</div>
        <h2 className="font-bold text-sm mb-1">Subscribe to the newsletter</h2>
        <p className="text-[11px] leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>Get the best sports content insights, trends and inspiration directly in your inbox. Weekly, no spam.</p>
      </div>
      {subscribed ? (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          You&apos;re subscribed!
        </div>
      ) : (
        <div className="space-y-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
          <button onClick={() => { if (email) setSubscribed(true); }} className="w-full py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90" style={{ background: "#F5C542", color: "#fff" }}>Subscribe</button>
        </div>
      )}
    </section>
  );
}

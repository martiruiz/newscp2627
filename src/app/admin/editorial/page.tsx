"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const NEWS_PLATFORMS = ["Instagram", "TikTok", "X", "YouTube", "Facebook", "LinkedIn", "Snapchat", "WhatsApp", "Pinterest", "Threads", "Reddit"] as const;

export default function EditorialPage() {
  const [activeTab, setActiveTab] = useState<"news" | "blog">("news");

  // ── News state ──────────────────────────────────────────────────────────────
  const [newsArticles, setNewsArticles] = useState<{
    id: string; url: string; title: string; excerpt: string | null;
    imageUrl: string | null; platform: string | null; publishedAt: string | null; createdAt: string;
  }[]>([]);
  const [newsUrl, setNewsUrl] = useState("");
  const [newsScraping, setNewsScraping] = useState(false);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsPreview, setNewsPreview] = useState<{
    title: string; excerpt: string | null; imageUrl: string | null;
    platform: string | null; publishedAt: string;
  } | null>(null);
  const newsReqId = useRef(0);

  const fetchNews = useCallback(() => {
    fetch("/api/news").then((r) => r.json()).then((d) => setNewsArticles(d.articles || [])).catch(() => {});
  }, []);

  useEffect(() => { if (activeTab === "news") fetchNews(); }, [activeTab, fetchNews]);

  const handleNewsScrape = useCallback(async () => {
    if (!newsUrl.trim()) return;
    const id = ++newsReqId.current;
    setNewsScraping(true);
    setNewsError(null);
    setNewsPreview(null);
    try {
      const res = await fetch("/api/news/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newsUrl.trim() }),
      });
      if (id !== newsReqId.current) return;
      const data = await res.json();
      if (!res.ok) { setNewsError(data.error ?? "Could not extract the article."); return; }
      setNewsPreview({
        title: data.title,
        excerpt: data.excerpt,
        imageUrl: data.imageUrl,
        platform: data.platform,
        publishedAt: data.publishedAt
          ? new Date(data.publishedAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      });
    } catch {
      if (id !== newsReqId.current) return;
      setNewsError("Could not reach the article. Check the URL and try again.");
    } finally {
      if (id === newsReqId.current) setNewsScraping(false);
    }
  }, [newsUrl]);

  const handleNewsEdit = useCallback((art: typeof newsArticles[0]) => {
    setEditingNewsId(art.id);
    setNewsUrl(art.url);
    setNewsPreview({
      title: art.title,
      excerpt: art.excerpt,
      imageUrl: art.imageUrl,
      platform: art.platform,
      publishedAt: art.publishedAt ? art.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [newsArticles]);

  const handleNewsSave = useCallback(async () => {
    if (!newsPreview) return;
    setNewsSaving(true);
    setNewsError(null);
    try {
      const body = {
        title: newsPreview.title,
        excerpt: newsPreview.excerpt,
        imageUrl: newsPreview.imageUrl,
        platform: newsPreview.platform,
        publishedAt: newsPreview.publishedAt ? new Date(newsPreview.publishedAt).toISOString() : null,
      };
      const res = await fetch("/api/news", {
        method: editingNewsId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingNewsId ? { id: editingNewsId, ...body } : { url: newsUrl.trim(), ...body }),
      });
      const data = await res.json();
      if (!res.ok) { setNewsError(data.error ?? "Could not save. Try again."); return; }
      setNewsUrl("");
      setNewsPreview(null);
      setEditingNewsId(null);
      fetchNews();
    } catch {
      setNewsError("Could not save the article. Check your connection.");
    } finally {
      setNewsSaving(false);
    }
  }, [newsUrl, newsPreview, editingNewsId, fetchNews]);

  const handleNewsDelete = useCallback(async (id: string) => {
    await fetch(`/api/news?id=${id}`, { method: "DELETE" });
    setNewsArticles((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Blog state ──────────────────────────────────────────────────────────────
  const [blogTitle, setBlogTitle] = useState("");
  const [blogSubtitle, setBlogSubtitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("");
  const [blogDate, setBlogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [blogContent, setBlogContent] = useState("");
  const [blogImageUrl, setBlogImageUrl] = useState("");
  const [blogImagePreview, setBlogImagePreview] = useState<string | null>(null);
  const [blogImageAlt, setBlogImageAlt] = useState("");
  const [blogKeywords, setBlogKeywords] = useState("");
  const [blogEmbed1, setBlogEmbed1] = useState("");
  const [blogEmbed2, setBlogEmbed2] = useState("");
  const [blogEmbed3, setBlogEmbed3] = useState("");
  const [blogEmbed4, setBlogEmbed4] = useState("");
  const [blogEmbed5, setBlogEmbed5] = useState("");
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [embedCount, setEmbedCount] = useState(1);
  const [blogPosts, setBlogPosts] = useState<{
    id: string; title: string; subtitle: string | null; category: string | null;
    publishedAt: string | null; createdAt: string;
    content: string; imageUrl: string | null; imageAlt: string | null; keywords: string | null;
    embed1: string | null; embed2: string | null; embed3: string | null; embed4: string | null; embed5: string | null;
  }[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchBlogPosts = useCallback(() => {
    fetch("/api/blog").then((r) => r.json()).then((d) => setBlogPosts(d.posts || [])).catch(() => {});
  }, []);

  useEffect(() => { if (activeTab === "blog") fetchBlogPosts(); }, [activeTab, fetchBlogPosts]);

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    if (editorRef.current) setBlogContent(editorRef.current.innerHTML);
  }

  const handleImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setBlogImageUrl(dataUrl);
      setBlogImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const resetBlogForm = useCallback(() => {
    setBlogTitle(""); setBlogSubtitle(""); setBlogCategory(""); setBlogContent("");
    setBlogDate(new Date().toISOString().slice(0, 10));
    setBlogImageUrl(""); setBlogImagePreview(null); setBlogImageAlt(""); setBlogKeywords("");
    setBlogEmbed1(""); setBlogEmbed2(""); setBlogEmbed3(""); setBlogEmbed4(""); setBlogEmbed5("");
    setEmbedCount(1);
    setEditingPostId(null);
    if (editorRef.current) editorRef.current.innerHTML = "";
  }, []);

  const handleBlogEdit = useCallback((post: typeof blogPosts[0]) => {
    setEditingPostId(post.id);
    setBlogTitle(post.title);
    setBlogSubtitle(post.subtitle ?? "");
    setBlogCategory(post.category ?? "");
    setBlogDate(post.publishedAt ? post.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setBlogImageUrl(post.imageUrl ?? "");
    setBlogImagePreview(post.imageUrl ?? null);
    setBlogImageAlt(post.imageAlt ?? "");
    setBlogKeywords(post.keywords ?? "");
    setBlogEmbed1(post.embed1 ?? "");
    setBlogEmbed2(post.embed2 ?? "");
    setBlogEmbed3(post.embed3 ?? "");
    setBlogEmbed4(post.embed4 ?? "");
    setBlogEmbed5(post.embed5 ?? "");
    const count = [post.embed1, post.embed2, post.embed3, post.embed4, post.embed5].filter(Boolean).length;
    setEmbedCount(Math.max(1, count));
    setBlogContent(post.content);
    if (editorRef.current) editorRef.current.innerHTML = post.content;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [blogPosts]);

  const handleBlogSave = useCallback(async () => {
    if (!blogTitle.trim() || !blogContent.trim()) return;
    setBlogSaving(true);
    setBlogError(null);
    try {
      const body = {
        title: blogTitle, subtitle: blogSubtitle, category: blogCategory,
        publishedAt: blogDate, content: blogContent,
        imageUrl: blogImageUrl || null, imageAlt: blogImageAlt || null, keywords: blogKeywords || null,
        embed1: blogEmbed1 || null, embed2: blogEmbed2 || null, embed3: blogEmbed3 || null,
        embed4: blogEmbed4 || null, embed5: blogEmbed5 || null,
      };
      const res = await fetch("/api/blog", {
        method: editingPostId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPostId ? { id: editingPostId, ...body } : body),
      });
      const data = await res.json();
      if (!res.ok) { setBlogError(data.error ?? "Could not save. Try again."); return; }
      resetBlogForm();
      fetchBlogPosts();
    } catch { setBlogError("Could not save the post. Check your connection."); }
    finally { setBlogSaving(false); }
  }, [blogTitle, blogSubtitle, blogCategory, blogDate, blogContent, blogImageUrl, blogImageAlt, blogKeywords, blogEmbed1, blogEmbed2, blogEmbed3, blogEmbed4, blogEmbed5, editingPostId, resetBlogForm, fetchBlogPosts]);

  const handleBlogDelete = useCallback(async (id: string) => {
    await fetch(`/api/blog?id=${id}`, { method: "DELETE" });
    setBlogPosts((prev) => prev.filter((p) => p.id !== id));
    if (editingPostId === id) resetBlogForm();
  }, [editingPostId, resetBlogForm]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Editorial</h1>
            <div className="flex items-center gap-1 mt-3">
              {(["news", "blog"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: activeTab === tab ? "var(--color-charcoal)" : "var(--bg-input)",
                    color: activeTab === tab ? "#fff" : "var(--text-muted)",
                    border: activeTab === tab ? "none" : "1px solid var(--border-color)",
                  }}
                >
                  {tab === "news" ? "News" : "Blog"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── News tab ─────────────────────────────────────────────────────── */}
        {activeTab === "news" && (
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  {editingNewsId ? "Edit article" : "Add news article"}
                </h2>
                {editingNewsId && (
                  <button
                    onClick={() => { setEditingNewsId(null); setNewsUrl(""); setNewsPreview(null); setNewsError(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  value={newsUrl}
                  onChange={(e) => { if (!editingNewsId) { setNewsUrl(e.target.value); setNewsPreview(null); setNewsError(null); } }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !editingNewsId) handleNewsScrape(); }}
                  placeholder="https://sportspro.com/article/..."
                  readOnly={!!editingNewsId}
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: editingNewsId ? "var(--text-muted)" : "var(--text-primary)", opacity: editingNewsId ? 0.6 : 1 }}
                />
                <button
                  onClick={handleNewsScrape}
                  disabled={!newsUrl.trim() || newsScraping || !!editingNewsId}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shrink-0 disabled:opacity-50"
                  style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
                >
                  {newsScraping ? "Extracting…" : "Extract"}
                </button>
              </div>

              {newsError && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs mb-4"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="flex-1 leading-relaxed">{newsError}</span>
                  <button onClick={() => setNewsError(null)} className="shrink-0 hover:opacity-70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}

              {newsPreview && (
                <div className="space-y-4">
                  {newsPreview.imageUrl && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                      <img src={newsPreview.imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 160 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Title</label>
                      <input
                        value={newsPreview.title}
                        onChange={(e) => setNewsPreview((p) => p ? { ...p, title: e.target.value } : p)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Excerpt</label>
                      <textarea
                        value={newsPreview.excerpt ?? ""}
                        onChange={(e) => setNewsPreview((p) => p ? { ...p, excerpt: e.target.value } : p)}
                        rows={3} placeholder="Short description…"
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Platform</label>
                      <div className="flex flex-wrap gap-1.5">
                        {NEWS_PLATFORMS.map((pl) => {
                          const active = newsPreview.platform === pl;
                          return (
                            <button key={pl}
                              onClick={() => setNewsPreview((p) => p ? { ...p, platform: active ? null : pl } : p)}
                              className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                              style={{
                                background: active ? "var(--color-charcoal)" : "var(--bg-input)",
                                color: active ? "#fff" : "var(--text-muted)",
                                border: active ? "none" : "1px solid var(--border-color)",
                              }}
                            >{pl}</button>
                          );
                        })}
                        <button
                          onClick={() => setNewsPreview((p) => p ? { ...p, platform: null } : p)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                          style={{
                            background: !newsPreview.platform ? "var(--color-charcoal)" : "var(--bg-input)",
                            color: !newsPreview.platform ? "#fff" : "var(--text-muted)",
                            border: !newsPreview.platform ? "none" : "1px solid var(--border-color)",
                          }}
                        >None</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                        Publication date
                      </label>
                      <input
                        type="date"
                        value={newsPreview.publishedAt}
                        onChange={(e) => setNewsPreview((p) => p ? { ...p, publishedAt: e.target.value } : p)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleNewsSave}
                      disabled={!newsPreview.title.trim() || newsSaving}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
                    >
                      {newsSaving ? (editingNewsId ? "Saving…" : "Publishing…") : (editingNewsId ? "Save changes" : "Publish article")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {newsArticles.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <div className="px-6 py-3 flex items-center justify-between"
                  style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    {newsArticles.length} article{newsArticles.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ background: "var(--bg-card)" }}>
                  {newsArticles.map((art, i) => (
                    <div key={art.id} className="flex items-center gap-4 px-6 py-3"
                      style={{ borderBottom: i < newsArticles.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                      {art.imageUrl && (
                        <img src={art.imageUrl} alt="" className="rounded-lg object-cover shrink-0"
                          style={{ width: 48, height: 36 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{art.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {art.platform && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>
                              {art.platform}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {new Date(art.publishedAt ?? art.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <a href={art.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-semibold hover:underline shrink-0"
                        style={{ color: "var(--text-muted)" }}>
                        View ↗
                      </a>
                      <button onClick={() => handleNewsEdit(art)}
                        className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 shrink-0"
                        style={{ width: 28, height: 28, background: editingNewsId === art.id ? "var(--color-charcoal)" : "var(--bg-input)", border: "1px solid var(--border-color)", color: editingNewsId === art.id ? "#fff" : "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleNewsDelete(art.id)}
                        className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 shrink-0"
                        style={{ width: 28, height: 28, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "#ef4444" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Blog tab ─────────────────────────────────────────────────────── */}
        {activeTab === "blog" && (
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  {editingPostId ? "Edit blog post" : "New blog post"}
                </h2>
                {editingPostId && (
                  <button onClick={resetBlogForm} className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                    Cancel
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Title *</label>
                  <input value={blogTitle} onChange={(e) => setBlogTitle(e.target.value)} placeholder="Post title…" className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Subtitle / Lead</label>
                  <input value={blogSubtitle} onChange={(e) => setBlogSubtitle(e.target.value)} placeholder="Optional subtitle or lead paragraph…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Category</label>
                    <input value={blogCategory} onChange={(e) => setBlogCategory(e.target.value)} placeholder="e.g. Strategy, Marketing…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Publication date</label>
                    <input type="date" value={blogDate} onChange={(e) => setBlogDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", colorScheme: "dark" }} />
                  </div>
                </div>

                {/* Embeds */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Embeds centrats <span className="font-normal normal-case">(màx. 5)</span>
                  </label>
                  <div className="space-y-2">
                    {([
                      { val: blogEmbed1, set: setBlogEmbed1, label: "Embed 1" },
                      { val: blogEmbed2, set: setBlogEmbed2, label: "Embed 2" },
                      { val: blogEmbed3, set: setBlogEmbed3, label: "Embed 3" },
                      { val: blogEmbed4, set: setBlogEmbed4, label: "Embed 4" },
                      { val: blogEmbed5, set: setBlogEmbed5, label: "Embed 5" },
                    ] as { val: string; set: (v: string) => void; label: string }[]).slice(0, embedCount).map((e, idx) => (
                      <div key={e.label} className="flex gap-2 items-start">
                        <textarea
                          value={e.val}
                          onChange={(ev) => e.set(ev.target.value)}
                          placeholder={`${e.label}: enganxa el codi <iframe> o embed…`}
                          rows={2}
                          className="flex-1 px-4 py-2.5 rounded-xl text-xs font-mono outline-none resize-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        />
                        {idx === embedCount - 1 && embedCount > 1 && (
                          <button
                            onClick={() => { e.set(""); setEmbedCount((c) => c - 1); }}
                            className="mt-1 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0"
                            style={{ width: 28, height: 28, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "#ef4444" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {embedCount < 5 && (
                      <button
                        onClick={() => setEmbedCount((c) => Math.min(5, c + 1))}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Afegir embed
                      </button>
                    )}
                  </div>
                </div>

                {/* Featured image */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Featured image</label>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                  {blogImagePreview ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                      <img src={blogImagePreview} alt="preview" className="w-full object-cover" style={{ maxHeight: 200 }} />
                      <button
                        onClick={() => { setBlogImageUrl(""); setBlogImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                        className="absolute top-2 right-2 flex items-center justify-center rounded-lg text-xs font-bold hover:opacity-90"
                        style={{ width: 28, height: 28, background: "rgba(0,0,0,0.6)", color: "#fff" }}
                      >×</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shrink-0"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Upload image
                      </button>
                      <input
                        value={blogImageUrl}
                        onChange={(e) => { setBlogImageUrl(e.target.value); setBlogImagePreview(e.target.value || null); }}
                        placeholder="…or paste image URL"
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Image alt text</label>
                    <input value={blogImageAlt} onChange={(e) => setBlogImageAlt(e.target.value)} placeholder="Describe the image…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>SEO keywords</label>
                    <input value={blogKeywords} onChange={(e) => setBlogKeywords(e.target.value)} placeholder="sports marketing, social media…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                </div>

                {/* Rich text editor */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Content *</label>
                  <div className="flex items-center gap-1 flex-wrap px-2.5 py-2 rounded-t-xl" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", borderBottom: "none" }}>
                    {[
                      { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>, cmd: "undo", title: "Undo" },
                      { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>, cmd: "redo", title: "Redo" },
                    ].map((btn) => (
                      <button key={btn.cmd} onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        title={btn.title}>{btn.icon}</button>
                    ))}
                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />
                    {[
                      { label: <strong>B</strong>, cmd: "bold", title: "Bold" },
                      { label: <em>I</em>, cmd: "italic", title: "Italic" },
                      { label: <u>U</u>, cmd: "underline", title: "Underline" },
                      { label: <s>S</s>, cmd: "strikeThrough", title: "Strikethrough" },
                    ].map((btn, i) => (
                      <button key={i} onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        title={btn.title}>{btn.label}</button>
                    ))}
                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />
                    {[
                      { label: "¶", val: "p" }, { label: "H1", val: "h1" }, { label: "H2", val: "h2" }, { label: "H3", val: "h3" },
                    ].map((btn) => (
                      <button key={btn.val} onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", btn.val); }}
                        className="px-1.5 h-7 flex items-center justify-center rounded-md text-[11px] font-bold transition-all hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>{btn.label}</button>
                    ))}
                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }} title="Bullet list">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }} title="Numbered list">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" strokeWidth="1.5"/><path d="M4 10h2" strokeWidth="1.5"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeWidth="1.5"/></svg>
                    </button>
                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />
                    <button onMouseDown={(e) => { e.preventDefault(); const url = prompt("URL:"); if (url) execCmd("createLink", url); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }} title="Insert link">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("removeFormat"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }} title="Remove formatting">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    </button>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => { if (editorRef.current) setBlogContent(editorRef.current.innerHTML); }}
                    className="min-h-[280px] px-5 py-4 rounded-b-xl text-sm outline-none"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", lineHeight: 1.75 }}
                    data-placeholder="Write your post content here…"
                  />
                </div>

                {blogError && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
                    <span className="flex-1">{blogError}</span>
                    <button onClick={() => setBlogError(null)} className="hover:opacity-70"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleBlogSave} disabled={!blogTitle.trim() || !blogContent.trim() || blogSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
                    {blogSaving ? (editingPostId ? "Saving…" : "Publishing…") : (editingPostId ? "Save changes" : "Publish post")}
                  </button>
                </div>
              </div>
            </div>

            {blogPosts.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <div className="px-6 py-3 flex items-center justify-between" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{blogPosts.length} post{blogPosts.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ background: "var(--bg-card)" }}>
                  {blogPosts.map((post, i) => (
                    <div key={post.id} className="flex items-center gap-4 px-6 py-3"
                      style={{ borderBottom: i < blogPosts.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                      <a href="/news?tab=blog" className="flex-1 min-w-0 group/post" style={{ textDecoration: "none" }}>
                        <p className="text-sm font-semibold truncate transition-opacity group-hover/post:opacity-70" style={{ color: "var(--text-primary)" }}>{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {post.category && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>{post.category}</span>}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </a>
                      <button onClick={() => handleBlogEdit(post)}
                        className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 shrink-0"
                        style={{ width: 28, height: 28, background: editingPostId === post.id ? "var(--color-charcoal)" : "var(--bg-input)", border: "1px solid var(--border-color)", color: editingPostId === post.id ? "#fff" : "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleBlogDelete(post.id)}
                        className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 shrink-0"
                        style={{ width: 28, height: 28, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "#ef4444" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

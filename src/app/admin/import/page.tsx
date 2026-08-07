"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";

// ── Validation ────────────────────────────────────────────────────────────────

const KNOWN_PLATFORMS = new Set(["instagram", "tiktok", "youtube", "twitter", "x", "facebook", "linkedin", "pinterest"]);
const KNOWN_FORMATS   = new Set(["image", "images", "video", "videos", "reel", "reels", "carousel", "story", "stories", "short"]);
const EXPECTED_COLS   = new Set(["external_id", "id", "url", "embed", "platform", "platforms", "format", "formats", "sport", "sports", "competition", "competitions", "club", "clubs", "entity", "entities", "title", "published_at", "date", "trend", "campaign"]);

interface ValidationIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

function validatePreview(preview: PreviewData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const headers = preview.headers.map((h) => h.toLowerCase().trim());

  // 1. Check recognized column headers
  const recognizedCols = headers.filter((h) => EXPECTED_COLS.has(h));
  const unrecognizedCols = headers.filter((h) => !EXPECTED_COLS.has(h));
  if (recognizedCols.length === 0) {
    issues.push({ level: "error", field: "Columns", message: `No recognized columns found. Headers detected: ${headers.join(", ")}. Expected names like: url, platform, format, sport, competition, club, entity.` });
  } else if (unrecognizedCols.length > 0) {
    issues.push({ level: "warning", field: "Columns", message: `Unrecognized columns (will be ignored): ${unrecognizedCols.join(", ")}.` });
  }

  // 2. Platform values
  const badPlatforms = preview.taxonomy.platforms.filter((p) => !KNOWN_PLATFORMS.has(p.toLowerCase()));
  if (preview.taxonomy.platforms.length > 8) {
    issues.push({ level: "error", field: "Platform", message: `${preview.taxonomy.platforms.length} unique platform values detected — this is too many. The "platform" column may be mapped to wrong data (e.g. club names or titles).` });
  } else if (badPlatforms.length > 0) {
    issues.push({ level: "error", field: "Platform", message: `Unknown platform values: ${badPlatforms.join(", ")}. Expected: Instagram, TikTok, YouTube, Twitter/X, Facebook, LinkedIn, Pinterest.` });
  }

  // 3. Format values
  const badFormats = preview.taxonomy.formats.filter((f) => !KNOWN_FORMATS.has(f.toLowerCase()));
  if (preview.taxonomy.formats.length > 12) {
    issues.push({ level: "error", field: "Format", message: `${preview.taxonomy.formats.length} unique format values detected — this is too many. The "format" column may contain wrong data (e.g. ${badFormats.slice(0, 3).join(", ")}...).` });
  } else if (badFormats.length > 3) {
    issues.push({ level: "error", field: "Format", message: `Unusual format values: ${badFormats.slice(0, 5).join(", ")}${badFormats.length > 5 ? ` +${badFormats.length - 5} more` : ""}. Expected: Image, Video, Reel, Carousel, Story.` });
  } else if (badFormats.length > 0) {
    issues.push({ level: "warning", field: "Format", message: `Unusual format values: ${badFormats.join(", ")}. Expected: Image, Video, Reel, Carousel, Story.` });
  }

  // 4. Zero valid rows
  if (preview.totalRows > 0 && preview.validRows === 0) {
    issues.push({ level: "error", field: "Rows", message: "No valid rows found. Check that the CSV has a url, embed or external_id column with valid content." });
  }

  return issues;
}

interface ImportBatch {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  importedRows: number | null;
  updatedRows: number | null;
  skippedRows: number | null;
  invalidRows: number | null;
  failedRows: number | null;
  processingTime: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface PreviewData {
  filename: string;
  totalRows: number;
  sampledRows?: number;
  sampled?: boolean;
  headers: string[];
  validRows: number;
  invalidRows: number;
  existingPublications: number;
  newPublications: number;
  preview: Array<Record<string, unknown>>;
  taxonomy: {
    sports: string[];
    competitions: string[];
    entities: string[];
    formats: string[];
    platforms: string[];
  };
  errors: Array<{ row: number; externalId: string; error: string }>;
}

interface ImportResult {
  batchId: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  invalid: number;
  failed: number;
  processingTime: number;
  errors: Array<{
    row: number;
    externalId: string;
    url: string;
    errorCode: string;
    explanation: string;
  }>;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"csv" | "news" | "blog">("csv");

  // ── News tab state ──────────────────────────────────────────────────────────
  const [newsArticles, setNewsArticles] = useState<{
    id: string; url: string; title: string; excerpt: string | null;
    imageUrl: string | null; platform: string | null; publishedAt: string | null; createdAt: string;
  }[]>([]);
  const [newsUrl, setNewsUrl] = useState("");
  const [newsScraping, setNewsScraping] = useState(false);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
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

  const handleNewsSave = useCallback(async () => {
    if (!newsPreview) return;
    setNewsSaving(true);
    setNewsError(null);
    try {
      const res = await fetch("/api/news", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newsUrl.trim(),
          title: newsPreview.title,
          excerpt: newsPreview.excerpt,
          imageUrl: newsPreview.imageUrl,
          platform: newsPreview.platform,
          publishedAt: newsPreview.publishedAt ? new Date(newsPreview.publishedAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNewsError(data.error ?? "Could not save. Try again."); return; }
      setNewsUrl("");
      setNewsPreview(null);
      fetchNews();
    } catch {
      setNewsError("Could not save the article. Check your connection.");
    } finally {
      setNewsSaving(false);
    }
  }, [newsUrl, newsPreview, fetchNews]);

  const handleNewsDelete = useCallback(async (id: string) => {
    await fetch(`/api/news?id=${id}`, { method: "DELETE" });
    setNewsArticles((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const NEWS_PLATFORMS = ["Instagram", "TikTok", "X", "YouTube", "Facebook", "LinkedIn", "Snapchat", "WhatsApp", "Pinterest", "Threads", "Reddit"] as const;

  // ── Blog tab state ──────────────────────────────────────────────────────────
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

  // ── CSV tab state ───────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [showNewImport, setShowNewImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [warningsConfirmed, setWarningsConfirmed] = useState(false);
  const validationIssues = useMemo(() => preview ? validatePreview(preview) : [], [preview]);
  const hasErrors = validationIssues.some((i) => i.level === "error");
  const canImport = !hasErrors || warningsConfirmed;
  const [progress, setProgress] = useState<{
    percent: number;
    processed: number;
    totalRows: number;
    imported: number;
    updated: number;
    skipped: number;
    etaMs: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchBatches = useCallback(() => {
    fetch("/api/import/history")
      .then((r) => r.json())
      .then(setBatches)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(null);
      setResult(null);
      setError(null);
      setStep("upload");
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "preview");
    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPreview(data);
      setStep("preview");
    } catch (e) { setError((e as Error).message); }
  }, [file]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setStep("importing");
    setProgress(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "import");
      const res = await fetch("/api/import", { method: "POST", body: formData });

      if (!res.body) {
        const data = await res.json();
        if (data.error) { setError(data.error); setStep("preview"); return; }
        setResult(data);
        setStep("done");
        fetchBatches();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setProgress({
                percent: msg.percent,
                processed: msg.processed,
                totalRows: msg.totalRows,
                imported: msg.imported,
                updated: msg.updated,
                skipped: msg.skipped,
                etaMs: msg.etaMs,
              });
            } else if (msg.type === "done") {
              setResult(msg);
              setStep("done");
              fetchBatches();
            }
          } catch {}
        }
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const isNetworkError = msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("network");
      if (isNetworkError) {
        // Connection dropped — check if the batch actually completed on the server
        try {
          await new Promise((r) => setTimeout(r, 2500));
          const histRes = await fetch("/api/import/history");
          const batches: ImportBatch[] = await histRes.json();
          const latest = batches[0];
          if (
            latest &&
            latest.status === "completed" &&
            latest.filename === file.name &&
            Date.now() - new Date(latest.createdAt).getTime() < 10 * 60 * 1000
          ) {
            setResult({
              batchId: latest.id,
              totalRows: latest.totalRows,
              imported: latest.importedRows ?? 0,
              updated: latest.updatedRows ?? 0,
              skipped: latest.skippedRows ?? 0,
              invalid: latest.invalidRows ?? 0,
              failed: latest.failedRows ?? 0,
              processingTime: latest.processingTime ?? 0,
              errors: [],
            });
            setStep("done");
            fetchBatches();
            return;
          }
        } catch {}
        setError("La connexió s'ha interromput. Comprova l'historial per veure si l'import s'ha completat.");
      } else {
        setError(msg);
      }
      setStep("preview");
    }
    finally { setImporting(false); }
  }, [file, fetchBatches]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting) return;
    setDeleting(id);
    try {
      await fetch(`/api/import/history?id=${id}`, { method: "DELETE" });
      fetchBatches();
    } finally { setDeleting(null); }
  }, [deleting, fetchBatches]);

  const closeNewImport = useCallback(() => {
    setShowNewImport(false);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep("upload");
    setWarningsConfirmed(false);
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toISOString().replace("T", " ").slice(0, 19);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header + tabs */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Import</h1>
            <div className="flex items-center gap-1 mt-3">
              {(["csv", "news", "blog"] as const).map((tab) => (
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
                  {tab === "csv" ? "CSV Import" : tab === "news" ? "News" : "Blog"}
                </button>
              ))}
            </div>
          </div>
          {activeTab === "csv" && (
            <button
              onClick={() => setShowNewImport(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              New Import
            </button>
          )}
        </div>

        {/* ── News tab ──────────────────────────────────────────────────────── */}
        {activeTab === "news" && (
          <div className="space-y-6">
            {/* Add article form */}
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h2 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Add news article</h2>

              {/* URL row */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newsUrl}
                  onChange={(e) => { setNewsUrl(e.target.value); setNewsPreview(null); setNewsError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewsScrape(); }}
                  placeholder="https://sportspro.com/article/..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={handleNewsScrape}
                  disabled={!newsUrl.trim() || newsScraping}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shrink-0 disabled:opacity-50"
                  style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
                >
                  {newsScraping ? "Extracting…" : "Extract"}
                </button>
              </div>

              {/* Error */}
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

              {/* Preview form */}
              {newsPreview && (
                <div className="space-y-4">
                  {/* Image preview */}
                  {newsPreview.imageUrl && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                      <img src={newsPreview.imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 160 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}

                  {/* Title + Excerpt */}
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
                        rows={3}
                        placeholder="Short description…"
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                      />
                    </div>
                  </div>

                  {/* Platform + Date */}
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
                        Publication date <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(used for date filters)</span>
                      </label>
                      <input
                        type="date"
                        value={newsPreview.publishedAt}
                        onChange={(e) => setNewsPreview((p) => p ? { ...p, publishedAt: e.target.value } : p)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", colorScheme: "dark" }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Default: today&apos;s date</p>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleNewsSave}
                      disabled={!newsPreview.title.trim() || newsSaving}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}
                    >
                      {newsSaving ? "Publishing…" : "Publish article"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Articles list */}
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

        {/* ── Blog tab ──────────────────────────────────────────────────────── */}
        {activeTab === "blog" && (
          <div className="space-y-6">
            {/* Blog post form */}
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
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Title *</label>
                  <input value={blogTitle} onChange={(e) => setBlogTitle(e.target.value)} placeholder="Post title…" className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Subtitle / Lead</label>
                  <input value={blogSubtitle} onChange={(e) => setBlogSubtitle(e.target.value)} placeholder="Optional subtitle or lead paragraph…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>

                {/* Category + Date row */}
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

                {/* ── Embeds ── */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Embeds centrats <span className="font-normal normal-case">(màx. 5 — apareixen entre el subtítol i el cos)</span>
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
                          placeholder={`${e.label}: enganxa el codi <iframe> o embed d'Instagram, YouTube, TikTok…`}
                          rows={2}
                          className="flex-1 px-4 py-2.5 rounded-xl text-xs font-mono outline-none resize-none"
                          style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        />
                        {idx === embedCount - 1 && embedCount > 1 && (
                          <button
                            onClick={() => { e.set(""); setEmbedCount((c) => c - 1); }}
                            className="mt-1 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity shrink-0"
                            style={{ width: 28, height: 28, background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "#ef4444" }}
                            title="Remove embed"
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

                {/* ── Featured image ── */}
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
                        title="Remove image"
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

                {/* Image alt (SEO) + Post keywords row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Image alt text
                      <span className="ml-1 font-normal normal-case" style={{ color: "var(--text-muted)" }}>(SEO)</span>
                    </label>
                    <input value={blogImageAlt} onChange={(e) => setBlogImageAlt(e.target.value)} placeholder="Describe the image for search engines…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                      SEO keywords
                      <span className="ml-1 font-normal normal-case" style={{ color: "var(--text-muted)" }}>(Google positioning)</span>
                    </label>
                    <input value={blogKeywords} onChange={(e) => setBlogKeywords(e.target.value)} placeholder="sports marketing, social media, content…" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                </div>

                {/* ── Rich text editor ── */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Content *</label>
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 flex-wrap px-2.5 py-2 rounded-t-xl" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", borderBottom: "none" }}>

                    {/* History */}
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

                    {/* Text styles */}
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

                    {/* Block format */}
                    {[
                      { label: "¶", val: "p", title: "Paragraph" },
                      { label: "H1", val: "h1", title: "Heading 1" },
                      { label: "H2", val: "h2", title: "Heading 2" },
                      { label: "H3", val: "h3", title: "Heading 3" },
                    ].map((btn) => (
                      <button key={btn.val} onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", btn.val); }}
                        className="px-1.5 h-7 flex items-center justify-center rounded-md text-[11px] font-bold transition-all hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        title={btn.title}>{btn.label}</button>
                    ))}

                    {/* Blockquote */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", "blockquote"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Blockquote">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm14 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                    </button>

                    {/* Code block */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", "pre"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Code block">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    </button>

                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />

                    {/* Alignment */}
                    {[
                      { cmd: "justifyLeft", title: "Align left", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg> },
                      { cmd: "justifyCenter", title: "Align center", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg> },
                      { cmd: "justifyRight", title: "Align right", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg> },
                      { cmd: "justifyFull", title: "Justify", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
                    ].map((btn) => (
                      <button key={btn.cmd} onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                        title={btn.title}>{btn.icon}</button>
                    ))}

                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />

                    {/* Lists */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Bullet list">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Numbered list">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 10h2" stroke="currentColor" strokeWidth="1.5"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor" strokeWidth="1.5"/></svg>
                    </button>

                    {/* Indent */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("indent"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Indent">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><polyline points="7 12 11 9 7 6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("outdent"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Outdent">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><polyline points="11 12 7 9 11 6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>

                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />

                    {/* Font size */}
                    <select
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => { execCmd("fontSize", e.target.value); e.target.value = ""; }}
                      className="h-7 px-1 rounded-md text-[11px] outline-none cursor-pointer"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      defaultValue=""
                      title="Font size"
                    >
                      <option value="" disabled>Size</option>
                      <option value="1">Small</option>
                      <option value="3">Normal</option>
                      <option value="5">Large</option>
                      <option value="7">Huge</option>
                    </select>

                    {/* Text color */}
                    <label className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all hover:opacity-80 relative"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                      title="Text color">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0-4-4L4 16v4z"/><line x1="13.5" y1="6.5" x2="17.5" y2="10.5"/></svg>
                      <input type="color" className="absolute opacity-0 w-0 h-0"
                        onChange={(e) => { editorRef.current?.focus(); execCmd("foreColor", e.target.value); }} />
                    </label>

                    {/* Highlight */}
                    <label className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all hover:opacity-80 relative"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                      title="Highlight color">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      <input type="color" className="absolute opacity-0 w-0 h-0"
                        onChange={(e) => { editorRef.current?.focus(); execCmd("hiliteColor", e.target.value); }} />
                    </label>

                    <div style={{ width: 1, height: 20, background: "var(--border-color)", margin: "0 3px" }} />

                    {/* Link */}
                    <button onMouseDown={(e) => { e.preventDefault(); const url = prompt("URL:"); if (url) execCmd("createLink", url); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Insert link">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>

                    {/* Unlink */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("unlink"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Remove link">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>

                    {/* HR */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("insertHorizontalRule"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Horizontal rule">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    </button>

                    {/* Remove formatting */}
                    <button onMouseDown={(e) => { e.preventDefault(); execCmd("removeFormat"); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-all hover:opacity-80"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                      title="Remove formatting">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    </button>
                  </div>

                  {/* Editor area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => { if (editorRef.current) setBlogContent(editorRef.current.innerHTML); }}
                    className="min-h-[280px] px-5 py-4 rounded-b-xl text-sm outline-none"
                    style={{
                      background: "var(--bg-input)", border: "1px solid var(--border-color)",
                      color: "var(--text-primary)", lineHeight: 1.75,
                    }}
                    data-placeholder="Write your post content here…"
                  />
                </div>

                {/* Error */}
                {blogError && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
                    <span className="flex-1">{blogError}</span>
                    <button onClick={() => setBlogError(null)} className="hover:opacity-70"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                )}

                {/* Submit */}
                <div className="flex justify-end">
                  <button onClick={handleBlogSave} disabled={!blogTitle.trim() || !blogContent.trim() || blogSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--selected-bg)", color: "var(--selected-text)" }}>
                    {blogSaving ? (editingPostId ? "Saving…" : "Publishing…") : (editingPostId ? "Save changes" : "Publish post")}
                  </button>
                </div>
              </div>
            </div>

            {/* Blog posts list */}
            {blogPosts.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <div className="px-6 py-3 flex items-center justify-between" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{blogPosts.length} post{blogPosts.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ background: "var(--bg-card)" }}>
                  {blogPosts.map((post, i) => (
                    <div key={post.id} className="flex items-center gap-4 px-6 py-3"
                      style={{ borderBottom: i < blogPosts.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                      <Link href="/news?tab=blog" className="flex-1 min-w-0 group/post" style={{ textDecoration: "none" }}>
                        <p className="text-sm font-semibold truncate transition-opacity group-hover/post:opacity-70" style={{ color: "var(--text-primary)" }}>{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {post.category && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-charcoal-subtle)", color: "var(--color-charcoal)" }}>{post.category}</span>}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </Link>
                      <button onClick={() => handleBlogEdit(post)}
                        className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 shrink-0"
                        style={{ width: 28, height: 28, background: editingPostId === post.id ? "var(--color-charcoal)" : "var(--bg-input)", border: "1px solid var(--border-color)", color: editingPostId === post.id ? "#fff" : "var(--text-muted)" }}
                        title="Edit post">
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

        {/* ── CSV tab ───────────────────────────────────────────────────────── */}
        {activeTab === "csv" && (
        <div className="csv-tab-content">

        {/* Import history table */}
        {batches.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ color: "var(--text-muted)" }}>No imports yet</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["FILE", "STATUS", "ROWS", "CREATED", "REPLACED", "SKIPPED", "DATE", "ACTIONS"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="px-4 py-3.5 font-medium">{b.filename}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: b.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                            color: b.status === "completed" ? "var(--accent-green)" : "var(--accent-blue)",
                          }}
                        >
                          {b.status === "completed" ? "Completed" : b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{b.totalRows}</td>
                      <td className="px-4 py-3.5" style={{ color: "var(--accent-green)" }}>
                        {b.importedRows ?? 0}
                      </td>
                      <td className="px-4 py-3.5" style={{ color: (b.updatedRows ?? 0) > 0 ? "var(--accent-orange)" : "var(--text-primary)" }}>
                        {b.updatedRows ?? 0}
                      </td>
                      <td className="px-4 py-3.5">{b.skippedRows ?? 0}</td>
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {formatDate(b.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={deleting === b.id}
                            className="p-1.5 rounded transition-colors hover:opacity-70"
                            title="Delete import"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        </div>
        )}

        {showNewImport && (
          <div>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={closeNewImport} />
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] overflow-y-auto z-50 rounded-2xl p-6"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  New Import
                </h2>
                <button onClick={closeNewImport} className="text-xl" style={{ color: "var(--text-muted)" }}>
                  &times;
                </button>
              </div>

              {step === "upload" && (
                <div>
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl cursor-pointer transition-colors"
                    style={{ background: "var(--bg-input)", border: "2px dashed var(--border-color)" }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {file ? file.name : "Click to select a CSV file"}
                    </span>
                    {file && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  {file && (
                    <button
                      onClick={handlePreview}
                      className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold"
                      style={{ background: "var(--accent-blue)", color: "#fff" }}
                    >
                      Preview
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: "rgba(239,68,68,0.15)", color: "var(--accent-red)" }}>
                  {error}
                </div>
              )}

              {preview && step === "preview" && (
                <div>
                  <div className="mb-3 p-3 rounded-lg" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}>
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Columns detected in your CSV</p>
                    <div className="flex flex-wrap gap-1">
                      {preview.headers.map((h) => {
                        const isKnown = EXPECTED_COLS.has(h.toLowerCase().trim());
                        return (
                          <span key={h} className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{ background: isKnown ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)", color: isKnown ? "var(--accent-green)" : "var(--accent-red)", border: `1px solid ${isKnown ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                            {h}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatBox label="Total rows" value={preview.totalRows} />
                    <StatBox label={preview.sampled ? "Valid (est.)" : "Valid"} value={preview.validRows} color="var(--accent-green)" />
                    <StatBox label={preview.sampled ? "Invalid (est.)" : "Invalid"} value={preview.invalidRows} color="var(--accent-red)" />
                    <StatBox label="Existing" value={preview.existingPublications} color="var(--accent-orange)" />
                  </div>
                  {preview.sampled && (
                    <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                      Estimated from a sample of {preview.sampledRows?.toLocaleString()} rows
                    </p>
                  )}
                  <div className="mb-4">
                    <h4 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Taxonomy</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(preview.taxonomy).map(([key, values]) => {
                        const fieldIssue = validationIssues.find((i) => i.field.toLowerCase() === key.toLowerCase());
                        return values.length > 0 ? (
                          <div key={key}>
                            <span className="text-xs font-medium capitalize" style={{ color: fieldIssue ? (fieldIssue.level === "error" ? "var(--accent-red)" : "#f59e0b") : "var(--text-muted)" }}>{key}:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {values.slice(0, 10).map((v: string) => {
                                const isOdd = (key === "platforms" && !KNOWN_PLATFORMS.has(v.toLowerCase())) ||
                                             (key === "formats" && !KNOWN_FORMATS.has(v.toLowerCase()));
                                return (
                                  <span key={v} className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: isOdd ? "rgba(239,68,68,0.12)" : "var(--bg-hover)", color: isOdd ? "var(--accent-red)" : "var(--text-primary)", border: isOdd ? "1px solid rgba(239,68,68,0.3)" : "none" }}>
                                    {v}
                                  </span>
                                );
                              })}
                              {values.length > 10 && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>+{values.length - 10} more</span>
                              )}
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                  {validationIssues.length > 0 && (
                    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${hasErrors ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}` }}>
                      <div className="flex items-center gap-2 px-3 py-2" style={{ background: hasErrors ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={hasErrors ? "var(--accent-red)" : "#f59e0b"} strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span className="text-xs font-semibold" style={{ color: hasErrors ? "var(--accent-red)" : "#f59e0b" }}>
                          {hasErrors ? "Possible mapping errors detected" : "Warnings"}
                        </span>
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-1.5">
                        {validationIssues.map((issue, i) => (
                          <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <span className="font-semibold shrink-0" style={{ color: issue.level === "error" ? "var(--accent-red)" : "#f59e0b" }}>
                              [{issue.field}]
                            </span>
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                      {hasErrors && (
                        <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer" style={{ background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(239,68,68,0.2)" }}>
                          <input type="checkbox" checked={warningsConfirmed} onChange={(e) => setWarningsConfirmed(e.target.checked)} className="w-4 h-4 rounded" />
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>I understand the risks and want to import anyway</span>
                        </label>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={importing || !canImport}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                    style={{ background: canImport ? "var(--accent-green)" : "var(--bg-hover)", color: canImport ? "#fff" : "var(--text-muted)", cursor: canImport ? "pointer" : "not-allowed" }}
                  >
                    Import {preview.validRows.toLocaleString()} valid rows
                  </button>
                </div>
              )}

              {step === "importing" && (
                <div className="py-8">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Importing...</span>
                      <span className="text-sm font-bold" style={{ color: "var(--accent-blue)" }}>{progress ? `${progress.percent}%` : "0%"}</span>
                    </div>
                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress?.percent || 0}%`, background: "linear-gradient(90deg, var(--accent-blue), var(--accent-green))" }} />
                    </div>
                  </div>
                  {progress && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--accent-green)" }}>{progress.imported.toLocaleString()}</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Created</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{progress.processed.toLocaleString()} / {progress.totalRows.toLocaleString()}</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Processed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--text-secondary)" }}>
                          {progress.etaMs > 60000 ? `${Math.ceil(progress.etaMs / 60000)} min` : `${Math.ceil(progress.etaMs / 1000)}s`}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Remaining</div>
                      </div>
                    </div>
                  )}
                  {!progress && (
                    <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>Starting...</p>
                  )}
                </div>
              )}

              {result && step === "done" && (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <StatBox label="Created" value={result.imported} color="var(--accent-green)" />
                    <StatBox label="Replaced" value={result.updated} color="var(--accent-orange)" />
                    <StatBox label="Skipped" value={result.skipped} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={closeNewImport} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
                      Close
                    </button>
                    <a href="/feed" className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center" style={{ background: "var(--accent-blue)", color: "#fff" }}>
                      View Feed
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--bg-input)" }}>
      <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: color || "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

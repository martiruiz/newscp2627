"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
// News and blog sections moved to /admin/editorial
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
  const [activeTab, setActiveTab] = useState<"urls" | "csv">("urls");

  // ── URL import tab state ────────────────────────────────────────────────────
  const [urlText, setUrlText] = useState("");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResult, setUrlResult] = useState<{
    total: number; created: number; duplicate: number; ignored: number; failed: number;
    errors: { url: string; error: string }[];
  } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const parsedUrls = urlText.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith("http"));

  async function handleUrlImport() {
    if (parsedUrls.length === 0) return;
    setUrlImporting(true);
    setUrlError(null);
    setUrlResult(null);
    try {
      const res = await fetch("/api/admin/import-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: parsedUrls }),
      });
      const data = await res.json();
      if (!res.ok) { setUrlError(data.error ?? "Import failed"); return; }
      setUrlResult(data);
      setUrlText("");
    } catch {
      setUrlError("Network error. Check your connection.");
    } finally {
      setUrlImporting(false);
    }
  }

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
              {(["urls", "csv"] as const).map((tab) => (
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
                  {tab === "urls" ? "Per URL" : "CSV Import"}
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

        {/* ── Per URL tab ───────────────────────────────────────────────────── */}
        {activeTab === "urls" && (
          <div className="space-y-5">
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h2 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>Importació per URL</h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Enganxa fins a 100 URLs (una per línia). Suportat: YouTube, TikTok, Instagram, X/Twitter, Facebook, LinkedIn.
              </p>
              <textarea
                value={urlText}
                onChange={(e) => { setUrlText(e.target.value); setUrlResult(null); setUrlError(null); }}
                placeholder={"https://www.youtube.com/watch?v=…\nhttps://www.instagram.com/p/…\nhttps://x.com/user/status/…"}
                rows={8}
                className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none resize-none mb-4"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", lineHeight: 1.6 }}
              />

              {parsedUrls.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {parsedUrls.length} URL{parsedUrls.length !== 1 ? "s" : ""} detectada{parsedUrls.length !== 1 ? "es" : ""}
                    {parsedUrls.length > 100 && <span style={{ color: "#f59e0b" }}> (màx. 100, s&apos;ignoraran les restants)</span>}
                  </span>
                </div>
              )}

              {urlError && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs mb-4"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
                  <span className="flex-1">{urlError}</span>
                  <button onClick={() => setUrlError(null)} className="hover:opacity-70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              <button
                onClick={handleUrlImport}
                disabled={parsedUrls.length === 0 || urlImporting}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: parsedUrls.length > 0 ? "var(--selected-bg)" : "var(--bg-input)", color: parsedUrls.length > 0 ? "var(--selected-text)" : "var(--text-muted)" }}
              >
                {urlImporting
                  ? "Important…"
                  : parsedUrls.length > 0
                    ? `Importar ${Math.min(parsedUrls.length, 100)} URL${Math.min(parsedUrls.length, 100) !== 1 ? "s" : ""}`
                    : "Enganxa URLs per importar"}
              </button>
            </div>

            {urlResult && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Resultat</h3>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Creats", value: urlResult.created, color: "#22c55e" },
                    { label: "Duplicats", value: urlResult.duplicate, color: "var(--text-secondary)" },
                    { label: "Ignorats", value: urlResult.ignored, color: "#f59e0b" },
                    { label: "Errors", value: urlResult.failed, color: "#ef4444" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-input)" }}>
                      <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {urlResult.errors.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
                    <div className="px-4 py-2 text-xs font-bold" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
                      {urlResult.errors.length} error{urlResult.errors.length !== 1 ? "s" : ""}
                    </div>
                    <div className="divide-y" style={{ borderColor: "rgba(239,68,68,0.15)" }}>
                      {urlResult.errors.map((e, i) => (
                        <div key={i} className="px-4 py-2">
                          <p className="text-xs font-mono truncate" style={{ color: "var(--text-secondary)" }}>{e.url}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>{e.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming features */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Perfils i canals", desc: "Afegeix un compte de xarxa social per monitoritzar automàticament" },
                { label: "Fonts recurrents", desc: "Programa scrapeig periòdic de comptes o cerques" },
                { label: "Progrés en temps real", desc: "Segueix l'estat de cada scrapeig i reintenta errors" },
              ].map((f) => (
                <div key={f.label} className="rounded-2xl p-4 opacity-50" style={{ background: "var(--bg-card)", border: "1px dashed var(--border-color)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{f.label}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>Aviat</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";

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
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [showNewImport, setShowNewImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [deleting, setDeleting] = useState<string | null>(null);
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
    } catch (e) { setError((e as Error).message); setStep("preview"); }
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
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toISOString().replace("T", " ").slice(0, 19);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Import
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Import history
            </p>
          </div>
          <button
            onClick={() => setShowNewImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: "#c89028", color: "#000" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            New Import
          </button>
        </div>

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

        {/* New Import modal */}
        {showNewImport && (
          <>
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
                      {Object.entries(preview.taxonomy).map(([key, values]) =>
                        values.length > 0 ? (
                          <div key={key}>
                            <span className="text-xs font-medium capitalize" style={{ color: "var(--text-muted)" }}>{key}:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {values.slice(0, 10).map((v: string) => (
                                <span key={v} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                                  {v}
                                </span>
                              ))}
                              {values.length > 10 && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>+{values.length - 10} more</span>
                              )}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--accent-green)", color: "#fff" }}
                  >
                    Import {preview.validRows.toLocaleString()} valid rows
                  </button>
                </div>
              )}

              {step === "importing" && (
                <div className="py-8">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Importing...
                      </span>
                      <span className="text-sm font-bold" style={{ color: "var(--accent-blue)" }}>
                        {progress ? `${progress.percent}%` : "0%"}
                      </span>
                    </div>
                    <div
                      className="w-full h-3 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-input)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progress?.percent || 0}%`,
                          background: "linear-gradient(90deg, var(--accent-blue), var(--accent-green))",
                        }}
                      />
                    </div>
                  </div>
                  {progress && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--accent-green)" }}>
                          {progress.imported.toLocaleString()}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Created</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                          {progress.processed.toLocaleString()} / {progress.totalRows.toLocaleString()}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Processed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: "var(--text-secondary)" }}>
                          {progress.etaMs > 60000
                            ? `${Math.ceil(progress.etaMs / 60000)} min`
                            : `${Math.ceil(progress.etaMs / 1000)}s`}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Remaining</div>
                      </div>
                    </div>
                  )}
                  {!progress && (
                    <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                      Starting...
                    </p>
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
                    <button
                      onClick={closeNewImport}
                      className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                      style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                    >
                      Close
                    </button>
                    <a
                      href="/feed"
                      className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center"
                      style={{ background: "var(--accent-blue)", color: "#fff" }}
                    >
                      View Feed
                    </a>
                  </div>
                </div>
              )}
            </div>
          </>
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

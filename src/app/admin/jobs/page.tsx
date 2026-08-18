"use client";

import { useState, useEffect, useCallback } from "react";

interface JobPosting {
  id: string;
  title: string;
  company: string;
  companyHandle: string | null;
  companyLogo: string | null;
  description: string;
  jobType: string;
  workMode: string | null;
  location: string | null;
  salary: string | null;
  sourceUrl: string;
  applyUrl: string | null;
  featured: boolean;
  active: boolean;
  postedAt: string;
  createdAt: string;
}

const JOB_TYPES = ["FULL-TIME", "PART-TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

const JOB_TYPE_COLORS: Record<string, string> = {
  "FULL-TIME":   "#0d9488",
  "PART-TIME":   "#7c3aed",
  "CONTRACT":    "#d97706",
  "INTERNSHIP":  "#2563eb",
  "FREELANCE":   "#db2777",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ca-CA", { day: "numeric", month: "short", year: "numeric" });
}

function toInputDate(d: string) {
  return new Date(d).toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  title: "",
  company: "",
  companyHandle: "",
  companyLogo: "",
  description: "",
  jobType: "FULL-TIME",
  workMode: "",
  location: "",
  salary: "",
  sourceUrl: "",
  applyUrl: "",
  featured: false,
  active: true,
  postedAt: new Date().toISOString().slice(0, 10),
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    const r = await fetch("/api/admin/jobs");
    const d = await r.json();
    setJobs(d.jobs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowForm(true);
  }

  function openEdit(job: JobPosting) {
    setEditingId(job.id);
    setForm({
      title: job.title,
      company: job.company,
      companyHandle: job.companyHandle ?? "",
      companyLogo: job.companyLogo ?? "",
      description: job.description,
      jobType: job.jobType,
      workMode: job.workMode ?? "",
      location: job.location ?? "",
      salary: job.salary ?? "",
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl ?? "",
      featured: job.featured,
      active: job.active,
      postedAt: toInputDate(job.postedAt),
    });
    setError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = {
      ...form,
      id: editingId ?? undefined,
      companyHandle: form.companyHandle || null,
      companyLogo: form.companyLogo || null,
      workMode: form.workMode || null,
      location: form.location || null,
      salary: form.salary || null,
      applyUrl: form.applyUrl || null,
    };
    const res = await fetch("/api/admin/jobs", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setSaving(false); return; }
    setShowForm(false);
    await fetchJobs();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/jobs?id=${id}`, { method: "DELETE" });
    await fetchJobs();
    setDeletingId(null);
  }

  async function toggleActive(job: JobPosting) {
    await fetch("/api/admin/jobs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, active: !job.active }),
    });
    await fetchJobs();
  }

  const f = (field: keyof typeof form, val: unknown) => setForm((prev) => ({ ...prev, [field]: val }));

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div className="p-6 min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Oportunitats Laborals</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Gestiona les ofertes de feina visibles als usuaris Basic i Pro</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: "#0d9488" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova oferta
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center py-10 px-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", overflowY: "auto" }}>
          <div
            className="w-full max-w-2xl rounded-2xl p-6 relative"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", marginBottom: 40 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {editingId ? "Editar oferta" : "Nova oferta de feina"}
              </h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:opacity-70 transition-all" style={{ color: "var(--text-muted)", background: "var(--bg-input)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* URL de la oferta */}
              <div>
                <label style={labelStyle}>URL de l&apos;oferta (LinkedIn o altre portal) *</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/jobs/view/..."
                  value={form.sourceUrl}
                  onChange={(e) => f("sourceUrl", e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Title */}
              <div>
                <label style={labelStyle}>Títol del lloc *</label>
                <input
                  type="text"
                  placeholder="Ex: Social Media Manager, NFL"
                  value={form.title}
                  onChange={(e) => f("title", e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Empresa *</label>
                  <input
                    type="text"
                    placeholder="Ex: Chicago Bulls"
                    value={form.company}
                    onChange={(e) => f("company", e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Handle (@usuari)</label>
                  <input
                    type="text"
                    placeholder="chicagobulls"
                    value={form.companyHandle}
                    onChange={(e) => f("companyHandle", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Logo URL */}
              <div>
                <label style={labelStyle}>URL del logo de l&apos;empresa (opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.companyLogo}
                  onChange={(e) => f("companyLogo", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Descripció de l&apos;oferta *</label>
                <textarea
                  placeholder="Copia aquí el text de l'oferta de LinkedIn..."
                  value={form.description}
                  onChange={(e) => f("description", e.target.value)}
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Type + Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Tipus de contracte</label>
                  <select value={form.jobType} onChange={(e) => f("jobType", e.target.value)} style={inputStyle}>
                    {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Modalitat</label>
                  <select value={form.workMode} onChange={(e) => f("workMode", e.target.value)} style={inputStyle}>
                    <option value="">No especificat</option>
                    {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Location + Salary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Ubicació</label>
                  <input
                    type="text"
                    placeholder="Ex: Tampa, Florida"
                    value={form.location}
                    onChange={(e) => f("location", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Salari</label>
                  <input
                    type="text"
                    placeholder="Ex: $50,000/yr o Pay not disclosed"
                    value={form.salary}
                    onChange={(e) => f("salary", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Apply URL */}
              <div>
                <label style={labelStyle}>URL d&apos;aplicació (si és diferent de la URL de l&apos;oferta)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.applyUrl}
                  onChange={(e) => f("applyUrl", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Posted date */}
              <div>
                <label style={labelStyle}>Data de publicació</label>
                <input
                  type="date"
                  value={form.postedAt}
                  onChange={(e) => f("postedAt", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => f("featured", e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#0d9488" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Destacada (Featured)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => f("active", e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#0d9488" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Activa (visible als usuaris)</span>
                </label>
              </div>

              {error && <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
                  style={{ background: "#0d9488" }}
                >
                  {saving ? "Guardant..." : editingId ? "Guardar canvis" : "Crear oferta"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-80 transition-all"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  Cancel·lar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "#0d9488" }} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ border: "2px dashed var(--border-color)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" style={{ color: "var(--text-muted)" }}>
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cap oferta creada. Fes clic a &quot;Nova oferta&quot; per afegir-ne.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl px-5 py-4 flex items-center gap-4"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${job.featured ? "#0d9488" : "var(--border-color)"}`,
                opacity: job.active ? 1 : 0.55,
              }}
            >
              {/* Featured dot */}
              <div className="shrink-0">
                {job.featured ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "#0d9488", color: "#fff" }}>★</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>—</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{job.title}</span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: JOB_TYPE_COLORS[job.jobType] ?? "#6b7280", color: "#fff" }}>
                    {job.jobType}
                  </span>
                  {!job.active && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Inactiva</span>}
                </div>
                <div className="flex items-center gap-3 text-[12px] flex-wrap" style={{ color: "var(--text-muted)" }}>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{job.company}</span>
                  {job.location && <span>· {job.location}</span>}
                  {job.workMode && <span>· {job.workMode}</span>}
                  {job.salary && <span>· {job.salary}</span>}
                  <span>· {formatDate(job.postedAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Veure oferta original"
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
                <button
                  onClick={() => toggleActive(job)}
                  title={job.active ? "Desactivar" : "Activar"}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
                  style={{ background: job.active ? "rgba(13,148,136,0.1)" : "var(--bg-input)", border: `1px solid ${job.active ? "rgba(13,148,136,0.3)" : "var(--border-color)"}`, color: job.active ? "#0d9488" : "var(--text-muted)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {job.active
                      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    }
                  </svg>
                </button>
                <button
                  onClick={() => openEdit(job)}
                  title="Editar"
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deletingId === job.id}
                  title="Eliminar"
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-70 disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

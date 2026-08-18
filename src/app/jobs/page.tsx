"use client";

import { useState, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import { getEffectivePlan } from "@/lib/plan-utils";
import Link from "next/link";

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
  postedAt: string;
}

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

function CompanyAvatar({ company, logo }: { company: string; logo: string | null }) {
  const initials = company.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#d97706", "#059669"];
  const color = colors[company.charCodeAt(0) % colors.length];

  if (logo) {
    return (
      <img
        src={logo}
        alt={company}
        className="rounded-xl object-contain"
        style={{ width: 44, height: 44, border: "1px solid var(--border-color)", background: "var(--bg-primary)", padding: 4 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ width: 44, height: 44, background: color }}
    >
      {initials}
    </div>
  );
}

function JobCard({ job }: { job: JobPosting }) {
  const typeColor = JOB_TYPE_COLORS[job.jobType] ?? "#6b7280";
  return (
    <div
      className="rounded-2xl flex flex-col gap-3 p-5 transition-shadow hover:shadow-md"
      style={{
        background: "var(--bg-card, var(--bg-secondary))",
        border: job.featured ? `2px solid #0d9488` : "1px solid var(--border-color)",
        position: "relative",
      }}
    >
      {job.featured && (
        <span
          className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ background: "#0d9488", color: "#fff" }}
        >
          Featured
        </span>
      )}

      {/* Company header */}
      <div className={`flex items-center gap-3 ${job.featured ? "mt-4" : ""}`}>
        <CompanyAvatar company={job.company} logo={job.companyLogo} />
        <div className="min-w-0">
          {job.companyHandle && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>@{job.companyHandle}</p>
          )}
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.company}</p>
        </div>
      </div>

      {/* Title + type */}
      <div>
        <h3 className="font-bold text-base leading-tight mb-2" style={{ color: "var(--text-primary)" }}>{job.title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: typeColor, color: "#fff" }}
          >
            {job.jobType}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Publicat el {formatDate(job.postedAt)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.description}
      </p>

      {/* Location + salary */}
      {(job.workMode || job.location || job.salary) && (
        <div className="flex items-center justify-between text-[12px] pt-1" style={{ borderTop: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
          <div>
            {job.workMode && <span className="font-medium">{job.workMode}</span>}
            {job.location && <span>{job.workMode ? <br/> : ""}{job.location}</span>}
          </div>
          {job.salary && <span className="font-semibold text-right" style={{ color: "var(--text-secondary)" }}>{job.salary}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-sm font-bold py-2 rounded-xl transition-all hover:opacity-80"
          style={{ border: "2px solid #0d9488", color: "#0d9488", background: "transparent" }}
        >
          VEURE
        </a>
        <a
          href={job.applyUrl || job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-sm font-bold py-2 rounded-xl text-white transition-all hover:opacity-90"
          style={{ background: "#0d9488" }}
        >
          APLICAR
        </a>
      </div>
    </div>
  );
}

function Paywall() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="text-center max-w-sm mx-auto px-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.3)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Oportunitats Laborals</h2>
        <p className="text-sm mb-1 font-medium" style={{ color: "#0d9488" }}>Accés exclusiu Basic i Pro</p>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Descobreix oportunitats de feina al món de la comunicació esportiva. Disponible a partir del pla Basic.
        </p>
        <Link
          href="/pricing"
          className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "#0d9488" }}
        >
          Veure plans
        </Link>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    fetch("/api/user/plan")
      .then((r) => r.json())
      .then((d) => {
        const { plan: p, isSuperAdmin: sa } = getEffectivePlan(d);
        setPlan(p);
        setIsSuperAdmin(sa);
      })
      .catch(() => setPlan("free"));
  }, []);

  const hasAccess = isSuperAdmin || plan === "basic_monthly" || plan === "basic_annual" || plan === "pro_monthly" || plan === "pro_annual" || plan === "basic" || plan === "pro";

  useEffect(() => {
    if (!hasAccess && plan !== null) { setLoading(false); return; }
    if (plan === null) return;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, [hasAccess, plan]);

  const jobTypes = Array.from(new Set(jobs.map((j) => j.jobType)));
  const workModes = Array.from(new Set(jobs.map((j) => j.workMode).filter(Boolean))) as string[];

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location?.toLowerCase().includes(q) || false;
    const matchType = typeFilter === "all" || j.jobType === typeFilter;
    const matchMode = modeFilter === "all" || j.workMode === modeFilter;
    return matchSearch && matchType && matchMode;
  });

  const featured = filtered.filter((j) => j.featured);
  const regular = filtered.filter((j) => !j.featured);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-8 pb-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,148,136,0.12)", border: "1px solid rgba(13,148,136,0.25)" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/>
                  <line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Oportunitats Laborals</h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ofertes de feina al món de la comunicació esportiva</p>
              </div>
            </div>
          </div>
        </div>

        {plan === null || loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "#0d9488" }} />
          </div>
        ) : !hasAccess ? (
          <Paywall />
        ) : (
          <div className="flex-1 px-6 py-6">
            <div className="max-w-5xl mx-auto">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex-1 min-w-[200px] relative">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Cerca per títol, empresa o ubicació..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", outline: "none" }}
                  />
                </div>

                {jobTypes.length > 1 && (
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <option value="all">Tots els tipus</option>
                    {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}

                {workModes.length > 1 && (
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <option value="all">Totes les modalitats</option>
                    {workModes.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}

                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {filtered.length} {filtered.length === 1 ? "oferta" : "ofertes"}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hi ha ofertes que coincideixin amb la cerca.</p>
                </div>
              ) : (
                <>
                  {featured.length > 0 && (
                    <div className="mb-8">
                      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Destacades</p>
                      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                        {featured.map((j) => <JobCard key={j.id} job={j} />)}
                      </div>
                    </div>
                  )}

                  {regular.length > 0 && (
                    <div>
                      {featured.length > 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Totes les ofertes</p>
                      )}
                      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                        {regular.map((j) => <JobCard key={j.id} job={j} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

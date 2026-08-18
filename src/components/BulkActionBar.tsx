"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ── */
export interface TaxOption { id: string; name: string; slug: string; }

export interface BulkResult {
  ok: boolean;
  done: number;
  total: number;
  errors: { id: string; error: string }[];
}

interface BulkActionBarProps {
  selected: Set<string>;
  onClear: () => void;
  onDone: (result: BulkResult) => void;
  taxOptions?: {
    sports: TaxOption[];
    entities: TaxOption[];
    formats: TaxOption[];
    competitions: TaxOption[];
    classifications: TaxOption[];
    contentCategories?: TaxOption[];
  };
}

/* ── Small helpers ── */
function Btn({ children, onClick, color = "default", disabled = false, title }: {
  children: React.ReactNode;
  onClick: () => void;
  color?: "default" | "green" | "red" | "amber" | "blue";
  disabled?: boolean;
  title?: string;
}) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    default: { bg: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" },
    green:   { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" },
    red:     { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
    amber:   { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" },
    blue:    { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" },
  };
  const s = styles[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all hover:opacity-80 disabled:opacity-40"
      style={{ background: s.bg, color: s.color, border: s.border }}
    >
      {children}
    </button>
  );
}

/* ── Confirm modal ── */
function ConfirmModal({
  title, message, count, onConfirm, onCancel, danger = false,
}: {
  title: string; message: string; count: number; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {message} <strong style={{ color: "var(--text-primary)" }}>{count.toLocaleString()} publicació{count !== 1 ? "ns" : ""}</strong>.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              Cancel·lar
            </button>
            <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold hover:opacity-80" style={{ background: danger ? "#ef4444" : "var(--color-charcoal,#D4A420)", color: "#fff" }}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Result toast ── */
function ResultToast({ result, onClose }: { result: BulkResult; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, result.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [result, onClose]);

  return (
    <div className="fixed bottom-20 right-6 z-50 rounded-2xl px-5 py-4 shadow-2xl max-w-sm" style={{
      background: result.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
      border: `1px solid ${result.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
      color: result.ok ? "#22c55e" : "#ef4444",
    }}>
      <div className="flex items-center gap-2 font-semibold text-sm mb-1">
        {result.ok
          ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg> Completat</>
          : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Parcialment completat</>
        }
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {result.done} de {result.total} processats correctament.
        {result.errors.length > 0 && ` ${result.errors.length} errors.`}
      </p>
      <button onClick={onClose} className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100" style={{ color: "currentColor" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

/* ── Metadata modal ── */
/* ── Multi-select chip toggler ── */
function ChipMultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: TaxOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!options.length) return null;
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
              style={{
                background: active ? "var(--color-charcoal,#D4A420)" : "var(--bg-input)",
                border: `1px solid ${active ? "var(--color-charcoal,#D4A420)" : "var(--border-color)"}`,
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              {o.name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[10px] mt-1 hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Netejar selecció
        </button>
      )}
    </div>
  );
}

function MetadataModal({
  count, taxOptions, onApply, onClose,
}: {
  count: number;
  taxOptions: BulkActionBarProps["taxOptions"];
  onApply: (fields: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [sportId, setSportId] = useState("");
  const [entityTypeId, setEntityTypeId] = useState("");
  const [contentFormatId, setContentFormatId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [competitionIds, setCompetitionIds] = useState<string[]>([]);
  const [contentCategoryIds, setContentCategoryIds] = useState<string[]>([]);

  const hasChanges = sportId || entityTypeId || contentFormatId || entityName || competitionIds.length > 0 || contentCategoryIds.length > 0;

  function apply() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {};
    if (sportId) fields.sportIds = [sportId];
    if (entityTypeId) fields.entityTypeIds = [entityTypeId];
    if (contentFormatId) fields.contentFormatId = contentFormatId;
    if (entityName.trim()) fields.entityName = entityName.trim();
    if (competitionIds.length > 0) fields.competitionIds = competitionIds;
    if (contentCategoryIds.length > 0) fields.contentCategoryIds = contentCategoryIds;
    onApply(fields);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl my-auto" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Editar metadades</h3>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Només s'actualitzaran els camps que seleccionis. {count.toLocaleString()} publicació{count !== 1 ? "ns" : ""} afectada{count !== 1 ? "es" : ""}.
          </p>

          <div className="space-y-4">
            {/* Sport */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Esport</label>
              <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <option value="">— No modificar —</option>
                {(taxOptions?.sports ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Entity type */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Tipus d'entitat</label>
              <select value={entityTypeId} onChange={(e) => setEntityTypeId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <option value="">— No modificar —</option>
                {(taxOptions?.entities ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Format</label>
              <select value={contentFormatId} onChange={(e) => setContentFormatId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <option value="">— No modificar —</option>
                {(taxOptions?.formats ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Club / Entity name */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>Club / Entitat (text)</label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="— No modificar —"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Competitions */}
            <ChipMultiSelect
              label="Competicions (afegir/reemplaçar)"
              options={taxOptions?.competitions ?? []}
              selected={competitionIds}
              onChange={setCompetitionIds}
            />

            {/* Content categories */}
            <ChipMultiSelect
              label="Categories de contingut (afegir/reemplaçar)"
              options={taxOptions?.contentCategories ?? []}
              selected={contentCategoryIds}
              onChange={setContentCategoryIds}
            />
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              Cancel·lar
            </button>
            <button onClick={apply} disabled={!hasChanges} className="px-4 py-2 rounded-xl text-sm font-bold hover:opacity-80 disabled:opacity-40" style={{ background: "var(--color-charcoal,#D4A420)", color: "#fff" }}>
              Aplicar als {count.toLocaleString()} continguts
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Classification modal ── */
function ClassificationModal({
  count, taxOptions, action, onApply, onClose,
}: {
  count: number;
  taxOptions: BulkActionBarProps["taxOptions"];
  action: "add" | "remove";
  onApply: (classificationIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const QUICK = ["top-picks", "replicable-ideas", "overperforming"];
  const classifications = (taxOptions?.classifications ?? []).filter((c) => QUICK.includes(c.slug));

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {action === "add" ? "Afegir" : "Eliminar"} classificació
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            {count.toLocaleString()} publicació{count !== 1 ? "ns" : ""} afectada{count !== 1 ? "es" : ""}.
          </p>
          <div className="space-y-2 mb-5">
            {classifications.map((c) => {
              const COLORS: Record<string, string> = { "top-picks": "#E8567A", "replicable-ideas": "#52D68A", "overperforming": "#3B82F6" };
              const color = COLORS[c.slug] ?? "var(--color-charcoal)";
              const isSelected = selected.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:opacity-80"
                  style={{ background: isSelected ? `${color}18` : "var(--bg-input)", border: `1.5px solid ${isSelected ? color : "var(--border-color)"}`, color: isSelected ? color : "var(--text-secondary)" }}>
                  <span className="text-sm font-semibold">{c.name}</span>
                  {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              Cancel·lar
            </button>
            <button onClick={() => onApply(selected)} disabled={selected.length === 0} className="px-4 py-2 rounded-xl text-sm font-bold hover:opacity-80 disabled:opacity-40"
              style={{ background: action === "remove" ? "#ef4444" : "var(--color-charcoal,#D4A420)", color: "#fff" }}>
              {action === "add" ? "Afegir" : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Review status modal ── */
function ReviewStatusModal({
  count, onApply, onClose,
}: { count: number; onApply: (status: string) => void; onClose: () => void }) {
  const STATUSES = [
    { value: "approved", label: "Approve", color: "#22c55e" },
    { value: "rejected", label: "Reject",  color: "#ef4444", requiresConfirm: true },
    { value: "pending",  label: "Return to pending", color: "#3b82f6" },
  ];
  const [pending, setPending] = useState<string | null>(null);

  if (pending) {
    const s = STATUSES.find((x) => x.value === pending)!;
    return (
      <ConfirmModal
        title={`${s.label} massiu`}
        message={`Aquesta acció canviarà l'estat de revisió a "${s.label}" de`}
        count={count}
        onConfirm={() => onApply(s.value)}
        onCancel={() => setPending(null)}
        danger={s.value === "rejected"}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Canviar estat de revisió</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{count.toLocaleString()} publicació{count !== 1 ? "ns" : ""} afectada{count !== 1 ? "es" : ""}.</p>
          <div className="space-y-2 mb-4">
            {STATUSES.map((s) => (
              <button key={s.value} onClick={() => s.requiresConfirm ? setPending(s.value) : onApply(s.value)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`, color: s.color }}>
                {s.label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-2 rounded-xl text-sm font-medium hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
            Cancel·lar
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Export selected ── */
async function exportSelected(ids: string[]) {
  const res = await fetch("/api/admin/publications/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scp-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function BulkActionBar({ selected, onClear, onDone, taxOptions }: BulkActionBarProps) {
  const count = selected.size;
  const ids = [...selected];

  const [modal, setModal] = useState<"metadata" | "addClass" | "removeClass" | "reviewStatus" | "archive" | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const doneRef = useRef(false);

  if (count === 0) return null;

  async function callBulk(payload: Record<string, unknown>) {
    if (doneRef.current) return;
    doneRef.current = true;
    setLoading(true);
    setModal(null);
    try {
      const res = await fetch("/api/admin/publications?bulk=true", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...payload }),
      });
      const data: BulkResult = await res.json();
      setResult(data);
      onDone(data);
      if (data.ok) onClear();
    } finally {
      setLoading(false);
      doneRef.current = false;
    }
  }

  return (
    <>
      {/* ── Fixed action bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 px-6 py-3 flex-wrap"
        style={{ background: "var(--bg-card)", borderTop: "2px solid var(--color-charcoal,#D4A420)", boxShadow: "0 -4px 32px rgba(0,0,0,0.5)" }}
      >
        {/* Count + clear */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {count.toLocaleString()} sel.
          </span>
          <button
            onClick={onClear}
            className="flex items-center justify-center w-6 h-6 rounded-full hover:opacity-80"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            title="Netejar selecció"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: "var(--border-color)" }} />

        {/* Actions */}
        <Btn onClick={() => setModal("metadata")} disabled={loading} title="Editar metadades">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Metadades
        </Btn>

        <Btn onClick={() => setModal("addClass")} color="blue" disabled={loading} title="Afegir classificació">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          + Classificació
        </Btn>

        <Btn onClick={() => setModal("removeClass")} color="amber" disabled={loading} title="Eliminar classificació">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
          − Classificació
        </Btn>

        <Btn onClick={() => setModal("reviewStatus")} disabled={loading} title="Canviar estat de revisió">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Review status
        </Btn>

        <Btn onClick={() => exportSelected(ids)} disabled={loading} title="Exportar seleccionats a CSV">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar
        </Btn>

        <Btn onClick={() => setModal("archive")} color="red" disabled={loading} title="Arxivar seleccionats">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          Arxivar
        </Btn>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs ml-2" style={{ color: "var(--text-muted)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Processant…
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === "metadata" && (
        <MetadataModal
          count={count}
          taxOptions={taxOptions}
          onApply={(fields) => callBulk(fields)}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === "addClass" || modal === "removeClass") && (
        <ClassificationModal
          count={count}
          taxOptions={taxOptions}
          action={modal === "addClass" ? "add" : "remove"}
          onApply={(cIds) => callBulk({ classificationAction: modal === "addClass" ? "add" : "remove", classificationIds: cIds })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "reviewStatus" && (
        <ReviewStatusModal
          count={count}
          onApply={(status) => callBulk({ reviewStatus: status })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "archive" && (
        <ConfirmModal
          title="Arxivar continguts"
          message="Arxivaràs i deixaran de ser visibles als resultats actius:"
          count={count}
          onConfirm={() => callBulk({ archived: true })}
          onCancel={() => setModal(null)}
          danger
        />
      )}

      {/* ── Result toast ── */}
      {result && <ResultToast result={result} onClose={() => setResult(null)} />}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BULK EDIT PANEL — right-side drawer, all fields inline, no modals
══════════════════════════════════════════════════════════════════════════ */

export interface BulkEditPanelProps {
  selected: Set<string>;
  onClear: () => void;
  onSelectAll?: () => void;
  onDone: () => void;
  taxOptions?: {
    sports: TaxOption[];
    entities: TaxOption[];
    formats: TaxOption[];
    competitions: TaxOption[];
    classifications: TaxOption[];
    contentCategories?: TaxOption[];
  };
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--text-muted)" }}>{title}</div>
      {children}
    </div>
  );
}

function PanelSelect({
  label, value, onChange, options, placeholder = "— No modificar —",
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: TaxOption[]; placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs shrink-0 w-24" style={{ color: "var(--text-muted)" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
        style={{ background: "var(--bg-input)", border: `1px solid ${value ? "var(--color-charcoal,#D4A420)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function SearchableMultiSelect({
  options, selected, onChange, placeholder = "Cercar i afegir…",
}: {
  options: TaxOption[]; selected: string[]; onChange: (ids: string[]) => void; placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedOptions = options.filter((o) => selected.includes(o.id));
  const q = query.toLowerCase().trim();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div>
      {/* Selected tags */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedOptions.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "var(--color-charcoal,#D4A420)", color: "#fff" }}>
              {o.name}
              <button type="button" onClick={() => toggle(o.id)}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/20">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg-input)", border: `1px solid ${open ? "var(--color-charcoal,#D4A420)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
        />
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg overflow-y-auto"
            style={{ maxHeight: 200, background: "var(--bg-secondary,var(--bg-card))", border: "1px solid var(--border-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>Sense resultats</p>
              : filtered.slice(0, 50).map((o) => {
                const isSelected = selected.includes(o.id);
                return (
                  <button key={o.id} type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { toggle(o.id); setQuery(""); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-white/5"
                    style={{ color: isSelected ? "var(--color-charcoal,#D4A420)" : "var(--text-primary)" }}>
                    {o.name}
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                );
              })
            }
          </div>
        )}
      </div>
    </div>
  );
}

export function BulkEditPanel({ selected, onClear, onSelectAll, onDone, taxOptions }: BulkEditPanelProps) {
  const count = selected.size;
  const ids = [...selected];
  const isOpen = count > 0;

  /* ── Form state ── */
  const [sportId, setSportId] = useState("");
  const [entityTypeId, setEntityTypeId] = useState("");
  const [contentFormatId, setContentFormatId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [competitionIds, setCompetitionIds] = useState<string[]>([]);
  const [contentCategoryIds, setContentCategoryIds] = useState<string[]>([]);
  const [classAdd, setClassAdd] = useState<string[]>([]);
  const [classRemove, setClassRemove] = useState<string[]>([]);
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const loadingRef = useRef(false);

  /* reset confirmations when panel closes */
  useEffect(() => {
    if (!isOpen) { setRejectConfirm(false); setArchiveConfirm(false); }
  }, [isOpen]);

  const callBulk = useCallback(async (payload: Record<string, unknown>, thenClear = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/publications?bulk=true", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...payload }),
      });
      const data: BulkResult = await res.json();
      setResult(data);
      onDone();
      if (thenClear) onClear();
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [ids, onDone, onClear]);

  const metaDirty = sportId || entityTypeId || contentFormatId || entityName.trim() || competitionIds.length > 0 || contentCategoryIds.length > 0;

  function applyMeta() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {};
    if (sportId) fields.sportIds = [sportId];
    if (entityTypeId) fields.entityTypeIds = [entityTypeId];
    if (contentFormatId) fields.contentFormatId = contentFormatId;
    if (entityName.trim()) fields.entityName = entityName.trim();
    if (competitionIds.length > 0) fields.competitionIds = competitionIds;
    if (contentCategoryIds.length > 0) fields.contentCategoryIds = contentCategoryIds;
    void callBulk(fields).then(() => {
      setSportId(""); setEntityTypeId(""); setContentFormatId(""); setEntityName("");
      setCompetitionIds([]); setContentCategoryIds([]);
    });
  }

  function applyClassAdd() {
    void callBulk({ classificationAction: "add", classificationIds: classAdd }).then(() => setClassAdd([]));
  }
  function applyClassRemove() {
    void callBulk({ classificationAction: "remove", classificationIds: classRemove }).then(() => setClassRemove([]));
  }
  function applyReview(status: string) {
    void callBulk({ reviewStatus: status });
    setRejectConfirm(false);
  }
  function applyArchive() {
    void callBulk({ archived: true }, true);
  }

  const classifications = taxOptions?.classifications ?? [];
  const CLASS_COLORS: Record<string, string> = { "top-picks": "#E8567A", "replicable-ideas": "#52D68A", "overperforming": "#3B82F6" };

  return (
    <>
      {/* Slide-in panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col"
        style={{
          width: "40%",
          minWidth: 320,
          maxWidth: 560,
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border-color)",
          boxShadow: "-12px 0 48px rgba(0,0,0,0.45)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-sidebar)" }}>
          <span className="flex-1 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {count} seleccionad{count === 1 ? "a" : "es"}
          </span>
          {onSelectAll && (
            <button onClick={onSelectAll} disabled={loading}
              className="text-[11px] px-2 py-1 rounded-lg font-medium hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              Totes
            </button>
          )}
          <button onClick={onClear} disabled={loading}
            className="text-[11px] px-2 py-1 rounded-lg font-medium hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
          >
            Netejar
          </button>
          <button onClick={onClear} disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s" }}>

          {/* METADADES */}
          <PanelSection title="Metadades">
            <div className="space-y-2">
              <PanelSelect label="Esport" value={sportId} onChange={setSportId} options={taxOptions?.sports ?? []} />
              <PanelSelect label="Tipus entitat" value={entityTypeId} onChange={setEntityTypeId} options={taxOptions?.entities ?? []} />
              <PanelSelect label="Format" value={contentFormatId} onChange={setContentFormatId} options={taxOptions?.formats ?? []} />
              <div className="flex items-center gap-2">
                <label className="text-xs shrink-0 w-24" style={{ color: "var(--text-muted)" }}>Club / Entitat</label>
                <input
                  type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)}
                  placeholder="No modificar"
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--bg-input)", border: `1px solid ${entityName ? "var(--color-charcoal,#D4A420)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
                />
              </div>
            </div>
          </PanelSection>

          {/* COMPETICIONS */}
          {(taxOptions?.competitions ?? []).length > 0 && (
            <PanelSection title="Competicions">
              <SearchableMultiSelect
                options={taxOptions!.competitions}
                selected={competitionIds}
                onChange={setCompetitionIds}
                placeholder="Cercar competició…"
              />
              {competitionIds.length > 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Reemplaçarà les competicions actuals dels {count} continguts
                </p>
              )}
            </PanelSection>
          )}

          {/* CATEGORIES */}
          {(taxOptions?.contentCategories ?? []).length > 0 && (
            <PanelSection title="Categories de contingut">
              <SearchableMultiSelect
                options={taxOptions!.contentCategories!}
                selected={contentCategoryIds}
                onChange={setContentCategoryIds}
                placeholder="Cercar categoria…"
              />
              {contentCategoryIds.length > 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Reemplaçarà les categories actuals dels {count} continguts
                </p>
              )}
            </PanelSection>
          )}

          {/* ── Divider ── */}
          <div style={{ height: 1, background: "var(--border-color)" }} />

          {/* CLASSIFICACIÓ */}
          {classifications.length > 0 && (
            <PanelSection title="Classificació">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>+ Afegir als seleccionats</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {classifications.map((c) => {
                      const color = CLASS_COLORS[c.slug] ?? "var(--color-charcoal)";
                      const active = classAdd.includes(c.id);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => setClassAdd((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: active ? `${color}22` : "var(--bg-input)", border: `1.5px solid ${active ? color : "var(--border-color)"}`, color: active ? color : "var(--text-secondary)" }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {classAdd.length > 0 && (
                    <button onClick={applyClassAdd} disabled={loading}
                      className="w-full py-2 rounded-xl text-xs font-bold hover:opacity-80 disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
                    >
                      + Afegir {classAdd.length} classificació{classAdd.length !== 1 ? "ns" : ""} als {count}
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>− Eliminar dels seleccionats</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {classifications.map((c) => {
                      const color = CLASS_COLORS[c.slug] ?? "var(--color-charcoal)";
                      const active = classRemove.includes(c.id);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => setClassRemove((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: active ? "rgba(239,68,68,0.12)" : "var(--bg-input)", border: `1.5px solid ${active ? "#ef4444" : "var(--border-color)"}`, color: active ? "#ef4444" : "var(--text-secondary)" }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {classRemove.length > 0 && (
                    <button onClick={applyClassRemove} disabled={loading}
                      className="w-full py-2 rounded-xl text-xs font-bold hover:opacity-80 disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                    >
                      − Eliminar {classRemove.length} classificació{classRemove.length !== 1 ? "ns" : ""} dels {count}
                    </button>
                  )}
                </div>
              </div>
            </PanelSection>
          )}

          {/* ── Divider ── */}
          <div style={{ height: 1, background: "var(--border-color)" }} />

          {/* ESTAT DE REVISIÓ */}
          <PanelSection title="Estat de revisió">
            {rejectConfirm ? (
              <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#ef4444" }}>
                  Rebutjar {count} publicació{count !== 1 ? "ns" : ""}?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => applyReview("rejected")} disabled={loading}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-40"
                    style={{ background: "#ef4444", color: "#fff" }}>
                    Sí, rebutjar
                  </button>
                  <button onClick={() => setRejectConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                    Cancel·lar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => applyReview("approved")} disabled={loading}
                  className="py-2 rounded-xl text-xs font-semibold hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                  ✓ Aprovar
                </button>
                <button onClick={() => applyReview("pending")} disabled={loading}
                  className="py-2 rounded-xl text-xs font-semibold hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6" }}>
                  Pendent
                </button>
                <button onClick={() => setRejectConfirm(true)} disabled={loading}
                  className="py-2 rounded-xl text-xs font-semibold hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
                  ✗ Rebutjar
                </button>
              </div>
            )}
          </PanelSection>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pt-3 pb-3 shrink-0 space-y-2" style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-sidebar)" }}>
          {/* Aplicar metadades — sempre visible */}
          <button
            onClick={applyMeta} disabled={loading || !metaDirty}
            className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: metaDirty ? "var(--color-charcoal,#D4A420)" : "var(--bg-input)",
              color: metaDirty ? "#fff" : "var(--text-muted)",
              border: metaDirty ? "none" : "1px solid var(--border-color)",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            }
            {metaDirty ? `Aplicar metadades als ${count}` : "Selecciona camps per aplicar"}
          </button>

          <div className="flex gap-2">
          <button
            onClick={() => exportSelected(ids)} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>

          {archiveConfirm ? (
            <div className="flex-1 flex items-center gap-1.5">
              <button onClick={applyArchive} disabled={loading}
                className="flex-1 py-2 rounded-xl text-xs font-bold hover:opacity-80 disabled:opacity-40"
                style={{ background: "#ef4444", color: "#fff" }}>
                Sí, arxivar
              </button>
              <button onClick={() => setArchiveConfirm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium hover:opacity-80"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setArchiveConfirm(true)} disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold hover:opacity-80 disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              Arxivar
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Result toast */}
      {result && <ResultToast result={result} onClose={() => setResult(null)} />}
    </>
  );
}

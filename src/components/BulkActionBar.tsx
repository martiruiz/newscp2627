"use client";

import { useState, useEffect, useRef } from "react";

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

  const hasChanges = sportId || entityTypeId || contentFormatId || entityName;

  function apply() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {};
    if (sportId) fields.sportIds = [sportId];
    if (entityTypeId) fields.entityTypeIds = [entityTypeId];
    if (contentFormatId) fields.contentFormatId = contentFormatId;
    if (entityName.trim()) fields.entityName = entityName.trim();
    onApply(fields);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
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

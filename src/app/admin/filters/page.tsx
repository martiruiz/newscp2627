"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Category { key: string; label: string; count: number }
interface FilterValue { id: string; name: string; slug?: string; count: number }

export default function FiltersPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>("sport");
  const [values, setValues] = useState<FilterValue[]>([]);
  const [filtered, setFiltered] = useState<FilterValue[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [totalIdeas, setTotalIdeas] = useState(0);
  const [loadingValues, setLoadingValues] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/filters")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  const loadValues = useCallback(async (cat: string) => {
    setLoadingValues(true);
    setValues([]);
    setFiltered([]);
    setSearch("");
    const res = await fetch(`/api/admin/filters?category=${cat}`);
    const data = await res.json();
    const vals: FilterValue[] = data.values ?? [];
    setValues(vals);
    setFiltered(vals);
    setTotalIdeas(vals.reduce((sum, v) => sum + (v.count || 0), 0));
    setLoadingValues(false);
  }, []);

  useEffect(() => { loadValues(selected); }, [selected, loadValues]);

  useEffect(() => {
    if (!search) { setFiltered(values); return; }
    setFiltered(values.filter((v) => v.name.toLowerCase().includes(search.toLowerCase())));
  }, [search, values]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    setAddError("");
    const res = await fetch("/api/admin/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: selected, name: newName.trim() }),
    });
    const data = await res.json();
    if (data.error) { setAddError(data.error); setAdding(false); return; }
    setNewName("");
    await loadValues(selected);
    setCategories((cats) => cats.map((c) => c.key === selected ? { ...c, count: c.count + 1 } : c));
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/admin/filters?category=${selected}&id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); setDeletingId(null); return; }
    await loadValues(selected);
    setCategories((cats) => cats.map((c) => c.key === selected ? { ...c, count: c.count - 1 } : c));
    setDeletingId(null);
  }

  function startEdit(val: FilterValue) {
    setEditingId(val.id);
    setEditingName(val.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) return;
    setSavingId(id);
    const res = await fetch("/api/admin/filters", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: selected, id, name: editingName.trim() }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); setSavingId(null); return; }
    setValues((prev) => prev.map((v) => v.id === id ? { ...v, name: data.name, slug: data.slug } : v));
    setFiltered((prev) => prev.map((v) => v.id === id ? { ...v, name: data.name, slug: data.slug } : v));
    setEditingId(null);
    setEditingName("");
    setSavingId(null);
  }

  const selCat = categories.find((c) => c.key === selected);
  const isReadOnly = selected === "club";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Left: categories */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-y-auto"
        style={{ borderRight: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
      >
        <div className="px-5 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Categories
          </p>
        </div>
        <nav className="flex-1 p-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelected(cat.key)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all"
              style={{
                background: selected === cat.key ? "rgba(200,144,40,0.12)" : "transparent",
                color: selected === cat.key ? "#F5C542" : "var(--text-secondary)",
              }}
            >
              {cat.label}
              <span
                className="text-[11px] px-1.5 py-0.5 rounded"
                style={{
                  background: selected === cat.key ? "rgba(200,144,40,0.2)" : "var(--bg-input)",
                  color: selected === cat.key ? "#F5C542" : "var(--text-muted)",
                }}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: values */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Filters
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                Manage catalog values for all filter categories
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Category title row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {selCat?.label}
              </h2>
              {!loadingValues && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {values.length} values · {totalIdeas.toLocaleString()} linked content ideas
                </span>
              )}
            </div>
            {/* Search values */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter values..."
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                width: 220,
                background: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Add new value */}
          {!isReadOnly && (
            <div
              className="flex items-center gap-3 mb-5 p-4 rounded-xl"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder={`Add new ${selCat?.label} value...`}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: `1px solid ${addError ? "#ef4444" : "var(--border-color)"}`,
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: "#F5C542", color: "#000" }}
              >
                {adding ? "Adding..." : "Add"}
              </button>
              {addError && <span className="text-xs" style={{ color: "#ef4444" }}>{addError}</span>}
            </div>
          )}

          {/* Values list */}
          {loadingValues ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border-color)" }}
            >
              {filtered.map((val, i) => (
                <div
                  key={val.id}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/5 group"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border-color)" : "none" }}
                >
                  {editingId === val.id ? (
                    /* Inline edit mode */
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(val.id); if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                        style={{ background: "var(--bg-input)", border: "1px solid #F5C542", color: "var(--text-primary)" }}
                      />
                      <button
                        onClick={() => handleSaveEdit(val.id)}
                        disabled={savingId === val.id || !editingName.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: "#F5C542", color: "#000" }}
                      >
                        {savingId === val.id ? "…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{val.name}</span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs mr-2" style={{ color: "var(--text-muted)" }}>
                      {(val.count || 0).toLocaleString()} ideas
                    </span>
                    {!isReadOnly && editingId !== val.id && (
                      <>
                        <button
                          onClick={() => startEdit(val)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all hover:opacity-70"
                          style={{ color: "var(--text-muted)" }}
                          title="Rename"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(val.id)}
                          disabled={deletingId === val.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all hover:opacity-70 disabled:opacity-30"
                          style={{ color: "#ef4444" }}
                          title="Delete"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {search ? "No values match your search" : "No values yet"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

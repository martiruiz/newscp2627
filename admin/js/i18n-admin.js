// Admin language: English (as written), Spanish or Catalan. Loaded on every admin page right after the dictionary
// (js/i18n-admin-dict.js: window.SCPA_DICT = { "English text": ["Español", "Català"], … }).
// The pages are written in English; in ES / CA this translates text, placeholders, titles, aria-labels and the info "i"
// tips as they're drawn, and a MutationObserver translates whatever the scripts add later (tables, dialogs, toasts).
// Keys may carry {a}, {b}… for the parts that change ("{a} posts"); the values use the same names.
// Choice: saved in this browser (scpa-lang) → browser language. window.SCPA_setLang(lang) switches and reloads.
(() => {
  const LANGS = ["en", "es", "ca"];
  let lang = null;
  try { lang = localStorage.getItem("scpa-lang"); } catch {}
  if (!LANGS.includes(lang)) lang = /^ca\b/i.test(navigator.language || "") ? "ca" : /^es\b/i.test(navigator.language || "") ? "es" : "en";
  window.SCPA_LANG = lang;
  document.documentElement.lang = lang;
  window.SCPA_setLang = (l) => { try { localStorage.setItem("scpa-lang", l); } catch {} location.reload(); };
  if (lang === "en") return;

  const col = lang === "es" ? 0 : 1;
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new Map(), patterns = [];
  for (const [k, v] of Object.entries(window.SCPA_DICT || {})) {
    const key = norm(k), out = v?.[col];
    if (!out) continue;
    if (/\{\w\}/.test(key)) {
      // "Members in segment {a}" also matches a text node that ends before the {a} (an element came there)
      const edge = key.replace(/^\{\w\}\s*|\s*\{\w\}$/g, ""), outEdge = out.replace(/^\{\w\}\s*|\s*\{\w\}$/g, "");
      if (edge && !/\{\w\}/.test(edge) && !exact.has(edge)) exact.set(edge, outEdge);
      const names = [];
      const src = escRe(key).replace(/\\\{(\w)\\\}/g, (_, n) => { names.push(n); return "(.*?)"; });
      patterns.push({ re: new RegExp(`^${src}$`), names, out });
    } else exact.set(key, out);
  }
  // the most specific first: "Delete {a} selected" before "Delete {a}"
  patterns.sort((x, y) => y.re.source.replace(/\(\.\*\?\)/g, "").length - x.re.source.replace(/\(\.\*\?\)/g, "").length);
  const lookup = (text) => {
    const key = norm(text);
    if (!key || key.length > 400 || !/[A-Za-z]/.test(key)) return null;
    if (exact.has(key)) return exact.get(key);
    for (const p of patterns) {
      const m = p.re.exec(key);
      if (m) return p.out.replace(/\{(\w)\}/g, (all, n) => { const i = p.names.indexOf(n); if (i < 0) return all; const v = m[i + 1]; return exact.get(v) ?? v; });
    }
    return null;
  };
  // a phrase from a script (toasts, confirms): SCPA_t("Saved") → the translation, or the text as it is
  window.SCPA_t = (text) => lookup(text) ?? text;

  const SKIP = "script, style, textarea, code, .mono, [data-i18n-skip], [contenteditable]";
  const ATTRS = ["placeholder", "title", "aria-label", "data-tip"];
  const doText = (n) => {
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const v = n.nodeValue, t = lookup(v);
    if (t != null && t !== norm(v)) n.nodeValue = v.replace(/\S[\s\S]*\S|\S/, t);
  };
  const doEl = (el) => {
    if (el.closest?.(SKIP)) return;
    for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v) { const t = lookup(v); if (t != null && t !== v) el.setAttribute(a, t); } }
    if (el.tagName === "INPUT" && /^(button|submit)$/i.test(el.type) && el.value) { const t = lookup(el.value); if (t) el.value = t; }
  };
  const walk = (root) => {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    root.querySelectorAll?.(`[${ATTRS.join("], [")}], input[type=button], input[type=submit]`).forEach(doEl);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) doText(n);
  };
  let busy = false;
  const mo = new MutationObserver((ms) => {
    if (busy) return;
    busy = true;
    for (const m of ms) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doEl(m.target);
      else m.addedNodes.forEach(walk);
    }
    busy = false;
  });
  const start = () => { walk(document.documentElement); mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  // dialogs from the browser (confirm / alert / prompt) get their text translated too
  for (const f of ["alert", "confirm", "prompt"]) { const orig = window[f].bind(window); window[f] = (msg, ...r) => orig(window.SCPA_t(String(msg ?? "")), ...r); }
})();

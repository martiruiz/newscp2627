// Website language: Spanish (default) or English. Loaded in <head> on every page, right after theme.js.
// The pages are written in English; in Spanish this script translates them as they are drawn, from the dictionary in
// js/i18n-es.js (exact phrases, plus patterns with {placeholders} for text built by the scripts). A MutationObserver
// translates whatever the page scripts add later (cards, dialogs, messages), before it is painted.
// Choice order: ?lang=es|en in the URL → saved choice (this browser) → the member's profile → Spanish.
//   window.SCP_LANG  "en" | "es"         window.SCP_LOC  "en-GB" | "es-ES" (dates, numbers, money)
//   window.tx(text, vars)  translate one phrase/template from a script: tx("Pay {amount} and switch", { amount })
//   window.SCP_setLang(lang, { save })   switch language (reloads the page); save: false skips the profile update
(() => {
  const KEY = "scp-lang";
  const LANGS = ["es", "en"];   // Spanish first in the switch
  const root = document.documentElement;
  let lang = null;
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) { lang = q; localStorage.setItem(KEY, q); }
    else lang = localStorage.getItem(KEY);
  } catch {}
  if (!LANGS.includes(lang)) lang = "es";   // Spanish by default; English when chosen (saved in this browser / ?lang=en)
  // Blog / Social News exist in both languages (<html data-page-lang>, /es/… = Spanish, blog-tools/build.mjs): people go to
  // the address of their language; search engines stay on the page they asked for (its other language is in hreflang)
  const pageLang = root.dataset.pageLang;
  const pageIn = (l) => { const m = location.pathname.match(/^(.*?\/)(?:es\/)?((?:blog|news)(?:\.html|\/[^/]+\.html))$/); return m ? `${m[1]}${l === "es" ? "es/" : ""}${m[2]}${location.search}${location.hash}` : null; };
  if (LANGS.includes(pageLang) && pageLang !== lang) {
    if (/bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternalhit|lighthouse|headless/i.test(navigator.userAgent) || !pageIn(lang)) lang = pageLang;
    else { location.replace(pageIn(lang)); lang = pageLang; }
  }
  window.SCP_LANG = lang;
  window.SCP_LOC = lang === "es" ? "es-ES" : "en-GB";
  root.lang = lang;

  // ---- dictionary --------------------------------------------------------------------------------------------
  let exact = new Map();
  let patterns = [];
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let loaded = false;
  function load(dict) {
    if (loaded || !dict) return;
    loaded = true;
    for (const [k, v] of Object.entries(dict)) {
      const key = norm(k);
      if (/\{\w+\}/.test(key)) {
        const names = [];
        const src = escRe(key).replace(/\\\{(\w+)\\\}/g, (_, n) => { names.push(n); return "(.+?)"; });
        patterns.push({ re: new RegExp(`^${src}$`), names, out: v });
      }
      exact.set(key, v);
    }
  }
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? vars[n] : m)) : s);
  function lookup(text) {
    const key = norm(text);
    if (!key) return null;
    if (exact.has(key)) return exact.get(key);
    if (key.length > 300) return null;
    for (const p of patterns) {
      const m = p.re.exec(key);
      if (m) {
        const vars = {};
        p.names.forEach((n, i) => { const v = m[i + 1]; vars[n] = exact.get(v) ?? v; });
        return fill(p.out, vars);
      }
    }
    return null;
  }
  window.tx = (text, vars) => {
    if (lang !== "es") return fill(text, vars);
    load(window.SCP_ES);   // page scripts can run before DOMContentLoaded
    const v = vars && Object.fromEntries(Object.entries(vars).map(([k, x]) => [k, typeof x === "string" ? exact.get(norm(x)) ?? x : x]));
    return fill(exact.get(norm(text)) ?? text, v);
  };

  // ---- translating the page ----------------------------------------------------------------------------------
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "svg", "SVG"]);
  const ATTRS = ["placeholder", "aria-label", "title", "alt", "data-tip"];
  const skipped = (el) => !el || el.closest?.('[translate="no"], [data-i18n-skip], [contenteditable="true"]');
  function text(node) {
    const v = node.nodeValue;
    if (!v || !/[A-Za-z]/.test(v)) return;
    const t = lookup(v);
    if (t != null && t !== norm(v)) {
      const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
      node.nodeValue = lead + t + tail;
    }
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const t = lookup(v); if (t != null && t !== v) el.setAttribute(a, t); }
    }
    if (el.tagName === "INPUT" && /^(submit|button)$/i.test(el.type) && el.value) { const t = lookup(el.value); if (t != null) el.value = t; }
  }
  function walk(node) {
    if (node.nodeType === 3) { if (!skipped(node.parentElement) && !SKIP.has(node.parentElement?.tagName)) text(node); return; }
    if (node.nodeType === 1 && node.tagName === "TEXTAREA" && !skipped(node)) { attrs(node); return; }
    if (node.nodeType !== 1 || SKIP.has(node.tagName) || skipped(node)) return;
    attrs(node);
    const it = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
        if (n.tagName === "TEXTAREA") { attrs(n); return NodeFilter.FILTER_REJECT; }   // its placeholder, not what the member typed
        return SKIP.has(n.tagName) || n.getAttribute("translate") === "no" || n.hasAttribute("data-i18n-skip") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let n = it.nextNode();
    while (n) { if (n.nodeType === 3) text(n); else attrs(n); n = it.nextNode(); }
  }
  // Blocks written in both languages (legal pages): <div data-lang-block="en">…</div><div data-lang-block="es" hidden>…</div>
  function blocks(scope) {
    scope.querySelectorAll?.("[data-lang-block]").forEach((b) => { b.hidden = b.getAttribute("data-lang-block") !== lang; });
    // links like terms.html#company land on the Spanish section (id="es-company") in Spanish
    if (scope === document && lang === "es" && location.hash.length > 1) {
      const t = document.getElementById(`es-${decodeURIComponent(location.hash.slice(1))}`);
      if (t) setTimeout(() => t.scrollIntoView(), 0);
    }
  }

  function head() {
    const t = lookup(document.title); if (t) document.title = t;
    document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]').forEach((m) => {
      const v = lookup(m.content || ""); if (v) m.content = v;
    });
  }

  if (lang === "es") {
    // keep the English text from flashing before it is translated
    root.classList.add("i18n-pending");
    const st = document.createElement("style");
    st.textContent = "html.i18n-pending body{visibility:hidden}";
    document.head.appendChild(st);
    setTimeout(() => root.classList.remove("i18n-pending"), 2500);   // never leave the page hidden
    const base = (document.currentScript?.src || "").replace(/i18n\.js(\?.*)?$/, "");
    const v = (document.currentScript?.src.match(/\?v=[^&]*/) || [""])[0];
    document.write(`<script src="${base}i18n-es.js${v}"><\/script>`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    blocks(document);
    if (lang === "es" && window.SCP_ES) {
      load(window.SCP_ES);
      head();
      walk(document.body);
      new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "characterData") { if (!skipped(m.target.parentElement)) text(m.target); }
          else if (m.type === "attributes") { if (!skipped(m.target)) attrs(m.target); }
          else m.addedNodes.forEach((n) => { walk(n); if (n.nodeType === 1) blocks(n); });
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      const tObs = document.querySelector("title");
      if (tObs) new MutationObserver(head).observe(tObs, { childList: true, characterData: true, subtree: true });
    }
    root.classList.remove("i18n-pending");
    mountSwitchers();
  });

  // ---- switching -----------------------------------------------------------------------------------------------
  window.SCP_setLang = async (next, opts = {}) => {
    if (!LANGS.includes(next)) return;
    try { localStorage.setItem(KEY, next); } catch {}
    if (next === lang) return;
    const wait = (p) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);   // never stuck on the network
    await wait(window.SCP_beforeLangSwitch?.());   // e.g. the profile saves its pending changes first
    if (opts.save !== false) await wait(window.SCP_saveLang?.(next));
    if (pageLang && pageIn(next)) { const t = new URL(pageIn(next), location.href); t.searchParams.delete("lang"); location.assign(t.toString()); return; }
    const u = new URL(location.href);
    if (u.searchParams.has("lang")) { u.searchParams.set("lang", next); location.replace(u.toString()); }
    else location.reload();   // a link with #anchor would only scroll with location.replace: reload the page
  };
  // the member's saved choice (profile) wins over the browser language, once per browser
  window.SCP_applyProfileLang = (saved) => {
    let local = null;
    try { local = localStorage.getItem(KEY); } catch {}
    if (LANGS.includes(saved) && !local && saved !== lang) window.SCP_setLang(saved, { save: false });
  };

  const NAMES = { en: "English", es: "Español" };
  const SWITCH = (full) => `<div class="lang-switch" role="group" aria-label="${lang === "es" ? "Idioma" : "Language"}" data-i18n-skip>
    ${LANGS.map((l) => `<button type="button" data-set-lang="${l}" aria-pressed="${l === lang}" title="${NAMES[l]}" lang="${l}">${full ? NAMES[l] : l.toUpperCase()}</button>`).join("")}
  </div>`;
  function mountSwitchers() {
    const spot = document.querySelector(".nav-actions");
    if (spot && !spot.querySelector(".lang-switch")) spot.insertAdjacentHTML("afterbegin", SWITCH());
    // pages without the main nav (log in, sign up): a small switch in the corner
    if (!spot && document.querySelector(".auth, .auth-page, [data-lang-float]") && !document.querySelector(".lang-switch, [data-lang-slot]")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="lang-float">${SWITCH()}</div>`);
    }
    document.querySelectorAll("[data-lang-slot]").forEach((s) => { if (!s.querySelector(".lang-switch")) s.innerHTML = SWITCH(s.getAttribute("data-lang-slot") === "full"); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-set-lang]");
      if (b) { e.preventDefault(); window.SCP_setLang(b.getAttribute("data-set-lang")); }
    });
  }
})();

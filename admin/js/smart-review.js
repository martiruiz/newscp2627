// SCP Admin — Smart filters → Review: check the AI's labels post by post (the "gold set").
// Each post shows the AI's proposal already selected; correct what's wrong and press Save & next (Enter).
// The accuracy table compares the AI with the reviewed labels: precision (of what the AI marked, how much is right),
// recall (of what's right, how much the AI found) — per filter, live.
// Data: smart_review (supabase/smart-review.sql), taxonomy: js/smart-taxonomy.js (generated from pipeline/library/taxonomy.mjs).
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num } = A;
  try { await A.boot("smart"); } catch { return; }
  const main = $("[data-main]");
  const T = window.SCP_SMART;
  const CATS = T.categories.filter((c) => !c.meta); // aspect ratio & duration come from Instagram, not the AI

  let items = [], all = [], batches = [], batch = null, posts = new Map(), idx = 0, view = "review";
  const setOf = (v) => new Set([].concat(v || []).map((x) => String(x).trim()).filter(Boolean));

  async function load() {
    const { data, error } = await A.db.from("smart_review").select("*").order("created_at").order("post_id");
    if (error) {
      main.innerHTML = `<div class="page-head"><div><h1>Smart filters</h1></div></div><p class="error-text">${/does not exist|schema cache/i.test(error.message) ? "Run supabase/smart-review.sql in Supabase first." : esc(A.errMsg(error))}</p>`;
      return false;
    }
    all = data || [];
    // Review sets ("batches"): the latest one by default
    batches = [...new Set(all.map((r) => r.batch || "—"))].sort((a, b) => {
      const at = (x) => Math.max(...all.filter((r) => (r.batch || "—") === x).map((r) => Date.parse(r.created_at)));
      return at(b) - at(a);
    });
    try { batch = localStorage.getItem("scp-smart-batch"); } catch {}
    if (!batches.includes(batch)) batch = batches[0];
    items = all.filter((r) => (r.batch || "—") === batch);
    const ids = all.map((r) => r.post_id);
    for (const part of A.chunk(ids, 100)) {
      const { data: ps } = await A.db.from("content_ideas").select("id,url,title,published_at,embed,cover_url,content_idea_tags(idea_catalog(category,name))").in("id", part);
      for (const p of ps || []) {
        const tags = {};
        for (const { idea_catalog: v } of p.content_idea_tags || []) if (v) (tags[v.category] ||= []).push(v.name);
        posts.set(p.id, { ...p, tags });
      }
    }
    const first = items.findIndex((r) => r.status === "todo");
    idx = first >= 0 ? first : 0;
    return true;
  }

  // ---------- Accuracy (AI vs reviewed) ----------
  function accuracy() {
    const done = items.filter((r) => r.status === "done" && r.gold);
    return CATS.map((c) => {
      let tp = 0, fp = 0, fn = 0, exact = 0;
      for (const r of done) {
        const a = setOf(r.ai[c.key]), g = setOf(r.gold[c.key]);
        const norm = (s) => new Set([...s].map((x) => x.toLowerCase()));
        const an = norm(a), gn = norm(g);
        for (const x of an) gn.has(x) ? tp++ : fp++;
        for (const x of gn) if (!an.has(x)) fn++;
        if (an.size === gn.size && [...an].every((x) => gn.has(x))) exact++;
      }
      return { ...c, tp, fp, fn, exact, n: done.length,
        precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
    });
  }
  const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const tone = (v) => (v == null ? "" : v >= 0.85 ? "good" : v >= 0.65 ? "mid" : "bad");

  // ---------- Layout ----------
  const guideOpen = () => { try { return localStorage.getItem("scp-smart-guide") !== "0"; } catch { return true; } };
  function render() {
    const done = items.filter((r) => r.status === "done").length;
    const skipped = items.filter((r) => r.status === "skipped").length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Smart filters · Review</h1><p>Check the AI's labels. What you confirm becomes the reference to measure and improve each filter. <button class="link" type="button" data-guide-open>How it works</button></p></div>
        <div class="head-actions">
          ${batches.length > 1 ? `<select class="select" data-batch aria-label="Review set">${batches.map((b) => `<option${b === batch ? " selected" : ""}>${esc(b)}</option>`).join("")}</select>` : ""}
          <div class="sr-progress"><span><b>${done}</b> / ${items.length} reviewed${skipped ? ` · ${skipped} skipped` : ""} ${A.info("Posts of this review set you've saved (Reviewed) or skipped. The set is a sample of posts the AI labelled; when every post is done, Accuracy shows how good the AI is per filter.")}</span><i><span style="width:${items.length ? (done / items.length) * 100 : 0}%"></span></i></div>
          <div class="seg"><button type="button" class="${view === "review" ? "on" : ""}" data-view="review">Review</button><button type="button" class="${view === "accuracy" ? "on" : ""}" data-view="accuracy">Accuracy</button>${items.some((r) => r.ai_b) ? `<button type="button" class="${view === "compare" ? "on" : ""}" data-view="compare">Compare</button>` : ""}</div>
        </div>
      </div>
      ${guideOpen() ? `<section class="panel sr-guide" data-guide>
        <header class="aud-h"><h2>How it works</h2><span class="aud-n">3 steps per post</span><button class="icon-btn" type="button" data-guide-close aria-label="Hide the guide" title="Hide the guide">×</button></header>
        <ol class="sr-steps">
          <li><b>1</b><span><strong>Look at the post</strong> on the left: the image or video, and its caption.</span></li>
          <li><b>2</b><span><strong>Check the labels</strong> on the right. The dashed ones are the AI's guess: click once if it's right (✓), twice if it's wrong (✗). Click any other value to add one the AI missed.</span></li>
          <li><b>3</b><span><strong>Save &amp; next</strong> (Enter or →). Not sure? Skip it (S). ← goes back.</span></li>
        </ol>
        <p class="sr-legend"><span class="sr-chip ai pend">AI guess</span><span class="sr-chip on">✓ Right</span><span class="sr-chip rej">✗ Wrong</span><span class="sr-chip">Not chosen</span></p>
      </section>` : ""}
      <div data-body></div>`;
    $("[data-guide-close]")?.addEventListener("click", () => { try { localStorage.setItem("scp-smart-guide", "0"); } catch {} render(); });
    $("[data-guide-open]")?.addEventListener("click", () => { try { localStorage.removeItem("scp-smart-guide"); } catch {} render(); });
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
    $("[data-batch]")?.addEventListener("change", (e) => {
      batch = e.target.value;
      try { localStorage.setItem("scp-smart-batch", batch); } catch {}
      items = all.filter((r) => (r.batch || "—") === batch);
      const first = items.findIndex((r) => r.status === "todo");
      idx = first >= 0 ? first : 0; view = "review"; render();
    });
    if (!items.length) { $("[data-body]").innerHTML = `<div class="panel panel-pad"><p>No posts to review yet. Run <span class="mono">node library/smart-review-seed.mjs --size 100</span> in the pipeline folder.</p></div>`; return; }
    view === "accuracy" ? renderAccuracy() : view === "compare" ? renderCompare() : renderReview();
  }

  // ---------- Compare: blind A/B between the stored labels (old) and version B (new), only where they differ ----------
  const normV = (x) => String(x).normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
  const same = (a, b) => { const A = [...setOf(a)].map(normV).sort(), B = [...setOf(b)].map(normV).sort(); return A.join("|") === B.join("|"); };
  const diffsOf = (r) => (r.ai_b ? CATS.filter((c) => c.key !== "city" && !same(r.ai?.[c.key], r.ai_b?.[c.key])) : []);
  // A or B is random per post and filter, but stable (so reopening shows the same order)
  const flip = (id, key) => { let h = 0; for (const ch of `${id}:${key}`) h = (h * 31 + ch.charCodeAt(0)) | 0; return h & 1; };
  let cmpIdx = 0;
  function cmpQueue() { return items.filter((r) => diffsOf(r).length); }
  function renderCompare() {
    const queue = cmpQueue();
    const pending = queue.filter((r) => diffsOf(r).some((c) => !r.verdicts?.[c.key]));
    const total = queue.reduce((n, r) => n + diffsOf(r).length, 0);
    const decided = queue.reduce((n, r) => n + diffsOf(r).filter((c) => r.verdicts?.[c.key]).length, 0);
    if (!pending.length) return renderCompareResults(queue);
    const r = pending[Math.min(cmpIdx, pending.length - 1)];
    const p = posts.get(r.post_id) || { tags: {} };
    const chip = (vals) => [...setOf(vals)].map((v) => `<span class="sr-chip on">${esc(v)}</span>`).join("") || `<span class="muted">— nothing —</span>`;
    $("[data-body]").innerHTML = `
      <p class="hint" style="margin:0 0 12px">${A.info("Two versions of the AI labelled the same posts. A and B are shuffled so you don't know which is which: pick the better one per filter (1 = A, 2 = B, 3 = both right, 4 = both wrong).")} <b>${decided}</b> of ${total} decisions · ${pending.length} posts left. For each filter, pick the better option. A and B are shuffled: you don't know which version is which.</p>
      <div class="sr-grid">
        <section class="panel sr-post">
          <div class="sr-meta"><b>${esc(String(p.published_at || "").slice(0, 10))}</b>${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">Open original ↗</a>` : ""}</div>
          <div class="sr-tags">${["platform", "format", "sport", "competition", "club"].flatMap((k) => (p.tags[k] || []).map((v) => `<span class="tag">${esc(v)}</span>`)).join("")}</div>
          <div class="sr-media">${preview(p)}</div>
          <details class="sr-caption" open><summary>Caption</summary><p>${esc(p.title || "(no caption)")}</p></details>
        </section>
        <section class="panel sr-form">
          ${diffsOf(r).map((c) => {
            const f = flip(r.post_id, c.key);
            const A = f ? r.ai_b?.[c.key] : r.ai?.[c.key], B = f ? r.ai?.[c.key] : r.ai_b?.[c.key];
            const v = r.verdicts?.[c.key]?.pick;
            const isOn = (side) => v && ((side === "a" && v === (f ? "new" : "old")) || (side === "b" && v === (f ? "old" : "new")));
            return `<div class="cmp-row" data-cmp="${c.key}" data-flip="${f}">
              <div class="sr-cat-h">${esc(c.label)}</div>
              <div class="cmp-opts">
                <button type="button" class="cmp-opt${isOn("a") ? " on" : ""}" data-pick="a"><span class="cmp-l">A</span>${chip(A)}</button>
                <button type="button" class="cmp-opt${isOn("b") ? " on" : ""}" data-pick="b"><span class="cmp-l">B</span>${chip(B)}</button>
                <button type="button" class="cmp-mini${v === "both" ? " on" : ""}" data-pick="both" title="Both are right">Both OK</button>
                <button type="button" class="cmp-mini${v === "none" ? " on" : ""}" data-pick="none" title="Both are wrong">Neither</button>
              </div></div>`;
          }).join("")}
        </section>
      </div>
      <div class="sr-bar">
        <span class="muted">1 = A · 2 = B · 3 = both · 4 = neither (first open filter)</span>
        <button class="btn btn-primary" type="button" data-cmp-next>${icon("check")}Next post</button>
      </div>`;
    const pick = async (row, side) => {
      const f = Number(row.dataset.flip);
      const choice = side === "a" ? (f ? "new" : "old") : side === "b" ? (f ? "old" : "new") : side;
      r.verdicts = { ...(r.verdicts || {}), [row.dataset.cmp]: { pick: choice } };
      $$("[data-pick]", row).forEach((b) => b.classList.toggle("on", b.dataset.pick === side));
      const { error } = await A.db.from("smart_review").update({ verdicts: r.verdicts }).eq("post_id", r.post_id);
      if (error) A.toast(A.errMsg(error), "err");
    };
    $$(".cmp-row").forEach((row) => row.addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) pick(row, b.dataset.pick); }));
    $("[data-cmp-next]").addEventListener("click", () => {
      if (diffsOf(r).some((c) => !r.verdicts?.[c.key])) return A.toast("Pick an option for every filter of this post first.", "err");
      cmpIdx = 0; renderCompare(); window.scrollTo({ top: 0 });
    });
    compareKeys = (e) => {
      const row = $$(".cmp-row").find((x) => !$(".on", x)) || $$(".cmp-row").pop();
      const map = { 1: "a", 2: "b", 3: "both", 4: "none" };
      if (map[e.key] && row) pick(row, map[e.key]);
      if (e.key === "Enter") $("[data-cmp-next]")?.click();
    };
  }
  let compareKeys = null;
  function renderCompareResults(queue) {
    const rows = CATS.filter((c) => c.key !== "city").map((c) => {
      const v = queue.map((r) => r.verdicts?.[c.key]?.pick).filter(Boolean);
      const n = (k) => v.filter((x) => x === k).length;
      return { label: c.label, old: n("old"), neu: n("new"), both: n("both"), none: n("none"), total: v.length };
    }).filter((x) => x.total);
    const version = items.find((r) => r.ai_b_version)?.ai_b_version || "new";
    const verdict = (x) => (x.neu > x.old ? `<span class="sr-pct good">New better</span>` : x.old > x.neu ? `<span class="sr-pct bad">Old better</span>` : `<span class="sr-pct mid">Tie</span>`);
    $("[data-body]").innerHTML = `
      <section class="panel"><div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Blind comparison · old vs ${esc(version)} ${A.info("Results of the A/B comparison: for each filter, how often you preferred the old prompt's labels or the new one's, without knowing which was which.")}</h2><span class="muted">${rows.reduce((n, x) => n + x.total, 0)} decisions on the filters where the two versions disagreed</span></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Filter</th><th>Old wins</th><th>New wins</th><th>Both OK</th><th>Neither</th><th>Result</th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td><b>${esc(x.label)}</b></td><td>${x.old}</td><td>${x.neu}</td><td>${x.both}</td><td>${x.none}</td><td>${verdict(x)}</td></tr>`).join("")}</tbody></table></div></section>
      <p class="hint" style="margin-top:12px">"Neither" means both versions were wrong on that post: those cases show what the next prompt must fix.</p>`;
  }

  function renderAccuracy() {
    const acc = accuracy();
    const n = acc[0]?.n || 0;
    $("[data-body]").innerHTML = `
      <section class="panel"><div class="values-head" style="justify-content:space-between"><h2 style="font-size:16px">Accuracy per filter ${A.info("How often the AI agrees with your reviewed labels, per filter. Precision: of what the AI marked, how much was right. Recall: of what's right, how much the AI found. Green ≥ 80%, amber ≥ 60%, red below. Use it to decide which filters are ready to run at scale.")}</h2><span class="muted">${n} reviewed posts · green ≥ 85% · amber ≥ 65%</span></div>
      <div class="table-wrap"><table class="data sr-acc"><thead><tr><th>Filter</th><th title="Of the labels the AI gave, how many were right">Precision</th><th title="Of the right labels, how many the AI found">Recall</th><th title="Posts where the AI got this filter exactly right">Exact</th><th>AI right</th><th>AI wrong</th><th>AI missed</th></tr></thead>
      <tbody>${acc.map((c) => `<tr><td><b>${esc(c.label)}</b></td>
        <td><span class="sr-pct ${tone(c.precision)}">${pct(c.precision)}</span></td>
        <td><span class="sr-pct ${tone(c.recall)}">${pct(c.recall)}</span></td>
        <td>${n ? pct(c.exact / n) : "—"}</td><td>${c.tp}</td><td>${c.fp}</td><td>${c.fn}</td></tr>`).join("")}</tbody></table></div></section>
      <p class="hint" style="margin-top:12px">Precision low → the AI marks things that aren't there. Recall low → the AI misses things. The pipeline report (<span class="mono">node library/smart-eval.mjs</span>) shows the same per value.</p>`;
  }

  // ---------- Preview of the post ----------
  function preview(p) {
    const u = p.url || ""; let m;
    if ((m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(u))) return `<iframe class="sr-frame" src="https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/" loading="lazy" scrolling="yes"></iframe>`;
    if ((m = /(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/.exec(u))) return `<iframe class="sr-frame sr-wide" src="https://www.youtube-nocookie.com/embed/${m[1]}" allowfullscreen></iframe>`;
    if ((m = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/.exec(u))) return `<iframe class="sr-frame" src="https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true"></iframe>`;
    // TikTok and Facebook limit or block their players: the saved cover and the post's link (below)
    if (/facebook\.com\//.test(u) && !p.cover_url) return `<iframe class="sr-frame" src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(u)}&width=500"></iframe>`;
    if ((m = /linkedin\.com\/feed\/update\/(urn:li:[\w:]+)/.exec(u))) return `<iframe class="sr-frame" src="https://www.linkedin.com/embed/feed/update/${m[1]}"></iframe>`;
    // TikTok, Facebook or no player for this link: the saved cover and the post's link
    return p.cover_url ? `<div class="sr-cover"><img src="${esc(p.cover_url)}" alt=""></div><a class="muted" href="${esc(u)}" target="_blank" rel="noopener">Open the post ↗</a>` : `<p class="muted">No preview</p>`;
  }

  // Verify mode (review sets named "… verify …"): every AI label must be confirmed (✓) or rejected (✗) before saving
  const isVerify = () => /verify/i.test(batch || "");
  function renderReview() {
    const r = items[idx];
    const verify = isVerify() && r.status !== "done";
    const p = posts.get(r.post_id) || { tags: {} };
    const cur = r.gold || r.ai || {};
    const ai = r.ai || {};
    const catRow = (c) => {
      const selected = setOf(cur[c.key]);
      const suggested = setOf(ai[c.key]);
      if (c.free && verify) {
        return `<div class="sr-cat" data-cat="${c.key}" data-free-verify="1"><div class="sr-cat-h">${esc(c.label)}<span>confirm or reject · add missing names below</span></div>
          <div class="sr-chips">${[...suggested].map((v) => `<button type="button" class="sr-chip ai pend" data-v="${esc(v)}">${esc(v)}</button>`).join("") || `<span class="muted">AI: none</span>`}</div>
          <input class="input sr-free" data-free="${c.key}" value="" placeholder="Missing? ${c.key === "opponent" ? "e.g. Real Madrid" : c.key === "city" ? "e.g. Milan (Italy)" : "e.g. Spotify"}"></div>`;
      }
      if (c.free) {
        return `<div class="sr-cat"><div class="sr-cat-h">${esc(c.label)}<span>names, separated by commas</span></div>
          <input class="input sr-free" data-free="${c.key}" value="${esc([...selected].join(", "))}" placeholder="${c.key === "opponent" ? "e.g. Real Madrid" : c.key === "city" ? "e.g. Milan (Italy)" : "e.g. Spotify, Emirates"}">
          ${suggested.size ? `<p class="sr-ai">AI: ${esc([...suggested].join(", "))}</p>` : ""}</div>`;
      }
      if (verify) {
        return `<div class="sr-cat" data-cat="${c.key}" data-single="${c.single ? 1 : ""}"><div class="sr-cat-h">${esc(c.label)}${c.single ? "<span>one</span>" : ""}</div>
          <div class="sr-chips">${(T.values[c.key] || []).map((v) => `<button type="button" class="sr-chip${suggested.has(v) ? " ai pend" : ""}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div></div>`;
      }
      return `<div class="sr-cat" data-cat="${c.key}" data-single="${c.single ? 1 : ""}"><div class="sr-cat-h">${esc(c.label)}${c.single ? "<span>one</span>" : ""}</div>
        <div class="sr-chips">${(T.values[c.key] || []).map((v) => `<button type="button" class="sr-chip${selected.has(v) ? " on" : ""}${suggested.has(v) ? " ai" : ""}" data-v="${esc(v)}" title="${suggested.has(v) ? "Suggested by the AI" : ""}">${esc(v)}</button>`).join("")}</div></div>`;
    };
    $("[data-body]").innerHTML = `
      <div class="sr-grid">
        <section class="panel sr-post">
          <header class="aud-h"><h2>The post</h2>${A.info("The post the AI labelled, as it looks on the network, with its caption. The grey tags come from the import (network, format, sport, competition, club) and aren't reviewed here.")}</header>
          <div class="sr-meta"><span class="status status-${r.status === "done" ? "completed" : r.status === "skipped" ? "reverted" : "importing"}">${r.status === "done" ? "Reviewed" : r.status === "skipped" ? "Skipped" : "To review"}</span>
            <b>#${idx + 1}</b> of ${items.length} · ${esc(String(p.published_at || "").slice(0, 10))}
            ${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">Open original ↗</a>` : ""}</div>
          <div class="sr-tags">${["platform", "format", "sport", "competition", "club", "entity"].flatMap((k) => (p.tags[k] || []).map((v) => `<span class="tag">${esc(v)}</span>`)).join("")}</div>
          <div class="sr-media">${preview(p)}</div>
          <details class="sr-caption" open><summary>Caption</summary><p>${esc(p.title || "(no caption)")}</p></details>
        </section>
        <section class="panel sr-form">
          <header class="aud-h"><h2>Labels</h2>${A.info("Every smart filter and its possible values. Dashed = the AI's guess, to confirm (✓) or reject (✗). Gold = chosen. Filters marked “one” take a single value. Free-text filters (opponent, city, sponsor) take names separated by commas. Your answers become the reference the AI is measured against.")}</header>
          <p class="hint" style="margin:0 0 10px">${verify ? `<b>Verify:</b> the dashed labels are the AI's. Click once to confirm (✓), twice to reject (✗). Click any other value to add a missing one. You can save when no dashed label is left.` : Object.keys(ai).length ? `<span class="sr-dot"></span> = suggested by the AI. Click to turn a label on or off.` : `<b>Blind review:</b> nothing is pre-selected. Mark the labels that apply to this post (leave a filter empty if none applies).`}</p>
          ${CATS.map(catRow).join("")}
          <label class="sr-note">Note (optional)<input class="input" data-note value="${esc(r.note || "")}" placeholder="Anything odd about this post?"></label>
        </section>
      </div>
      <div class="sr-bar">
        <button class="btn btn-ghost" type="button" data-prev ${idx ? "" : "disabled"}>← Previous</button>
        <span class="sr-keys"><kbd>←</kbd> previous <kbd>Enter</kbd> or <kbd>→</kbd> save &amp; next <kbd>S</kbd> skip</span>
        <button class="btn btn-ghost" type="button" data-skip>Skip</button>
        <button class="btn btn-primary" type="button" data-save>${icon("check")}Save &amp; next</button>
      </div>`;
    // TikTok cover
    $$(".sr-cat[data-cat]").forEach((box) => box.addEventListener("click", (e) => {
      const b = e.target.closest(".sr-chip");
      if (!b) return;
      if (b.classList.contains("ai") && verify) {
        // pending → confirmed → rejected → confirmed …
        if (b.classList.contains("pend")) { b.classList.remove("pend"); b.classList.add("on"); }
        else if (b.classList.contains("on")) { b.classList.remove("on"); b.classList.add("rej"); }
        else { b.classList.remove("rej"); b.classList.add("on"); }
      } else {
        if (box.dataset.single) $$(".sr-chip", box).forEach((x) => x !== b && !x.classList.contains("pend") && x.classList.remove("on"));
        b.classList.toggle("on");
      }
      const left = $$(".sr-form .sr-chip.pend").length;
      const btn = $("[data-save]");
      if (btn) btn.innerHTML = left ? `${left} to check` : `${icon("check")}Save &amp; next`;
    }));
    if (verify) { const left = $$(".sr-form .sr-chip.pend").length; if (left) $("[data-save]").innerHTML = `${left} to check`; }
    $("[data-prev]").addEventListener("click", () => { idx = Math.max(0, idx - 1); renderReview(); });
    $("[data-skip]").addEventListener("click", () => save("skipped"));
    $("[data-save]").addEventListener("click", () => save("done"));
  }

  function collect() {
    const gold = {};
    for (const c of CATS) {
      if (c.free) {
        const typed = ($(`[data-free="${c.key}"]`)?.value || "").split(",").map((x) => x.trim()).filter(Boolean);
        const confirmed = $$(`.sr-cat[data-cat="${c.key}"] .sr-chip.on`).map((b) => b.dataset.v);
        gold[c.key] = [...new Set([...confirmed, ...typed])];
        continue;
      }
      const on = $$(`.sr-cat[data-cat="${c.key}"] .sr-chip.on`).map((b) => b.dataset.v);
      gold[c.key] = c.single ? (on[0] || "") : on;
    }
    return gold;
  }
  async function save(status) {
    const r = items[idx];
    if (status === "done" && $$(".sr-form .sr-chip.pend").length) return A.toast("Confirm (✓) or reject (✗) every dashed label first.", "err");
    const btn = $("[data-save]");
    btn.disabled = true;
    const patch = { status, gold: status === "done" ? collect() : r.gold, note: $("[data-note]")?.value.trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: (await A.db.auth.getUser()).data.user?.id };
    const { error } = await A.db.from("smart_review").update(patch).eq("post_id", r.post_id);
    if (error) { btn.disabled = false; return A.toast(A.errMsg(error), "err"); }
    Object.assign(r, patch);
    const next = items.findIndex((x, i) => i > idx && x.status === "todo");
    idx = next >= 0 ? next : Math.min(items.length - 1, idx + 1);
    if (items.every((x) => x.status !== "todo")) { A.toast("All posts reviewed — here's the accuracy."); view = "accuracy"; }
    render();
    window.scrollTo({ top: 0 });
  }
  document.addEventListener("keydown", (e) => {
    if (view === "compare" && compareKeys && !e.target.matches("input, textarea")) return compareKeys(e);
    if (view !== "review" || e.target.matches("input, textarea")) return;
    if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); $("[data-save]")?.click(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); $("[data-prev]")?.click(); }
    if (e.key.toLowerCase() === "s") $("[data-skip]")?.click();
  });

  if (await load()) render();
})();

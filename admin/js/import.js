// SCP Admin — Import: CSV wizard (1. Upload → 2. Analysis → 3. Results) and import history (download / errors / revert /
// delete one or several imports — undoing them too, or keeping their posts).
// CSV format (same as the previous back-end):
//   external_id,published_at,embed,url,format,title,sport,competition,club,platform,entity[,trend,campaign]
//   Several values in one cell are separated by commas, e.g. "LaLiga,Champions League".
(async () => {
  const A = window.SCPA;
  const { $, $$, esc, icon, num, rpc } = A;
  try { await A.boot("import"); } catch { return; }
  const main = $("[data-main]");

  const FIELDS = [
    { key: "external_id", required: true, aliases: ["external_id", "externalid", "id", "post_id", "shortcode"] },
    { key: "published_at", required: true, aliases: ["published_at", "publishedat", "published", "date", "posted_at", "timestamp"] },
    { key: "embed", required: true, aliases: ["embed", "embed_code", "embed_html", "html"] },
    { key: "url", required: false, aliases: ["url", "link", "permalink", "post_url"] },
    { key: "title", required: false, aliases: ["title", "caption", "text"] },
    // the profile that published the post (Admin → Scraped profiles); Instagram /p/ links don't carry it
    { key: "account", required: false, aliases: ["account", "username", "user_posted", "profile", "profile_url", "handle", "author", "owner_username"] },
    ...A.CATEGORIES.map((c) => ({ key: c.key, required: false, aliases: [c.key, `${c.key}s`] })),
  ];
  const BATCH = 200;
  const PREVIEW_ROWS = 10;
  let view = "history";
  let wizard = null; // { step, file, parsed, analysis, importId, result }

  // ---------- Parsing helpers ----------
  const normHeader = (h) => String(h || "").replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  function parseDate(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/))) {
      return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    }
    if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) {
      return new Date(Date.UTC(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    }
    const d = new Date(s); // ISO with Z / offset
    return isNaN(d) ? undefined : d;
  }
  const normFormat = (name, platform) => {
    const n = String(name).toLowerCase(), pf = String(platform || "instagram").toLowerCase();
    if (["post", "image", "images", "photo"].includes(n)) return "Images";
    if (n === "carousel") return "Carousel";
    if (n === "reel" || n === "reels") return pf.includes("instagram") ? "Reel" : "Video";
    if (n === "short" || n === "shorts") return "Shorts";
    if (n === "video") return "Video";
    return name;
  };
  const splitValues = (v) => String(v ?? "").split(",").map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean);

  // ---------- Live console ("hacker view") while analysing / importing ----------
  // term.log(kind, html) adds a line (kinds: sys, read, row, map, check, warn, new, ok, err); term.stats(html) updates the header.
  function terminal(host, title = "scp@import:~$ analyze") {
    host.insertAdjacentHTML("beforeend", `<div class="term" data-term>
      <div class="term-head"><span class="term-dots"><i></i><i></i><i></i></span><b>${esc(title)}</b><span class="term-stats" data-term-stats></span></div>
      <div class="term-body" data-term-body><span class="term-cursor"></span></div></div>`);
    const box = host.querySelector("[data-term]:last-child");
    const body = $("[data-term-body]", box), statsEl = $("[data-term-stats]", box);
    const cursor = $(".term-cursor", body);
    const queue = [], MAX = 260, t0 = performance.now();
    let raf = 0;
    const flush = () => {
      raf = 0;
      const frag = document.createDocumentFragment();
      for (const l of queue.splice(0)) {
        const d = document.createElement("div");
        d.className = `tl tl-${l.k}`;
        d.innerHTML = `<span class="tl-t">${l.t}</span>${l.html}`;
        frag.append(d);
      }
      body.insertBefore(frag, cursor);
      while (body.childElementCount > MAX) body.firstElementChild.remove();
      body.scrollTop = body.scrollHeight;
    };
    const log = (k, html) => {
      queue.push({ k, html, t: `[${((performance.now() - t0) / 1000).toFixed(2).padStart(7, "0")}]` });
      if (queue.length > 500) queue.splice(0, queue.length - 500);
      raf ||= requestAnimationFrame(flush);
    };
    const stats = (html) => { statsEl.innerHTML = html; };
    const elapsed = () => (performance.now() - t0) / 1000;
    return { log, stats, elapsed };
  }
  const tq = (v, n = 38) => esc(String(v ?? "").replace(/\s+/g, " ").slice(0, n)) + (String(v ?? "").length > n ? "…" : "");
  const fmtSecs = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

  // Big files (hundreds of MB): read in pieces so the page never freezes, reporting progress as it goes
  function parseFile(file, progress, term) {
    return new Promise((resolve, reject) => {
      const data = [], errors = [];
      let fields = null, chunkNo = 0;
      const MB = 1048576;
      term?.log("sys", `open <b>${esc(file.name)}</b> · ${(file.size / MB).toFixed(1)} MB · streaming in 4 MB chunks`);
      Papa.parse(file, {
        header: true, skipEmptyLines: "greedy", chunkSize: 4 * 1024 * 1024,
        chunk: (res) => {
          if (!fields) {
            fields = res.meta.fields;
            term?.log("sys", `delimiter <b>${esc(JSON.stringify(res.meta.delimiter))}</b> · ${fields.length} columns detected`);
          }
          for (const r of res.data) data.push(r);
          chunkNo++;
          if (term) {
            const mbs = res.meta.cursor / MB / Math.max(term.elapsed(), 0.001);
            term.log("read", `READ chunk #${chunkNo} · +${num(res.data.length)} rows · ${(res.meta.cursor / MB).toFixed(1)}/${(file.size / MB).toFixed(1)} MB`);
            for (const r of [res.data[0], res.data[Math.floor(res.data.length / 2)]].filter(Boolean)) {
              const v = Object.values(r);
              term.log("row", `→ ${v.slice(0, 6).map((x) => tq(x, 22)).join(" <i>│</i> ")}`);
            }
            term.stats(`<span>${num(data.length)} rows</span><span>${mbs.toFixed(1)} MB/s</span><span>${Math.round((res.meta.cursor / file.size) * 100)}%</span>`);
          }
          if (errors.length < 20) errors.push(...res.errors.slice(0, 20 - errors.length));
          progress?.(`Reading the file… ${Math.min(99, Math.round((res.meta.cursor / file.size) * 100))}% · ${num(data.length)} rows`);
        },
        complete: () => resolve({ data, errors, meta: { fields: fields || [] } }),
        error: (err) => reject(new Error(`Couldn't read the file: ${err?.message || err}`)),
      });
    });
  }

  async function analyze(file, progress, term) {
    const parsed = await parseFile(file, progress, term);
    term?.log("ok", `parsed ${num(parsed.data.length)} rows in ${fmtSecs(term.elapsed())}${parsed.errors.length ? ` · ${parsed.errors.length} parse warnings` : ""}`);
    const headers = parsed.meta.fields || [];
    const map = {}; // field key -> original header
    const columns = headers.map((h) => {
      const n = normHeader(h);
      const f = FIELDS.find((x) => x.aliases.includes(n) && !map[x.key]);
      if (f) map[f.key] = h;
      return { csv_column: h, maps_to: f ? f.key : null, required: Boolean(f?.required) };
    });
    const missingColumns = FIELDS.filter((f) => f.required && !map[f.key]).map((f) => f.key);
    if (term) {
      for (const c of columns) term.log(c.maps_to ? "map" : "dim", c.maps_to ? `MAP  "${tq(c.csv_column, 30)}" → <b>${c.maps_to}</b>${c.required ? " (required)" : ""}` : `SKIP "${tq(c.csv_column, 30)}" (not used)`);
      for (const m of missingColumns) term.log("err", `MISSING required column <b>${m}</b>`);
      term.log("sys", "validating rows: ids, dates, embeds, duplicates…");
    }

    const catalog = await A.loadCatalog(true);
    const known = Object.fromEntries(A.CATEGORIES.map((c) => [c.key, new Set(catalog.byCat[c.key].map((v) => v.name.toLowerCase()))]));

    const rows = [];
    const missing = [], future = [], noTitle = [], badDate = [];
    const lastIndex = new Map(), seen = new Map();
    const now = Date.now() + 5 * 60 * 1000;

    parsed.data.forEach((raw, i) => {
      const line = i + 2; // header is line 1
      const get = (k) => (map[k] ? String(raw[map[k]] ?? "").trim() : "");
      const row = { _row: line, external_id: get("external_id"), embed: get("embed"), url: get("url"), title: get("title"), account: get("account") };
      for (const c of A.CATEGORIES) row[c.key] = splitValues(get(c.key)).join(",");
      // Formats: Post → Images, carousel → Carousel, only Instagram can be "Reel" (supabase/smart-filters.sql)
      row.format = splitValues(row.format).map((f) => normFormat(f, row.platform)).join(",");
      const dateRaw = get("published_at");
      const date = parseDate(dateRaw);
      row.published_at = date ? date.toISOString() : "";
      const miss = [];
      if (!row.external_id) miss.push("external_id");
      if (!dateRaw) miss.push("published_at");
      else if (date === undefined) { miss.push("published_at"); badDate.push({ row: line, date: dateRaw }); }
      if (!row.embed) miss.push("embed");
      row._missing = miss;
      if (miss.length && term && missing.length < 40) term.log("warn", `row ${line} · ${tq(row.external_id || "(no id)", 24)} · missing ${miss.join(", ")}`);
      if (miss.length) missing.push({ row: line, external_id: row.external_id, missing: miss.map((m) => (m === "published_at" && date === undefined ? "published_at (invalid date)" : m)) });
      if (date && date.getTime() > now) future.push({ row: line, external_id: row.external_id, date: dateRaw });
      if (!row.title && !miss.length) noTitle.push({ row: line, external_id: row.external_id });
      if (row.external_id) {
        lastIndex.set(row.external_id, rows.length);
        if (!seen.has(row.external_id)) seen.set(row.external_id, []);
        seen.get(row.external_id).push(line);
      }
      rows.push(row);
    });

    term?.log("ok", `validated ${num(rows.length)} rows · ${num(missing.length)} incomplete · ${num(future.length)} future dates`);
    const dupCsv = [...seen.entries()].filter(([, lines]) => lines.length > 1).map(([external_id, lines]) => ({ external_id, occurrences: lines.length, rows: lines }));
    const importable = rows.filter((r, idx) => !r._missing.length && lastIndex.get(r.external_id) === idx);

    // Which ids already exist in the database (they'll be replaced)
    const ids = [...new Set(importable.map((r) => r.external_id))];
    const existing = [];
    const parts = A.chunk(ids, 150);
    let checked = 0, round = 0;
    term?.log("sys", `SELECT external_id FROM content_ideas WHERE external_id IN (…) · ${num(ids.length)} ids · ${num(parts.length)} queries · 8 in parallel`);
    // 8 requests at a time (each id list must fit in a URL)
    for (let i = 0; i < parts.length; i += 8) {
      const q0 = performance.now(), before = existing.length;
      const res = await Promise.all(parts.slice(i, i + 8).map((part) => A.db.from("content_ideas").select("external_id").in("external_id", part)));
      for (const { data, error } of res) { if (error) throw error; existing.push(...data.map((d) => d.external_id)); }
      checked = Math.min(ids.length, (i + 8) * 150);
      if (term) {
        round++;
        const found = existing.length - before;
        const rate = checked / Math.max(term.elapsed(), 0.001);
        term.log("check", `QUERY #${round} · ${num(Math.min(1200, ids.length - i * 150))} ids · ${found ? `<b>${found} already in DB</b>` : "0 found"} · ${Math.round(performance.now() - q0)} ms`);
        if (found) term.log("dim", `  ↳ ${existing.slice(before, before + 3).map((x) => tq(x, 20)).join(", ")}${found > 3 ? ", …" : ""} will be replaced`);
        term.stats(`<span>${num(checked)}/${num(ids.length)} checked</span><span>${num(existing.length)} existing</span><span>ETA ${fmtSecs((ids.length - checked) / Math.max(rate, 1))}</span>`);
      }
      progress?.(`Checking which posts already exist… ${num(checked)} / ${num(ids.length)}`);
    }

    // Filter values that don't exist yet (they'll be created)
    const newValues = {};
    for (const c of A.CATEGORIES) {
      const found = new Map();
      for (const r of importable) for (const v of splitValues(r[c.key])) if (!known[c.key].has(v.toLowerCase()) && !found.has(v.toLowerCase())) found.set(v.toLowerCase(), v);
      if (found.size) newValues[c.key] = [...found.values()].sort((a, b) => a.localeCompare(b));
      if (term && found.size) { term.log("new", `NEW ${c.key}: ${[...found.values()].slice(0, 6).map((v) => `"${tq(v, 18)}"`).join(", ")}${found.size > 6 ? ` +${found.size - 6} more` : ""}`); }
    }
    term?.log("ok", `DONE · ${num(importable.length)} importable · ${num(existing.length)} to replace · ${num(rows.length - importable.length)} skipped · ${fmtSecs(term.elapsed())}`);

    return {
      total_rows: rows.length,
      total_columns: headers.length,
      columns: { all: columns, mapped: columns.filter((c) => c.maps_to), missing: missingColumns },
      importable_rows: missingColumns.length ? 0 : importable.length,
      skipped_rows: missingColumns.length ? rows.length : rows.length - importable.length,
      duplicates_in_csv: { count: dupCsv.length, items: dupCsv },
      duplicates_in_db: { count: existing.length, items: existing },
      rows_missing_required: { count: missing.length, items: missing },
      rows_with_future_date: { count: future.length, items: future },
      rows_without_title: { count: noTitle.length, items: noTitle },
      bad_dates: badDate,
      new_values: newValues,
      preview: importable.slice(0, PREVIEW_ROWS),
      importable: missingColumns.length ? [] : importable.map(({ _missing, ...r }) => r),
      parse_errors: parsed.errors.slice(0, 20),
    };
  }

  // ---------- History ----------
  async function showHistory() {
    view = "history"; wizard = null;
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Import</h1><p>Import history</p></div>
        <button class="btn btn-primary" type="button" data-new>${icon("import")}New Import</button>
      </div>
      <div class="selbar" hidden data-imp-selbar><span data-imp-selcount></span><span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" type="button" data-imp-clear>Clear</button>
        <button class="btn btn-danger btn-sm" type="button" data-imp-delete-sel>${icon("trash")}Delete selected</button></div>
      <section class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th class="td-check"><input class="check" type="checkbox" data-imp-all aria-label="Select all imports"></th><th>File</th><th>Status</th><th>Rows</th><th>Created</th><th>Replaced</th><th>Skipped</th><th>Date</th><th class="td-actions">Actions</th></tr></thead>
        <tbody data-history><tr><td class="table-empty" colspan="9"><span class="spinner sm"></span> Loading...</td></tr></tbody>
      </table></div></section>`;
    $("[data-new]").addEventListener("click", () => showWizard());
    const { data, error } = await A.db.from("idea_imports")
      .select("id,filename,file_path,status,total_rows,rows_created,rows_replaced,rows_skipped,error_count,created_at,completed_at")
      .order("created_at", { ascending: false }).limit(500);
    const body = $("[data-history]");
    if (error) { body.innerHTML = `<tr><td class="table-empty error-text" colspan="9">${esc(A.errMsg(error))}</td></tr>`; return; }
    if (!data.length) {
      body.innerHTML = `<tr><td class="table-empty" colspan="9">No imports yet<br><button class="link" type="button" data-first style="margin-top:8px">Start your first import</button></td></tr>`;
      $("[data-first]").addEventListener("click", () => showWizard());
      return;
    }
    const dash = (v, s) => (s === "analyzed" || v == null ? "—" : num(v));
    const LABEL = { analyzed: "Pending", importing: "Importing", completed: "Completed", reverted: "Reverted", failed: "Failed" };
    body.innerHTML = data.map((r) => `
      <tr data-imp-row="${r.id}">
        <td class="td-check"><input class="check" type="checkbox" data-imp-pick="${r.id}" aria-label="Select ${esc(r.filename)}"></td>
        <td class="td-title" title="${esc(r.filename)}">${esc(r.filename)}</td>
        <td><span class="status status-${r.status}">${LABEL[r.status] || r.status}</span></td>
        <td>${r.status === "analyzed" ? 0 : num(r.total_rows)}</td>
        <td>${dash(r.rows_created, r.status)}</td>
        <td>${dash(r.rows_replaced, r.status)}</td>
        <td>${dash(r.rows_skipped, r.status)}</td>
        <td class="td-date">${A.fmtDateTime(r.created_at)}</td>
        <td class="td-actions">
          ${r.file_path ? `<button class="icon-btn" type="button" data-dl="${r.id}" title="Download CSV" aria-label="Download CSV">${icon("download")}</button>` : ""}
          ${r.error_count ? `<button class="icon-btn" type="button" data-errs="${r.id}" title="Download ${num(r.error_count)} errors as CSV" aria-label="Download errors">${icon("alert")}</button>` : ""}
          ${["completed", "failed"].includes(r.status) ? `<button class="icon-btn danger" type="button" data-revert="${r.id}" title="Revert import" aria-label="Revert import">${icon("undo")}</button>` : ""}
          <button class="icon-btn danger" type="button" data-imp-del="${r.id}" title="Delete import" aria-label="Delete import">${icon("trash")}</button>
        </td>
      </tr>`).join("");

    // ---------- Delete imports (one or several) ----------
    const picked = new Set();
    const syncSel = () => {
      $("[data-imp-selbar]").hidden = !picked.size;
      $("[data-imp-selcount]").innerHTML = `<b>${num(picked.size)}</b> import${picked.size === 1 ? "" : "s"} selected`;
      $("[data-imp-all]").checked = picked.size === data.length;
      $("[data-imp-all]").indeterminate = picked.size > 0 && picked.size < data.length;
    };
    $("[data-imp-all]").addEventListener("change", (e) => {
      picked.clear();
      if (e.target.checked) data.forEach((r) => picked.add(r.id));
      $$("[data-imp-pick]").forEach((c) => (c.checked = e.target.checked));
      syncSel();
    });
    body.addEventListener("change", (e) => {
      const c = e.target.closest("[data-imp-pick]");
      if (!c) return;
      c.checked ? picked.add(Number(c.dataset.impPick)) : picked.delete(Number(c.dataset.impPick));
      syncSel();
    });
    $("[data-imp-clear]").addEventListener("click", () => { picked.clear(); $$("[data-imp-pick]").forEach((c) => (c.checked = false)); syncSel(); });
    $("[data-imp-delete-sel]").addEventListener("click", () => deleteImports(data.filter((r) => picked.has(r.id))));

    // Asks how to delete: undo the import too (default) or keep its posts. Imports that never added posts are just removed.
    function deleteImports(list) {
      if (!list.length) return;
      const withPosts = list.filter((r) => ["completed", "failed", "importing"].includes(r.status) && (r.rows_created || r.rows_replaced));
      const created = withPosts.reduce((n, r) => n + (r.rows_created || 0), 0);
      const replaced = withPosts.reduce((n, r) => n + (r.rows_replaced || 0), 0);
      const one = list.length === 1;
      const m = A.modal({
        title: one ? `Delete “${list[0].filename}”?` : `Delete ${num(list.length)} imports?`,
        size: "sm",
        body: withPosts.length ? `
          <div class="imp-del-opts">
            <label class="imp-del-opt"><input type="radio" name="imp-del" value="undo">
              <span><b>Delete and undo ${one ? "the import" : "the imports"}</b>
              <small>The ${num(created)} post${created === 1 ? "" : "s"} ${one ? "it" : "they"} created ${created === 1 ? "is" : "are"} deleted from the library${replaced ? ` and the ${num(replaced)} post${replaced === 1 ? "" : "s"} ${one ? "it" : "they"} replaced ${replaced === 1 ? "is" : "are"} restored` : ""}.</small>
              ${created >= 100 ? `<em class="imp-del-warn">⚠ ${num(created)} posts will disappear from the Content Library (and from members' saved boards).</em>` : ""}</span></label>
            <label class="imp-del-opt"><input type="radio" name="imp-del" value="keep">
              <span><b>Delete from the history only</b>
              <small>The posts stay in the library. You won't be able to revert ${one ? "this import" : "these imports"} later.</small></span></label>
          </div>
          <p class="muted imp-del-note">The uploaded CSV file${one ? " is" : "s are"} deleted too. This can't be undone.</p>`
          : `<p class="muted">${one ? "This import" : "These imports"} didn't add any posts. ${one ? "It's" : "They're"} removed from the history together with the uploaded CSV file${one ? "" : "s"}.</p>`,
        foot: `<button class="btn btn-ghost" type="button" data-no>Cancel</button><button class="btn btn-danger" type="button" data-yes${withPosts.length ? " disabled" : ""}>${icon("trash")}Delete${one ? "" : ` ${num(list.length)}`}</button>`,
      });
      // With posts involved nothing is preselected: Delete is enabled only after choosing what happens to them
      m.el.addEventListener("change", (ev) => {
        if (!ev.target.matches("input[name=imp-del]")) return;
        const yes = $("[data-yes]", m.el);
        yes.disabled = false;
        yes.innerHTML = `${icon("trash")}${ev.target.value === "undo" ? `Delete and remove ${num(created)} posts` : `Delete${one ? "" : ` ${num(list.length)}`}, keep posts`}`;
      });
      $("[data-no]", m.el).addEventListener("click", () => m.close());
      $("[data-yes]", m.el).addEventListener("click", async (ev) => {
        const btn = ev.currentTarget;
        const choice = $("input[name=imp-del]:checked", m.el)?.value;
        if (withPosts.length && !choice) return;
        const undo = choice === "undo";
        btn.disabled = true;
        let done = 0, removed = 0, restored = 0;
        const files = [];
        for (const r of list) {
          btn.innerHTML = `<span class="spinner sm"></span> ${num(done + 1)} / ${num(list.length)}`;
          try {
            const res = await rpc("delete_content_import", { p_import_id: r.id, p_with_posts: undo });
            removed += res?.deleted || 0; restored += res?.restored || 0;
            if (res?.file_path) files.push(res.file_path);
            done++;
          } catch (err) {
            m.close();
            A.toast(/delete_content_import|schema cache|PGRST202/i.test(`${err?.code} ${err?.message}`) ? "Deleting imports isn't set up yet — run supabase/import-delete.sql in the Supabase SQL Editor." : `Couldn't delete “${r.filename}”: ${A.errMsg(err)}`, "err");
            if (done) { A.resetCatalog?.(); showHistory(); }
            return;
          }
        }
        if (files.length) await A.db.storage.from("imports").remove(files);
        m.close();
        A.toast(`${num(done)} import${done === 1 ? "" : "s"} deleted${undo && (removed || restored) ? ` · ${num(removed)} posts removed${restored ? `, ${num(restored)} restored` : ""}` : ""}.`);
        A.resetCatalog?.();
        showHistory();
      });
    }

    body.addEventListener("click", async (e) => {
      const del = e.target.closest("[data-imp-del]");
      if (del) return deleteImports(data.filter((r) => r.id === Number(del.dataset.impDel)));
      const dl = e.target.closest("[data-dl]"), errs = e.target.closest("[data-errs]"), rev = e.target.closest("[data-revert]");
      const rec = (el, attr) => data.find((r) => r.id === Number(el.dataset[attr]));
      if (dl) {
        const r = rec(dl, "dl");
        const { data: blob, error: err } = await A.db.storage.from("imports").download(r.file_path);
        if (err) return A.toast("Download failed — file may no longer be available", "err");
        A.downloadBlob(blob, r.filename);
      }
      if (errs) {
        const r = rec(errs, "errs");
        const { data: full, error: err } = await A.db.from("idea_imports").select("errors").eq("id", r.id).single();
        if (err) return A.toast(A.errMsg(err), "err");
        downloadErrors(full.errors, r.filename);
      }
      if (rev) {
        const r = rec(rev, "revert");
        const ok = await A.confirmDialog({
          title: `Revert “${esc(r.filename)}”?`,
          text: `The ${num(r.rows_created)} content ideas created by this import will be deleted${r.rows_replaced ? `, and the ${num(r.rows_replaced)} ideas it replaced will be restored` : ""}.`,
          confirm: "Revert import", danger: true,
        });
        if (!ok) return;
        rev.disabled = true;
        try {
          const res = await rpc("revert_content_import", { p_import_id: r.id });
          A.toast(`Import reverted: ${num(res.deleted)} deleted, ${num(res.restored)} restored.`);
          showHistory();
        } catch (err) { A.toast(`Revert failed: ${A.errMsg(err)}`, "err"); rev.disabled = false; }
      }
    });
  }

  function downloadErrors(errors, filename) {
    const rows = (errors || []).map((x) => ({ row: x.row, external_id: x.external_id || "", error: x.error }));
    const csv = "﻿" + A.toCSV(rows, ["row", "external_id", "error"]);
    A.downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename.replace(/\.[^.]+$/, "")}-errors.csv`);
  }

  // ---------- Wizard ----------
  function stepsHtml(step) {
    const order = ["upload", "analysis", "results"];
    const i = order.indexOf(step === "importing" ? "analysis" : step);
    const lab = ["1. Upload", "2. Analysis", "3. Results"];
    return `<div class="steps">${lab.map((l, k) => `${k ? "<i></i>" : ""}<span class="${k === i ? "on" : k < i ? "done" : ""}">${l}</span>`).join("")}</div>`;
  }
  function wizardShell(inner) {
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Import</h1><p>Import content ideas from CSV</p></div>
        <button class="btn btn-ghost" type="button" data-back>← Back to History</button>
      </div>
      ${stepsHtml(wizard.step)}
      ${inner}`;
    $("[data-back]").addEventListener("click", showHistory);
  }

  function showWizard() {
    view = "wizard";
    wizard = { step: "upload", file: null };
    renderUpload();
  }

  function renderUpload(errorText = "") {
    wizard.step = "upload";
    wizardShell(`
      <section class="panel panel-pad">
        <label class="drop${wizard.file ? " has-file" : ""}" data-drop>
          <input type="file" accept=".csv,.txt,text/csv" hidden data-file>
          ${icon("import")}
          <b>${wizard.file ? esc(wizard.file.name) : "Drop your CSV file here"}</b>
          <span class="muted">${wizard.file ? `${num(Math.round(wizard.file.size / 1024))} KB · click to choose another file` : "or click to browse"}</span>
        </label>
        <p class="hint" style="margin-top:12px">Columns: <span class="mono">external_id, published_at, embed, url, format, title, sport, competition, club, platform, entity</span> (optional: <span class="mono">trend, campaign, account</span> — the profile that published it). Put several values in one cell separated by commas.</p>
        <p class="error-text" data-err ${errorText ? "" : "hidden"}>${esc(errorText)}</p>
        <div class="wizard-actions"><button class="btn btn-primary" type="button" data-go ${wizard.file ? "" : "disabled"}>Upload &amp; Analyze</button></div>
      </section>`);
    const drop = $("[data-drop]"), input = $("[data-file]");
    const pick = (file) => {
      if (!file) return;
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext !== "csv" && ext !== "txt") return renderUpload("Only CSV files are allowed.");
      wizard.file = file; renderUpload();
    };
    input.addEventListener("change", () => pick(input.files[0]));
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); pick(e.dataTransfer.files[0]); });
    $("[data-go]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const say = (t) => { btn.innerHTML = `<span class="spinner sm"></span> ${esc(t)}`; };
      say("Reading the file…");
      const term = terminal(btn.closest(".panel"));
      try {
        const analysis = await analyze(wizard.file, say, term);
        say("Saving the analysis…");
        if (!analysis.total_rows) throw new Error("The file has no data rows.");
        // Create the import record and keep the original file
        const { data: rec, error } = await A.db.from("idea_imports").insert({ filename: wizard.file.name, total_rows: analysis.total_rows, status: "analyzed" }).select("id").single();
        if (error) throw error;
        const path = `${rec.id}/${wizard.file.name.replace(/[^\w.\- ]+/g, "_")}`;
        // Keep a copy of the original file when it fits in Storage (Supabase's limit is 50 MB per file)
        if (wizard.file.size <= 45 * 1024 * 1024) {
          say("Saving a copy of the file…");
          const up = await A.db.storage.from("imports").upload(path, wizard.file, { contentType: "text/csv", upsert: true });
          if (!up.error) await A.db.from("idea_imports").update({ file_path: path }).eq("id", rec.id);
        } else wizard.noCopy = true;
        wizard.importId = rec.id;
        wizard.analysis = analysis;
        renderAnalysis();
      } catch (err) { console.error(err); term.log("err", `ERROR ${esc(err?.message || err)}`); await new Promise((r) => setTimeout(r, 1500)); renderUpload(`Upload failed: ${err?.message && !/schema cache|does not exist/i.test(err.message) ? err.message : A.errMsg(err)}`); }
    });
  }

  function accordion({ title, count, tone = "warn", note = "", body = "", open = false }) {
    return `<details class="acc acc-${tone}"${open ? " open" : ""}><summary><span>${title}</span><span>${count}</span></summary><div class="acc-body">${note ? `<p class="note">${note}</p>` : ""}${body}</div></details>`;
  }
  const miniTable = (head, rows) => `<div class="table-wrap"><table class="data"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  const LIMIT = 100;
  const more = (n) => (n > LIMIT ? `<p class="hint">…and ${num(n - LIMIT)} more</p>` : "");

  function renderAnalysis(errorText = "") {
    wizard.step = "analysis";
    const T = wizard.analysis;
    const blocked = T.rows_with_future_date.count > 0 || T.importable_rows === 0;
    const parts = [];

    parts.push(`<div class="stats">
      <div class="stat"><p>Total Rows</p><b>${num(T.total_rows)}</b></div>
      <div class="stat"><p>Columns</p><b>${num(T.total_columns)}</b><p>${T.columns.mapped.length} mapped</p></div>
      <div class="stat green"><p>Importable</p><b>${num(T.importable_rows)}</b></div>
      <div class="stat ${T.skipped_rows ? "amber" : ""}"><p>Skipped</p><b>${num(T.skipped_rows)}</b></div>
    </div>`);

    if (wizard.noCopy) parts.push(`<div class="info-box">This file is ${num(Math.round(wizard.file.size / 1048576))} MB, more than Storage accepts (50 MB), so a copy of the original won't be kept in the history. The import works normally.</div>`);
    if (T.columns.missing.length) {
      parts.push(`<div class="panel panel-pad error-text">Required column${T.columns.missing.length > 1 ? "s" : ""} missing: <b class="mono">${T.columns.missing.join(", ")}</b>. Nothing can be imported from this file.</div>`);
    }

    parts.push(accordion({
      title: "Column mapping", count: `${T.columns.mapped.length} mapped`, tone: "good",
      body: miniTable(["CSV Column", "Maps To", "Type"], T.columns.all.map((c) => `<tr><td class="mono">${esc(c.csv_column)}</td><td class="mono">${c.maps_to ? esc(c.maps_to) : '<span class="dim">ignored</span>'}</td><td>${c.maps_to ? `<span class="tag ${c.required ? "tag-req" : ""}">${c.required ? "required" : "optional"}</span>` : ""}</td></tr>`)),
    }));
    if (T.duplicates_in_csv.count) parts.push(accordion({
      title: "Duplicates in CSV", count: `${num(T.duplicates_in_csv.count)}`, note: "Only the last occurrence of each ID will be imported.",
      body: miniTable(["External ID", "Occurrences", "Rows"], T.duplicates_in_csv.items.slice(0, LIMIT).map((d) => `<tr><td class="mono">${esc(d.external_id)}</td><td>${d.occurrences}</td><td>${d.rows.join(", ")}</td></tr>`)) + more(T.duplicates_in_csv.count),
    }));
    if (T.duplicates_in_db.count) parts.push(accordion({
      title: "Already in the database", count: `${num(T.duplicates_in_db.count)} will be replaced`, note: "These will be deleted and recreated with new data.",
      body: `<div class="value-chips">${T.duplicates_in_db.items.slice(0, LIMIT).map((id) => `<span class="tag">${esc(id)}</span>`).join("")}</div>${more(T.duplicates_in_db.count)}`,
    }));
    if (T.rows_missing_required.count) parts.push(accordion({
      title: "Rows missing required fields", count: `${num(T.rows_missing_required.count)} rows`, tone: "bad", note: "These rows will be skipped.",
      body: miniTable(["Row", "External ID", "Missing"], T.rows_missing_required.items.slice(0, LIMIT).map((r) => `<tr><td>${r.row}</td><td class="mono">${esc(r.external_id || "—")}</td><td>${esc(r.missing.join(", "))}</td></tr>`)) + more(T.rows_missing_required.count),
    }));
    if (T.rows_with_future_date.count) parts.push(accordion({
      title: "Rows with a future date", count: `${num(T.rows_with_future_date.count)} rows`, tone: "bad", open: true,
      note: "Published-at can't be in the future. Fix these rows before importing.",
      body: miniTable(["Row", "External ID", "Date"], T.rows_with_future_date.items.slice(0, LIMIT).map((r) => `<tr><td>${r.row}</td><td class="mono">${esc(r.external_id)}</td><td>${esc(r.date)}</td></tr>`)) + more(T.rows_with_future_date.count),
    }));
    if (T.rows_without_title.count) parts.push(accordion({
      title: "Rows without title", count: `${num(T.rows_without_title.count)} rows`, note: "They will be imported with no title.",
      body: miniTable(["Row", "External ID"], T.rows_without_title.items.slice(0, LIMIT).map((r) => `<tr><td>${r.row}</td><td class="mono">${esc(r.external_id)}</td></tr>`)) + more(T.rows_without_title.count),
    }));
    const nv = Object.entries(T.new_values);
    if (nv.length) parts.push(accordion({
      title: "New filter values", count: `${num(nv.reduce((n, [, v]) => n + v.length, 0))} new`, note: "Will be created during import.",
      body: nv.map(([k, vals]) => `<p class="label" style="margin-top:8px">${A.CAT_LABEL[k]}</p><div class="value-chips">${vals.map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div>`).join(""),
    }));
    if (T.preview.length) parts.push(accordion({
      title: "Preview", count: `First ${T.preview.length} rows`, tone: "good",
      body: miniTable(["Row", "external_id", "published_at", "title", "embed", ...A.CATEGORIES.map((c) => c.key)], T.preview.map((r) => `<tr><td>${r._row}</td><td class="mono">${esc(r.external_id)}</td><td class="td-date">${A.fmtDate(r.published_at)}</td><td class="td-title">${esc(r.title || "—")}</td><td class="mono dim">${esc(String(r.embed).substring(0, 40))}...</td>${A.CATEGORIES.map((c) => `<td>${esc(r[c.key] || "—")}</td>`).join("")}</tr>`)),
    }));

    wizardShell(`
      <div class="vstack">${parts.join("")}</div>
      <p class="error-text" ${errorText ? "" : "hidden"} style="margin-top:12px">${esc(errorText)}</p>
      <div class="wizard-actions">
        <button class="btn btn-ghost" type="button" data-cancel>← Cancel</button>
        <button class="btn btn-primary" type="button" data-confirm ${blocked ? "disabled" : ""}>Confirm Import</button>
      </div>`);
    $("[data-cancel]").addEventListener("click", showHistory);
    $("[data-confirm]").addEventListener("click", runImport);
  }

  async function runImport() {
    const T = wizard.analysis;
    wizard.step = "importing";
    wizardShell(`<section class="panel"><div class="big-spinner"><div class="spinner"></div><b>Importing...</b><p>This may take a few minutes for large files.</p><div class="progress"><i data-bar style="width:0%"></i></div><p class="dim" data-progress></p></div></section>`);
    const term = terminal($(".big-spinner").parentElement, "scp@import:~$ import --commit");
    const rows = T.importable;
    const total = { created: 0, replaced: 0, errors: [], new_values_created: {} };
    let noAccounts = false;
    try {
      await A.db.from("idea_imports").update({ status: "importing" }).eq("id", wizard.importId);
      const batches = A.chunk(rows, BATCH);
      term.log("sys", `BEGIN import #${wizard.importId} · ${num(rows.length)} rows · ${num(batches.length)} batches of ${BATCH}`);
      for (let i = 0; i < batches.length; i++) {
        const b0 = performance.now();
        const res = await rpc("import_content_ideas_batch", { p_import_id: wizard.importId, p_rows: batches[i] });
        const accts = batches[i].filter((r) => r.account).map((r) => ({ external_id: r.external_id, account: r.account }));
        if (accts.length && !noAccounts) await rpc("set_idea_accounts", { p_rows: accts }).catch(() => { noAccounts = true; term.log("warn", "Accounts not saved: run supabase/scraped-profiles.sql in Supabase"); });
        const doneRows = Math.min((i + 1) * BATCH, rows.length);
        const rate = doneRows / Math.max(term.elapsed(), 0.001);
        term.log(res.errors?.length ? "warn" : "ok", `INSERT batch ${i + 1}/${batches.length} · +${res.created} created · ${res.replaced} replaced${res.errors?.length ? ` · ${res.errors.length} errors` : ""} · ${Math.round(performance.now() - b0)} ms`);
        term.log("row", `→ ${batches[i].slice(0, 3).map((r) => `${tq(r.external_id, 16)} ${tq(r.club || r.competition || "", 18)}`).join(" <i>│</i> ")}`);
        for (const [k, vals] of Object.entries(res.new_values_created || {})) if (vals.length) term.log("new", `CREATE ${k}: ${vals.slice(0, 5).map((v) => `"${tq(v, 18)}"`).join(", ")}${vals.length > 5 ? ` +${vals.length - 5}` : ""}`);
        term.stats(`<span>${num(doneRows)}/${num(rows.length)}</span><span>${Math.round(rate)} rows/s</span><span>ETA ${fmtSecs((rows.length - doneRows) / Math.max(rate, 1))}</span>`);
        total.created += res.created;
        total.replaced += res.replaced;
        total.errors.push(...(res.errors || []));
        for (const [k, vals] of Object.entries(res.new_values_created || {})) total.new_values_created[k] = [...(total.new_values_created[k] || []), ...vals];
        const done = Math.min((i + 1) * BATCH, rows.length);
        $("[data-bar]").style.width = `${Math.round((done / rows.length) * 100)}%`;
        $("[data-progress]").textContent = `${num(done)} / ${num(rows.length)} rows`;
      }
      const skippedErrors = T.rows_missing_required.items.map((r) => ({ row: r.row, external_id: r.external_id, error: `Missing required: ${r.missing.join(", ")}` }));
      const errors = [...skippedErrors, ...total.errors];
      const skipped = T.skipped_rows;
      await A.db.from("idea_imports").update({
        status: total.created || !rows.length ? "completed" : "failed",
        rows_created: total.created, rows_replaced: total.replaced, rows_skipped: skipped,
        error_count: errors.length, errors, new_values: total.new_values_created, completed_at: new Date().toISOString(),
      }).eq("id", wizard.importId);
      wizard.result = { ...total, skipped, errors };
      // Cached counts of the library (supabase/performance.sql)
      term.log("sys", "refreshing library counts…");
      for (const part of ["values", "totals"]) { const r = await A.db.rpc("refresh_library_stats", { p_part: part }); if (r.error) term.log("warn", `refresh ${part}: ${esc(r.error.message)}`); }
      A.resetCatalog();
      renderResults();
    } catch (err) {
      await A.db.from("idea_imports").update({
        status: total.created ? "failed" : "analyzed",
        rows_created: total.created, rows_replaced: total.replaced,
        error_count: total.errors.length + 1, errors: [...total.errors, { row: null, error: A.errMsg(err) }],
      }).eq("id", wizard.importId);
      renderAnalysis(`Import failed: ${A.errMsg(err)}${total.created ? ` (${num(total.created)} rows were imported before the error — you can revert them from the history)` : ""}`);
    }
  }

  function renderResults() {
    wizard.step = "results";
    const R = wizard.result;
    const nv = Object.entries(R.new_values_created);
    const nvCount = nv.reduce((n, [, v]) => n + v.length, 0);
    wizardShell(`
      <div class="vstack">
        <div class="stats">
          <div class="stat green"><p>Created</p><b>${num(R.created)}</b></div>
          <div class="stat accent"><p>Replaced</p><b>${num(R.replaced)}</b></div>
          <div class="stat ${R.skipped ? "amber" : ""}"><p>Skipped</p><b>${num(R.skipped)}</b></div>
          <div class="stat ${R.errors.length ? "red" : ""}"><p>Errors</p><b>${num(R.errors.length)}</b></div>
        </div>
        ${R.created + R.replaced ? `<div class="panel panel-pad"><b>Next: the covers</b><p class="muted" style="margin-top:4px">Without a cover a post shows only a poster in the library. In the terminal:</p><p class="mono" style="margin-top:8px">cd pipeline && node library/covers.mjs --new</p><p class="muted ms-small" style="margin-top:6px">--new takes every post imported in the last 2 days, whatever its publication date (--from filters by publication date).</p></div>` : ""}
        ${nvCount ? accordion({ title: "New filter values", count: `${num(nvCount)} created`, tone: "good", body: nv.map(([k, vals]) => `<p class="label" style="margin-top:8px">${A.CAT_LABEL[k]}</p><div class="value-chips">${vals.map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div>`).join("") }) : ""}
        ${R.errors.length ? accordion({
          title: "Errors", count: `${num(R.errors.length)}`, tone: "bad", open: true,
          body: miniTable(["Row", "External ID", "Error"], R.errors.slice(0, LIMIT).map((x) => `<tr><td>${x.row ?? "—"}</td><td class="mono">${esc(x.external_id || "—")}</td><td>${esc(x.error)}</td></tr>`)) + more(R.errors.length) + `<p style="margin-top:10px"><button class="btn btn-sm" type="button" data-err-csv>${icon("download")}Download errors CSV</button></p>`,
        }) : ""}
      </div>
      <div class="wizard-actions"><button class="btn btn-primary" type="button" data-done>Back to History</button></div>`);
    $("[data-done]").addEventListener("click", showHistory);
    $("[data-err-csv]")?.addEventListener("click", () => downloadErrors(R.errors, wizard.file.name));
  }

  showHistory();
})();

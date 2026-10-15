// Member profile: who the client is, their sport, channels, favourite profiles / creators, goals and newsletter.
// Saved with update_my_profile (name) + update_my_preferences (everything else). Used by the library ("For you")
// and by Admin → Audience to segment newsletters.
(async () => {
  const auth = window.SCP_AUTH;
  const root = document.querySelector("[data-pf]");
  if (!auth?.ready || !root) return;
  const db = auth.client;
  const r = await auth.getProfile();
  if (!r) return;
  const { session } = r;
  let profile = r.profile || {};
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const icon = (n) => (window.SCP_ICONS ? window.SCP_ICONS(n) : "");
  $$("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));

  // ---------- Options ----------
  const OPTIONS = {
    role: ["Social media manager", "Content creator", "Marketing / comms lead", "Head of digital", "Designer / video editor", "Agency", "Athlete", "Student", "Other"],
    language: ["English", "Español", "Català", "Italiano", "Português", "Français", "Deutsch"],
    orgType: ["Club", "League / federation", "Brand / sponsor", "Agency", "Media", "Athlete / creator", "Other"],
    teamSize: ["Just me", "2–5", "6–15", "16+"],
    platforms: ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"],
    audience: ["Under 10K", "10K–100K", "100K–1M", "1M–10M", "10M+"],
    goals: ["Grow followers", "More engagement", "Sponsorship revenue", "Ticket sales", "Merchandise sales", "Fan community", "Brand awareness", "Save production time"],
    formats: ["Reels / short video", "Carousels", "Images", "Stories", "Long video", "Live"],
    topics: ["Matchday", "Signings", "Kit launches", "Sponsor activations", "Behind the scenes", "Fans", "Milestones", "Community", "Ticketing", "Training", "Humour", "Women's sport"],
    frequency: ["Weekly", "Every two weeks", "Monthly"],
    newsletterTopics: ["New posts from my favourites", "Trends of the week", "Platform updates", "Content ideas for my sport", "Case studies", "AI tools", "Sponsorship & monetisation"],
  };
  const FREQ = { Weekly: "weekly", "Every two weeks": "biweekly", Monthly: "monthly" };
  const FREQ_BACK = Object.fromEntries(Object.entries(FREQ).map(([k, v]) => [v, k]));
  const PF_ICON = { Instagram: "instagram", TikTok: "tiktok", YouTube: "youtube", X: "x", Facebook: "facebook", LinkedIn: "linkedin" };

  // ---------- State ----------
  const blank = () => ({ sports: [], competitions: [], platforms: [], favouriteProfiles: [], favouriteCreators: [], goals: [], formats: [], topics: [], newsletterTopics: [] });
  let saved, state;
  const form = $("[data-pf-form]");
  function fromProfile(p) {
    return {
      ...blank(), ...(p.preferences || {}),
      first_name: p.first_name || "", last_name: p.last_name || "",
      newsletter: Boolean(p.newsletter), frequency: FREQ_BACK[p.newsletter_frequency] || "Weekly",
    };
  }
  saved = fromProfile(profile);
  state = structuredClone(saved);

  // ---------- Catalog (sports, competitions, accounts from the library) ----------
  let catalog = {};
  async function loadCatalog() {
    try {
      const { data } = await db.rpc("catalog_with_counts");
      for (const v of data || []) if (Number(v.ideas)) (catalog[v.category] ||= []).push({ id: Number(v.id), name: v.name, n: Number(v.ideas) });
      for (const k in catalog) catalog[k].sort((a, b) => b.n - a.n);
    } catch {}
  }
  const pretty = (n) => (n && n[0] === n[0].toLowerCase() ? n[0].toUpperCase() + n.slice(1) : n);

  // ---------- Chips ----------
  function renderChips() {
    $$("[data-single]").forEach((el) => {
      const k = el.dataset.single;
      el.innerHTML = OPTIONS[k].map((o) => `<button type="button" class="pf-chip" aria-pressed="${state[k] === o}" data-val="${esc(o)}">${esc(o)}</button>`).join("");
    });
    $$("[data-multi]").forEach((el) => {
      const k = el.dataset.multi;
      el.innerHTML = OPTIONS[k].map((o) => `<button type="button" class="pf-chip" aria-pressed="${state[k].includes(o)}" data-val="${esc(o)}">${PF_ICON[o] ? `<img src="assets/pf-${PF_ICON[o]}.svg" alt="">` : ""}${esc(o)}</button>`).join("");
    });
    $$("[data-catalog-chips]").forEach((el) => {
      const list = catalog[el.dataset.catalogChips] || [];
      el.innerHTML = list.length
        ? list.map((v) => `<button type="button" class="pf-chip" aria-pressed="${state.sports.includes(v.id)}" data-id="${v.id}">${esc(pretty(v.name))}</button>`).join("")
        : `<p class="pf-muted">Sports appear here once the library is connected.</p>`;
    });
  }
  root.addEventListener("click", (e) => {
    const chip = e.target.closest(".pf-chip");
    if (!chip) return;
    const single = chip.closest("[data-single]")?.dataset.single;
    const multi = chip.closest("[data-multi]")?.dataset.multi;
    if (single) state[single] = state[single] === chip.dataset.val ? "" : chip.dataset.val;
    else if (multi) state[multi] = state[multi].includes(chip.dataset.val) ? state[multi].filter((x) => x !== chip.dataset.val) : [...state[multi], chip.dataset.val];
    else if (chip.closest("[data-catalog-chips]")) { const id = Number(chip.dataset.id); state.sports = state.sports.includes(id) ? state.sports.filter((x) => x !== id) : [...state.sports, id]; }
    renderChips(); changed();
  });

  // ---------- Pickers (favourites, competitions): search the library's values, chips with initials, max N ----------
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const pickerValues = (el) => {
    const k = el.dataset.picker;
    return k === "competitions" ? state.competitions.map((id) => ({ id, name: (catalog.competition || []).find((v) => v.id === id)?.name || "?" })) : state[k];
  };
  function renderPicker(el, q = "") {
    const max = Number(el.dataset.max), free = "free" in el.dataset;
    const vals = pickerValues(el);
    const full = vals.length >= max;
    const query = q.trim().toLowerCase();
    const taken = new Set(vals.map((v) => v.id ?? v.name.toLowerCase()));
    const matches = query ? (catalog[el.dataset.source] || []).filter((v) => v.name.toLowerCase().includes(query) && !taken.has(v.id)).slice(0, 8) : [];
    const exact = (catalog[el.dataset.source] || []).some((v) => v.name.toLowerCase() === query);
    el.innerHTML = `
      <div class="pf-picked">
        ${vals.map((v, i) => `<span class="pf-pick"><span class="pf-pick-av" style="--h:${hue(v.name)}">${esc(initials(v.name))}</span>${esc(pretty(v.name))}${v.id == null ? `<small>new</small>` : ""}<button type="button" aria-label="Remove ${esc(v.name)}" data-unpick="${i}">${icon("x")}</button></span>`).join("")}
      </div>
      ${full ? `<p class="pf-muted">That's ${max} — remove one to add another.</p>` : `
      <div class="pf-search">${icon("search")}<input type="search" placeholder="${esc(el.dataset.placeholder)}" value="${esc(q)}" data-pick-q aria-label="${esc(el.dataset.placeholder)}"></div>
      ${query ? `<ul class="pf-results">
        ${matches.map((v) => `<li><button type="button" data-pick='${esc(JSON.stringify({ id: v.id, name: v.name }))}'><span class="pf-pick-av" style="--h:${hue(v.name)}">${esc(initials(v.name))}</span>${esc(pretty(v.name))}<small>${v.n} posts</small></button></li>`).join("")}
        ${free && !exact ? `<li><button type="button" data-pick='${esc(JSON.stringify({ id: null, name: q.trim() }))}'>${icon("plus")}Add “${esc(q.trim())}”<small>not in the library yet</small></button></li>` : ""}
        ${!matches.length && !free ? `<li class="pf-muted">No matches.</li>` : ""}
      </ul>` : ""}`}`;
    if (q) { const i = $("[data-pick-q]", el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  $$("[data-picker]").forEach((el) => {
    renderPicker(el);
    el.addEventListener("input", (e) => { if (e.target.matches("[data-pick-q]")) renderPicker(el, e.target.value); });
    el.addEventListener("click", (e) => {
      const k = el.dataset.picker;
      const add = e.target.closest("[data-pick]");
      const rm = e.target.closest("[data-unpick]");
      if (add) {
        const v = JSON.parse(add.dataset.pick);
        if (k === "competitions") state.competitions = [...state.competitions, v.id];
        else state[k] = [...state[k], v];
        renderPicker(el); changed();
      }
      if (rm) {
        const i = Number(rm.dataset.unpick);
        if (k === "competitions") state.competitions = state.competitions.filter((_, j) => j !== i);
        else state[k] = state[k].filter((_, j) => j !== i);
        renderPicker(el); changed();
      }
    });
  });

  // ---------- Text fields ----------
  const TEXT = ["first_name", "last_name", "country", "organization", "challenge"];
  function fillText() {
    for (const k of TEXT) form[k].value = state[k] || "";
    form.email.value = session.user.email;
    form.newsletter.checked = state.newsletter;
  }
  form.addEventListener("input", (e) => {
    if (TEXT.includes(e.target.name)) { state[e.target.name] = e.target.value; changed(); }
    if (e.target.name === "newsletter") { state.newsletter = e.target.checked; changed(); }
  });

  // ---------- Completeness, hero, save bar ----------
  const CHECKS = [
    ["your name", (s) => s.first_name], ["your role", (s) => s.role], ["your organisation", (s) => s.organization], ["the type of organisation", (s) => s.orgType],
    ["your sports", (s) => s.sports.length], ["your platforms", (s) => s.platforms.length], ["your audience size", (s) => s.audience],
    ["5 favourite profiles", (s) => s.favouriteProfiles.length >= 5, (s) => s.favouriteProfiles.length / 5], ["5 favourite creators", (s) => s.favouriteCreators.length >= 5, (s) => s.favouriteCreators.length / 5],
    ["your goals", (s) => s.goals.length], ["the topics you care about", (s) => s.topics.length],
  ];
  function meter() {
    const score = CHECKS.reduce((t, [, ok, part]) => t + (ok(state) ? 1 : part ? part(state) : 0), 0);
    const pct = Math.round((score / CHECKS.length) * 100);
    $("[data-pf-pct]").textContent = `${pct}%`;
    const c = 2 * Math.PI * 52;
    const ring = $("[data-pf-ring]");
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c * (1 - pct / 100);
    const missing = CHECKS.find(([, ok]) => !ok(state));
    $("[data-pf-next]").innerHTML = missing ? `Next: add ${esc(missing[0])}.` : `${icon("check")}Your profile is complete.`;
    const full = [state.first_name, state.last_name].filter(Boolean).join(" ");
    $("[data-profile-title]").textContent = full || "My profile";
    $("[data-pf-role]").textContent = state.role || "Your profile";
    $("[data-pf-org]").textContent = [state.organization, state.orgType].filter(Boolean).join(" · ");
    $$("[data-newsletter-only]").forEach((el) => (el.hidden = !state.newsletter));
  }
  const dirty = () => JSON.stringify(state) !== JSON.stringify(saved);
  function changed() {
    meter();
    const bar = $("[data-pf-savebar]");
    bar.hidden = !dirty();
    $("[data-pf-status]").textContent = "You have unsaved changes";
    bar.classList.remove("is-error");
  }
  window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

  $("[data-pf-discard]").addEventListener("click", () => { state = structuredClone(saved); fillText(); renderChips(); $$("[data-picker]").forEach((el) => renderPicker(el)); changed(); });
  $("[data-pf-save]").addEventListener("click", async () => {
    const bar = $("[data-pf-savebar]");
    if (!state.first_name.trim()) { form.first_name.focus(); bar.classList.add("is-error"); $("[data-pf-status]").textContent = "Please add your first name."; return; }
    const btn = $("[data-pf-save]");
    btn.disabled = true;
    const { first_name, last_name, newsletter, frequency, ...prefs } = state;
    const [a, b] = await Promise.all([
      db.rpc("update_my_profile", { p_first_name: first_name.trim(), p_last_name: last_name.trim() }),
      db.rpc("update_my_preferences", { p_preferences: prefs, p_newsletter: newsletter, p_frequency: FREQ[frequency] || "weekly" }),
    ]);
    btn.disabled = false;
    const err = a.error || b.error;
    if (err) { bar.classList.add("is-error"); $("[data-pf-status]").textContent = /schema cache|does not exist/i.test(err.message) ? "Profile storage isn't set up yet (run supabase/member-profile.sql)." : `Couldn't save: ${err.message}`; return; }
    saved = structuredClone(state);
    window.SCP_SET_USER?.({ first_name, last_name }, session.user.email);
    $("[data-pf-status]").textContent = "Saved";
    bar.classList.add("is-saved");
    setTimeout(() => { bar.hidden = true; bar.classList.remove("is-saved"); }, 1200);
  });

  // ---------- Profile photo: square-cropped + resized to 400px in the browser, stored in Storage "avatars/<user id>/" ----------
  const avatarEl = $("[data-pf-avatar]");
  const fileInput = $("[data-pf-file]");
  function showAvatar(url) {
    avatarEl.style.backgroundImage = url ? `url("${url}")` : "";
    avatarEl.classList.toggle("has-photo", Boolean(url));
    $("[data-pf-photo-remove]").hidden = !url;
    window.SCP_SET_AVATAR?.(url);
  }
  showAvatar(profile.avatar_url);
  $("[data-pf-photo]").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    const msg = $("[data-pf-photo-status]");
    if (!file.type.startsWith("image/")) { msg.textContent = "Please choose an image."; return; }
    msg.textContent = "Uploading…";
    try {
      const img = await createImageBitmap(file);
      const side = Math.min(img.width, img.height), size = Math.min(400, side);
      const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
      canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const up = await db.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await db.rpc("update_my_avatar", { p_url: url });
      if (error) throw error;
      if (profile.avatar_url) { const old = profile.avatar_url.split("/avatars/")[1]; if (old) db.storage.from("avatars").remove([decodeURIComponent(old)]); }
      profile.avatar_url = url;
      showAvatar(url);
      msg.textContent = "";
    } catch (err) {
      msg.textContent = /bucket|schema cache|does not exist|not found/i.test(err.message || "") ? "Photo storage isn't set up yet (run supabase/member-profile.sql)." : `Couldn't upload: ${err.message}`;
    }
  });
  $("[data-pf-photo-remove]").addEventListener("click", async () => {
    const { error } = await db.rpc("update_my_avatar", { p_url: null });
    if (error) { $("[data-pf-photo-status]").textContent = error.message; return; }
    const old = profile.avatar_url?.split("/avatars/")[1];
    if (old) db.storage.from("avatars").remove([decodeURIComponent(old)]);
    profile.avatar_url = null;
    showAvatar(null);
  });

  // ---------- Password ----------
  $("[data-password-save]").addEventListener("click", async () => {
    const status = $("[data-password-status]");
    const pw = form.password.value;
    const say = (m, ok) => { status.textContent = m; status.className = `form-status ${ok ? "ok" : "err"}`; };
    if (pw.length < 8) return say("Use at least 8 characters.");
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) return say(error.message);
    form.password.value = "";
    say("Password updated. You can now log in with it.", true);
  });

  // ---------- Section nav: highlight the section in view ----------
  const links = $$("[data-pf-nav] a");
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
  }), { rootMargin: "-35% 0px -60% 0px" });
  $$(".pf-card").forEach((s) => io.observe(s));

  // Show what we have straight away; sports / competitions / accounts arrive with the catalog
  fillText(); renderChips(); meter();
  await loadCatalog();
  renderChips(); $$("[data-picker]").forEach((el) => renderPicker(el));
})();

// Admin panel — only visible to admin / superadmin (enforced by Supabase RLS, not just here)
(async () => {
  const auth = window.SCP_AUTH;
  const $ = (sel) => document.querySelector(sel);
  const message = $("[data-admin-message]");
  const show = (text) => { message.hidden = false; message.innerHTML = text; };

  if (!auth?.ready) return show("Supabase isn't connected yet (keys missing in <code>js/config.js</code>).");

  const result = await auth.getProfile();
  if (!result) return show('You need to <a class="link-gold" href="login.html">log in</a> first.');

  const { session, profile } = result;
  $("[data-admin-email]").textContent = session.user.email;
  $("[data-admin-role]").textContent = profile?.role || "user";
  $("[data-admin-user]").hidden = false;
  $("[data-logout]").addEventListener("click", async () => {
    await auth.client.auth.signOut();
    location.href = "index.html";
  });

  const role = profile?.role;
  if (role !== "superadmin") {
    return show("Your account doesn't have access to the admin panel.");
  }

  const { data: rows, error } = await auth.client
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return show(`Couldn't load users: ${error.message}`);

  message.hidden = true;
  $("[data-admin-panel]").hidden = false;
  $("[data-admin-count]").textContent = `${rows.length} user${rows.length === 1 ? "" : "s"}`;

  const tbody = $("[data-admin-rows]");
  const canEdit = role === "superadmin";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  tbody.innerHTML = rows.map((r) => {
    const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
    const plan = r.plan ? `${r.plan}${r.users ? ` · ${r.users} user${r.users > 1 ? "s" : ""}` : ""}` : "—";
    const date = new Date(r.created_at).toLocaleDateString();
    const roleCell = canEdit && r.id !== session.user.id
      ? `<select data-role="${esc(r.id)}">${["user", "admin", "superadmin"].map((o) => `<option${o === r.role ? " selected" : ""}>${o}</option>`).join("")}</select>`
      : `<span class="pill pill-dark pill-sm">${esc(r.role)}</span>`;
    return `<tr><td>${esc(name)}</td><td>${esc(r.email)}</td><td>${esc(plan)}</td><td>${esc(date)}</td><td>${roleCell}</td></tr>`;
  }).join("");

  tbody.addEventListener("change", async (e) => {
    const select = e.target.closest("[data-role]");
    if (!select) return;
    select.disabled = true;
    const { error: err } = await auth.client.from("profiles").update({ role: select.value }).eq("id", select.dataset.role);
    select.disabled = false;
    if (err) alert(`Couldn't update role: ${err.message}`);
  });
})();

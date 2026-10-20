// Offer bar at the top centre of the public website: "Special pricing for Spain - 15% off yearly plans with CODE [copy]".
// The code comes from Admin → Promo codes (supabase/promo-codes.sql: promo_banner), only while it's live in Stripe.
// The visitor's country is guessed from the time zone (then the browser language); nothing is sent but that country code.
// Copying (or just seeing) the code keeps it for the checkout, which applies it by itself (js/checkout.js).
(() => {
  const cfg = window.SCP_CONFIG || {};
  const nav = document.querySelector("[data-nav]");
  if (!nav || !cfg.supabaseUrl || document.body.classList.contains("library-page")) return;
  const es = window.SCP_LANG === "es";
  const TZ = { "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Africa/Ceuta": "ES", "Europe/Andorra": "AD", "Europe/Lisbon": "PT", "Atlantic/Madeira": "PT",
    "Atlantic/Azores": "PT", "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Rome": "IT", "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI",
    "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Athens": "GR", "Europe/Istanbul": "TR", "America/Mexico_City": "MX", "America/Monterrey": "MX",
    "America/Cancun": "MX", "America/Tijuana": "MX", "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL", "America/Caracas": "VE",
    "America/Montevideo": "UY", "America/Asuncion": "PY", "America/La_Paz": "BO", "America/Guayaquil": "EC", "America/Sao_Paulo": "BR", "America/Toronto": "CA",
    "America/Vancouver": "CA", "America/Panama": "PA", "America/Costa_Rica": "CR", "America/Guatemala": "GT", "America/Santo_Domingo": "DO", "America/Puerto_Rico": "PR",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Asia/Tokyo": "JP", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kolkata": "IN" };
  const country = () => {
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    if (TZ[tz]) return TZ[tz];
    if (tz.startsWith("America/Argentina")) return "AR";
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Anchorage|Indiana)/.test(tz)) return "US";
    const reg = (navigator.languages || [navigator.language]).map((l) => /-([A-Z]{2})$/i.exec(l || "")?.[1]).find(Boolean);
    return reg ? reg.toUpperCase() : null;
  };
  const KEY = "scp-promo";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  const cc = country();
  fetch(`${cfg.supabaseUrl}/rest/v1/rpc/promo_banner`, { method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
    body: JSON.stringify({ p_country: cc }) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((d) => {
      if (!d || !d.code) return;
      try { localStorage.setItem(KEY, JSON.stringify({ code: d.code, at: Date.now() })); } catch {}
      const loc = es ? "es-ES" : "en-GB";
      let place = "";
      if (d.country) { try { place = new Intl.DisplayNames([loc], { type: "region" }).of(d.country); } catch { place = d.country; } }
      const off = d.kind === "percent" ? `${Number(d.percent_off).toLocaleString(loc)}%` : `${Number(d.amount_off_eur).toLocaleString(loc)} €`;
      const what = (es ? d.text_es : d.text) ? ` ${esc(es ? d.text_es : d.text)}` : "";
      const lead = es ? `Precio especial${place ? ` para <b>${esc(place)}</b>` : ""} - <b>${off} de descuento</b>${what} con`
                      : `Special pricing${place ? ` for <b>${esc(place)}</b>` : ""} - <b>${off} off</b>${what} with`;
      const bar = document.createElement("div");
      bar.className = "promo-bar";
      bar.setAttribute("role", "region"); bar.setAttribute("aria-label", es ? "Oferta" : "Offer");
      bar.setAttribute("data-i18n-skip", "");
      bar.innerHTML = `<p><span>${lead}</span> <button class="promo-code" type="button" title="${es ? "Copiar el código" : "Copy the code"}"><code>${esc(d.code)}</code>${ICON}</button></p>`;
      nav.before(bar);
      const btn = bar.querySelector(".promo-code");
      btn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(d.code); } catch {}
        btn.classList.add("is-done"); btn.lastElementChild.outerHTML = OK;
        btn.setAttribute("title", es ? "Copiado — se aplicará al pagar" : "Copied — it's applied at checkout");
        window.SCP_TRACK?.("promo_code_copied", { code: d.code, country: cc });
        setTimeout(() => { btn.classList.remove("is-done"); btn.lastElementChild.outerHTML = ICON; }, 2200);
      });
    });
})();

// HTML for the weekly SCP newsletter (email-safe: tables + inline styles, SCP navy / gold).
// Resend placeholders: {{{contact.first_name|there}}} and {{{RESEND_UNSUBSCRIBE_URL}}}.
export const SITE = "https://sportscontentplaybook.com";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const PLATFORM = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp", pinterest: "Pinterest", threads: "Threads", ai: "AI", other: "Sports marketing" };

const label = (t) => `<tr><td style="padding:34px 0 14px;color:#f0b84a;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700">${t}</td></tr>`;
const button = (href, text) => `<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;border-radius:100px;background:#f0b84a;color:#121b33;font-weight:700;font-size:15px;text-decoration:none">${esc(text)}</a>`;

function postCard(p) {
  const img = p.image ? `<tr><td><a href="${esc(p.link)}"><img src="${esc(p.image)}" width="248" alt="${esc(p.who)}" style="display:block;width:100%;max-width:248px;height:auto;border-radius:12px"></a></td></tr>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#17213b;border-radius:16px">
    <tr><td style="padding:12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${img}
        <tr><td style="padding:12px 4px 2px;color:#fff;font-size:15px;font-weight:700">${esc(p.who)}</td></tr>
        <tr><td style="padding:0 4px 8px;color:#8b98ae;font-size:12px">${esc([p.format, p.sport].filter(Boolean).join(" · "))}</td></tr>
        ${p.hook ? `<tr><td style="padding:0 4px 8px;color:#ffe0a0;font-size:13px;line-height:1.45">Hook: “${esc(p.hook)}”</td></tr>` : ""}
        <tr><td style="padding:0 4px 8px;color:#b4c0d3;font-size:13px;line-height:1.5">${esc(p.why)}</td></tr>
        <tr><td style="padding:0 4px 4px"><a href="${esc(p.link)}" style="color:#f0b84a;font-size:13px;font-weight:700;text-decoration:none">See the breakdown →</a></td></tr>
      </table>
    </td></tr></table>`;
}

export function renderWeekly({ subject, preheader, intro, news, posts, tip, blog, dateLabel }) {
  const rows = [];
  for (let i = 0; i < posts.length; i += 2) {
    const [a, b] = [posts[i], posts[i + 1]];
    rows.push(`<tr><td class="col" width="50%" valign="top" style="padding:0 6px 12px 0">${postCard(a)}</td><td class="col" width="50%" valign="top" style="padding:0 0 12px 6px">${b ? postCard(b) : ""}</td></tr>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@media (max-width:600px){.col{display:block!important;width:100%!important;padding:0 0 12px 0!important}.pad{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;padding:0;background:#0e1529">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif">
  <tr><td class="pad" style="padding:0 32px 18px">
    <table role="presentation" width="100%"><tr>
      <td><a href="${SITE}" style="color:#fff;text-decoration:none;font-weight:700;font-size:15px"><img src="${SITE}/assets/icon-logo-lg.png" width="26" height="25" alt="" style="vertical-align:middle;margin-right:8px">Sports Content Playbook</a></td>
      <td align="right" style="color:#8b98ae;font-size:12px">${esc(dateLabel)}</td>
    </tr></table>
  </td></tr>
  <tr><td class="pad" style="padding:34px 32px;background:#121b33;border:1px solid rgba(240,184,74,0.4);border-radius:22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="color:#f0b84a;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;padding-bottom:12px">The weekly playbook</td></tr>
      <tr><td style="color:#fff;font-size:28px;line-height:1.2;font-weight:700;padding-bottom:16px">${esc(subject)}</td></tr>
      <tr><td style="color:#b4c0d3;font-size:15px;line-height:1.65">Hi {{{contact.first_name|there}}},<br><br>${esc(intro)}</td></tr>

      ${posts.length ? `${label("Sports posts working right now")}<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></td></tr>` : ""}

      ${news.length ? `${label("This week in sports digital marketing")}${news.map((n) => `
      <tr><td style="padding:0 0 12px"><table role="presentation" width="100%" style="background:#17213b;border-radius:14px"><tr><td style="padding:16px 18px">
        <div style="color:#f0b84a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding-bottom:6px">${esc(PLATFORM[n.platform] || "News")}</div>
        <a href="${esc(n.link)}" style="color:#fff;font-size:16px;font-weight:700;line-height:1.35;text-decoration:none">${esc(n.title)}</a>
        <div style="color:#b4c0d3;font-size:14px;line-height:1.55;padding-top:6px">${esc(n.take)}</div>
      </td></tr></table></td></tr>`).join("")}` : ""}

      ${tip ? `${label("Try this week")}<tr><td style="padding:18px 20px;background:rgba(240,184,74,0.12);border:1px solid rgba(240,184,74,0.35);border-radius:14px;color:#fff;font-size:15px;line-height:1.6">${esc(tip)}</td></tr>` : ""}

      ${blog ? `${label("From the blog")}<tr><td style="padding:0 0 4px"><a href="${esc(blog.link)}" style="color:#fff;font-size:17px;font-weight:700;line-height:1.35;text-decoration:none">${esc(blog.title)}</a><div style="color:#b4c0d3;font-size:14px;line-height:1.55;padding-top:6px">${esc(blog.excerpt)}</div></td></tr>` : ""}

      <tr><td style="padding:34px 0 4px" align="center">${button(`${SITE}/content-library.html`, "Explore the Content Library")}</td></tr>
    </table>
  </td></tr>
  <tr><td class="pad" style="padding:24px 32px;color:#6f7d95;font-size:12px;line-height:1.6" align="center">
    You're receiving this because you subscribed at sportscontentplaybook.com.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8b98ae">Unsubscribe</a> · <a href="https://www.linkedin.com/company/sportscontentplaybook" style="color:#8b98ae">LinkedIn</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

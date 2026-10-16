// HTML for the weekly SCP newsletter (email-safe: tables + inline styles, SCP navy / gold).
// Structure: header + intro · Social News ("This week on SCP") · 4 featured posts (2 × 2) · 3 blog articles with photo
// · social icons. Email clients block embeds (iframes / scripts), so posts are shown as their cover image linked to the post.
// Resend placeholders: {{{contact.first_name|there}}} and {{{RESEND_UNSUBSCRIBE_URL}}}.
export const SITE = "https://sportscontentplaybook.com";
// Social profiles shown at the bottom (empty = hidden)
export const SOCIAL = {
  Instagram: "",
  TikTok: "",
  LinkedIn: "https://www.linkedin.com/company/sportscontentplaybook",
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// **bold** in Claude's text → <b>
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b style="color:#ffffff">$1</b>');
const FONT = "font-family:Arial,Helvetica,sans-serif";

const bar = (text) => `<tr><td style="padding:30px 0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="background:#f0b84a;border-radius:10px;padding:12px 18px;color:#121b33;font-size:18px;font-weight:700;${FONT}">${text}</td></tr></table></td></tr>`;

function blogCard(b, i) {
  return `<tr><td style="padding:${i ? "28px" : "4px"} 0 0">
    <a href="${esc(b.link)}"><img src="${esc(b.image)}" width="536" alt="${esc(b.title)}" style="display:block;width:100%;max-width:536px;height:auto;border-radius:14px;border:0"></a>
    <p style="margin:16px 0 0;color:#f0b84a;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;${FONT}">${esc(b.type)} · ${esc(b.date)}</p>
    <a href="${esc(b.link)}" style="display:block;margin-top:8px;color:#ffffff;font-size:22px;line-height:1.3;font-weight:700;text-decoration:none;${FONT}">${esc(b.title)}</a>
    ${b.teaser.map((p) => `<p style="margin:12px 0 0;color:#b4c0d3;font-size:15px;line-height:1.65;${FONT}">${rich(p)}</p>`).join("")}
    <p style="margin:16px 0 0"><a href="${esc(b.link)}" style="display:inline-block;padding:11px 20px;border-radius:100px;background:#1d2845;border:1px solid rgba(240,184,74,0.5);color:#f0b84a;font-size:14px;font-weight:700;text-decoration:none;${FONT}">Read the article →</a></p>
  </td></tr>`;
}

function featured(p) {
  if (!p) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121b33;border:1px solid rgba(255,255,255,0.08);border-radius:16px">
    <tr><td style="padding:10px 10px 0">
      ${p.image ? `<a href="${esc(p.url)}"><img src="${esc(p.image)}" width="238" alt="${esc(p.who)} on Instagram" style="display:block;width:100%;max-width:238px;height:auto;border-radius:10px;border:0"></a>` : ""}
    </td></tr>
    <tr><td style="padding:12px 14px 14px;${FONT}">
      <p style="margin:0;color:#f0b84a;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${p.reel ? "&#9654; " : ""}${esc([p.format, p.sport].filter(Boolean).join(" · "))}</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:15px;font-weight:700;line-height:1.3">${esc(p.who)}</p>
      <p style="margin:6px 0 0;color:#b4c0d3;font-size:13px;line-height:1.55">${rich(p.description)}</p>
      <p style="margin:10px 0 0"><a href="${esc(p.url)}" style="color:#f0b84a;font-size:13px;font-weight:700;text-decoration:none">${p.reel ? "Watch it" : "See the post"} →</a>${p.analysis ? ` <span style="color:#3a4a6b">·</span> <a href="${esc(p.analysis)}" style="color:#b4c0d3;font-size:13px;text-decoration:none">Breakdown in SCP</a>` : ""}</p>
    </td></tr></table>`;
}

export function renderWeekly({ subject, preheader, intro, topStory, news, posts = [], blogs, dateLabel }) {
  const socials = Object.entries(SOCIAL).filter(([, url]) => url);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@media (max-width:600px){.pad{padding-left:20px!important;padding-right:20px!important}.col{display:block!important;width:100%!important;padding:0 0 12px 0!important}}</style></head>
<body style="margin:0;padding:0;background:#0e1529">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1529"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;${FONT}">

  <!-- Header -->
  <tr><td class="pad" align="center" style="padding:36px 32px 32px;background:#121b33;border:1px solid rgba(240,184,74,0.4);border-radius:22px 22px 0 0">
    <a href="${SITE}" style="text-decoration:none"><img src="${SITE}/assets/icon-logo-lg.png" width="44" height="42" alt="" style="display:block;margin:0 auto 12px"></a>
    <a href="${SITE}" style="color:#ffffff;font-size:22px;font-weight:700;text-decoration:none;letter-spacing:-0.3px">Sports Content <span style="color:#f0b84a">Playbook</span></a>
    <p style="margin:6px 0 0;color:#8b98ae;font-size:12px;letter-spacing:1.4px;text-transform:uppercase">The weekly playbook · ${esc(dateLabel)}</p>
    <p style="margin:24px 0 0;color:#e6ebf3;font-size:16px;line-height:1.65;text-align:center">Hi {{{contact.first_name|there}}}, welcome to this week's SCP! ${rich(intro)}</p>
  </td></tr>

  <tr><td class="pad" style="padding:0 32px 34px;background:#17213b;border:1px solid rgba(240,184,74,0.4);border-top:0;border-radius:0 0 22px 22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

      ${topStory || news.length ? `${bar("Social News: this week on SCP")}
      ${topStory ? `<tr><td style="color:#ffffff;font-size:16px;font-weight:700;padding:4px 0 10px">Top story of the week:</td></tr>
      <tr><td style="padding:0 0 4px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="top" style="color:#f0b84a;font-size:16px;padding:1px 10px 0 4px">•</td>
        <td><a href="${esc(topStory.link)}" style="color:#f0b84a;font-size:16px;font-weight:700;line-height:1.45;text-decoration:none">${esc(topStory.title)}</a>
          <p style="margin:6px 0 0;color:#b4c0d3;font-size:14px;line-height:1.6">${rich(topStory.take)}</p></td></tr></table></td></tr>` : ""}
      ${news.length ? `<tr><td style="padding:18px 0"><div style="height:2px;width:80%;margin:0 auto;background:#f0b84a;border-radius:2px;line-height:2px;font-size:0">&nbsp;</div></td></tr>
      ${news.map((n) => `<tr><td style="padding:0 0 12px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="top" style="color:#f0b84a;font-size:16px;padding:1px 10px 0 4px">•</td>
        <td><a href="${esc(n.link)}" style="color:#f0b84a;font-size:15px;font-weight:700;line-height:1.45;text-decoration:none">${esc(n.title)}</a></td></tr></table></td></tr>`).join("")}` : ""}` : ""}

      ${posts.length ? `${bar("Featured content of the week")}
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${[0, 2].filter((i) => posts[i]).map((i) => `<tr>
          <td class="col" width="50%" valign="top" style="padding:0 6px 12px 0">${featured(posts[i])}</td>
          <td class="col" width="50%" valign="top" style="padding:0 0 12px 6px">${featured(posts[i + 1])}</td></tr>`).join("")}
      </table></td></tr>` : ""}

      ${blogs.length ? `${bar("From the SCP blog")}${blogs.map(blogCard).join("")}` : ""}

      <tr><td align="center" style="padding:36px 0 0">
        <a href="${SITE}/content-library.html" style="display:inline-block;padding:14px 26px;border-radius:100px;background:#f0b84a;color:#121b33;font-weight:700;font-size:15px;text-decoration:none">Explore the Content Library</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Social icons -->
  ${socials.length ? `<tr><td align="center" style="padding:30px 20px 4px">
    <p style="margin:0 0 14px;color:#ffffff;font-size:15px;font-weight:700">Follow SCP</p>
    ${socials.map(([name, url]) => `<a href="${esc(url)}" style="display:inline-block;margin:0 7px;text-decoration:none"><img src="${SITE}/assets/email/social-${name.toLowerCase()}.png" width="44" height="44" alt="${esc(name)}" style="display:block;border:0"></a>`).join("")}
  </td></tr>` : ""}

  <tr><td class="pad" style="padding:20px 32px;color:#6f7d95;font-size:12px;line-height:1.6" align="center">
    You're receiving this because you subscribed at sportscontentplaybook.com.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8b98ae">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// HTML for the weekly SCP newsletter — premium editorial layout (email-safe: tables + inline styles).
// Header image + issue · intro · 01 Social News · 02 Featured content (2 × 2) · 03 From the blog · gold CTA · footer icons.
// Email clients block embeds (iframes / scripts), so posts are shown as their cover image linked to the post.
// Resend placeholders: {{{contact.first_name|there}}} and {{{RESEND_UNSUBSCRIBE_URL}}}.
export const SITE = "https://sportscontentplaybook.com";
// Social profiles in the footer (empty = hidden)
export const SOCIAL = {
  Instagram: "",
  TikTok: "",
  LinkedIn: "https://www.linkedin.com/company/sportscontentplaybook",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b style="color:#ffffff;font-weight:700">$1</b>'); // **bold** → <b>
const SANS = "font-family:'Host Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY = "font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
const PLATFORM = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp", pinterest: "Pinterest", threads: "Threads", ai: "AI", other: "Industry" };

const GOLD = "#f0b84a";
const space = (h) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</td></tr>`;

// Section opener: number + eyebrow, big title, short gold rule
function heading(num, eyebrow, title, sub = "") {
  return `<tr><td style="padding:0 0 22px">
    <p style="margin:0;${SANS};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${GOLD}">${num}&nbsp;&nbsp;·&nbsp;&nbsp;${eyebrow}</p>
    <p style="margin:10px 0 0;${SANS};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.5px;color:#ffffff">${title}</p>
    ${sub ? `<p style="margin:8px 0 0;${BODY};font-size:14px;line-height:1.55;color:#8b98ae">${sub}</p>` : ""}
    <div style="margin-top:16px;width:44px;height:3px;background:${GOLD};border-radius:3px;line-height:3px;font-size:0">&nbsp;</div>
  </td></tr>`;
}
// A section is its own card
const section = (bg, inner) => `<tr><td class="pad" style="padding:36px 36px 38px;background:${bg};border-radius:24px;border:1px solid rgba(255,255,255,0.07)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table></td></tr>${space(18)}`;

function featured(p) {
  if (!p) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121b33;border-radius:18px;border:1px solid rgba(240,184,74,0.18)">
    <tr><td style="padding:10px 10px 0">
      ${p.image ? `<a href="${esc(p.url)}"><img src="${esc(p.image)}" width="236" alt="${esc(p.who)} on Instagram" style="display:block;width:100%;max-width:236px;height:auto;border-radius:12px;border:0"></a>` : ""}
    </td></tr>
    <tr><td style="padding:14px 14px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:rgba(240,184,74,0.14);border-radius:100px;padding:4px 10px;${SANS};font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${GOLD}">${p.reel ? "&#9654;&nbsp;" : ""}${esc(p.format || "Post")}</td></tr></table>
      <p style="margin:10px 0 0;${SANS};font-size:16px;font-weight:700;line-height:1.3;color:#ffffff">${esc(p.who)}</p>
      ${p.sport ? `<p style="margin:2px 0 0;${BODY};font-size:12px;color:#8b98ae">${esc(p.sport)}</p>` : ""}
      <p style="margin:10px 0 0;${BODY};font-size:13px;line-height:1.6;color:#b4c0d3">${rich(p.description)}</p>
      <p style="margin:12px 0 0;${BODY};font-size:13px"><a href="${esc(p.url)}" style="color:${GOLD};font-weight:700;text-decoration:none">${p.reel ? "Watch it" : "See the post"} &rarr;</a>${p.analysis ? `&nbsp;&nbsp;<a href="${esc(p.analysis)}" style="color:#8b98ae;text-decoration:none">Breakdown</a>` : ""}</p>
    </td></tr></table>`;
}

function blogLead(b) {
  return `<tr><td>
    <a href="${esc(b.link)}"><img src="${esc(b.image)}" width="528" alt="${esc(b.title)}" style="display:block;width:100%;max-width:528px;height:auto;border-radius:16px;border:0"></a>
    <p style="margin:18px 0 0;${SANS};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD}">${esc(b.type)}&nbsp;&nbsp;<span style="color:#56647e">·</span>&nbsp;&nbsp;<span style="color:#8b98ae">${esc(b.date)}</span></p>
    <a href="${esc(b.link)}" style="display:block;margin-top:8px;${SANS};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:#ffffff;text-decoration:none">${esc(b.title)}</a>
    ${b.teaser.map((p) => `<p style="margin:12px 0 0;${BODY};font-size:15px;line-height:1.7;color:#b4c0d3">${rich(p)}</p>`).join("")}
    <p style="margin:18px 0 0"><a href="${esc(b.link)}" style="display:inline-block;padding:12px 22px;border-radius:100px;border:1px solid rgba(240,184,74,0.55);${SANS};font-size:14px;font-weight:700;color:${GOLD};text-decoration:none">Read the article &rarr;</a></p>
  </td></tr>`;
}
function blogRow(b) {
  return `<tr><td style="padding-top:22px;border-top:1px solid rgba(255,255,255,0.08)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="col" width="168" valign="top" style="padding:0 18px 0 0"><a href="${esc(b.link)}"><img src="${esc(b.image)}" width="168" alt="${esc(b.title)}" style="display:block;width:100%;max-width:168px;height:auto;border-radius:12px;border:0"></a></td>
      <td class="col" valign="top">
        <p style="margin:0;${SANS};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD}">${esc(b.type)}</p>
        <a href="${esc(b.link)}" style="display:block;margin-top:6px;${SANS};font-size:17px;line-height:1.3;font-weight:700;color:#ffffff;text-decoration:none">${esc(b.title)}</a>
        <p style="margin:8px 0 0;${BODY};font-size:13px;line-height:1.6;color:#b4c0d3">${rich(b.teaser[0] || "")}</p>
        <p style="margin:8px 0 0;${BODY};font-size:13px"><a href="${esc(b.link)}" style="color:${GOLD};font-weight:700;text-decoration:none">Read &rarr;</a></p>
      </td>
    </tr></table>
  </td></tr>${space(22)}`;
}

export function renderWeekly({ subject, preheader, intro, topStory, news, posts = [], blogs, dateLabel, issue }) {
  const socials = Object.entries(SOCIAL).filter(([, url]) => url);
  const [lead, ...more] = blogs;
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  @media (max-width:600px){
    .pad{padding-left:22px!important;padding-right:22px!important}
    .col{display:block!important;width:100%!important;padding:0 0 14px 0!important}
    .hero-title{font-size:28px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:#0b1122">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1122"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <!-- Top bar -->
  <tr><td style="padding:0 6px 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="${BODY};font-size:12px;color:#6f7d95">The weekly playbook for sports social teams</td>
      <td align="right" style="${BODY};font-size:12px"><a href="${SITE}" style="color:#8b98ae;text-decoration:none">sportscontentplaybook.com</a></td>
    </tr></table>
  </td></tr>

  <!-- Hero -->
  <tr><td style="background:#121b33;border-radius:24px;border:1px solid rgba(240,184,74,0.35);overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td><a href="${SITE}"><img src="${SITE}/assets/email/header.jpg" width="600" alt="Sports Content Playbook" style="display:block;width:100%;max-width:600px;height:auto;border-radius:24px 24px 0 0;border:0"></a></td></tr>
      <tr><td class="pad" align="center" style="padding:6px 40px 36px">
        <img src="${SITE}/assets/icon-logo-lg.png" width="40" height="40" alt="" style="display:block;margin:0 auto 14px;border:0">
        <p style="margin:0;${SANS};font-size:12px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:${GOLD}">${issue ? `Issue #${esc(issue)}&nbsp;&nbsp;·&nbsp;&nbsp;` : ""}${esc(dateLabel)}</p>
        <p class="hero-title" style="margin:12px 0 0;${SANS};font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-0.8px;color:#ffffff">${esc(subject)}</p>
        <p style="margin:18px 0 0;${BODY};font-size:16px;line-height:1.7;color:#c9d2e0">Hi {{{contact.first_name|there}}}, welcome to this week's SCP. ${rich(intro)}</p>
      </td></tr>
    </table>
  </td></tr>
  ${space(18)}

  ${topStory || news.length ? section("#17213b", `
    ${heading(num(), "Social News", "This week on SCP", "What changed in sports digital marketing, and what it means for your club.")}
    ${topStory ? `<tr><td style="padding:0 0 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121b33;border-radius:16px;border-left:4px solid ${GOLD}">
        <tr><td style="padding:20px 22px">
          <p style="margin:0;${SANS};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD}">Top story${topStory.platform ? `&nbsp;&nbsp;<span style="color:#56647e">·</span>&nbsp;&nbsp;<span style="color:#8b98ae">${esc(PLATFORM[topStory.platform] || "")}</span>` : ""}</p>
          <a href="${esc(topStory.link)}" style="display:block;margin-top:8px;${SANS};font-size:20px;line-height:1.3;font-weight:700;color:#ffffff;text-decoration:none">${esc(topStory.title)}</a>
          <p style="margin:10px 0 0;${BODY};font-size:14px;line-height:1.65;color:#b4c0d3">${rich(topStory.take)}</p>
          <p style="margin:12px 0 0;${BODY};font-size:13px"><a href="${esc(topStory.link)}" style="color:${GOLD};font-weight:700;text-decoration:none">Read the story &rarr;</a></p>
        </td></tr></table>
    </td></tr>` : ""}
    ${news.length ? `<tr><td style="padding:18px 0 0">
      <p style="margin:0 0 6px;${SANS};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8b98ae">Also this week</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${news.map((item, i) => `<tr><td style="padding:14px 0;${i ? "border-top:1px solid rgba(255,255,255,0.07);" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="34" valign="top" style="${SANS};font-size:15px;font-weight:700;color:${GOLD}">${String(i + 1).padStart(2, "0")}</td>
          <td valign="top">
            <a href="${esc(item.link)}" style="${SANS};font-size:15px;line-height:1.4;font-weight:700;color:#ffffff;text-decoration:none">${esc(item.title)}</a>
            ${item.platform ? `<p style="margin:4px 0 0;${BODY};font-size:12px;color:#8b98ae">${esc(PLATFORM[item.platform] || "")}</p>` : ""}
          </td>
          <td width="24" align="right" valign="top"><a href="${esc(item.link)}" style="color:${GOLD};font-size:16px;text-decoration:none">&rarr;</a></td>
        </tr></table>
      </td></tr>`).join("")}
      </table></td></tr>` : ""}
  `) : ""}

  ${posts.length ? section("#1a2542", `
    ${heading(num(), "Featured content", "Posts worth stealing this week", "Hand-picked from the SCP Content Library, with why they work.")}
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[0, 2].filter((i) => posts[i]).map((i) => `<tr>
        <td class="col" width="50%" valign="top" style="padding:0 7px 14px 0">${featured(posts[i])}</td>
        <td class="col" width="50%" valign="top" style="padding:0 0 14px 7px">${featured(posts[i + 1])}</td></tr>`).join("")}
    </table></td></tr>
  `) : ""}

  ${lead ? section("#17213b", `
    ${heading(num(), "From the blog", "Read this week")}
    ${blogLead(lead)}
    ${more.length ? `${space(26)}${more.map(blogRow).join("")}` : ""}
  `) : ""}

  <!-- CTA -->
  <tr><td class="pad" align="center" style="padding:38px 36px;border-radius:24px;background:${GOLD};background-image:linear-gradient(135deg,#ffe0a0 0%,#f8cc75 45%,#f0b84a 100%)">
    <p style="margin:0;${SANS};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5c4512">Sports Content Playbook</p>
    <p style="margin:10px 0 0;${SANS};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.5px;color:#121b33">Your next idea is already in the library</p>
    <p style="margin:10px 0 0;${BODY};font-size:15px;line-height:1.6;color:#3d3220">Thousands of posts from clubs, leagues and brands, filtered by sport, format and competition.</p>
    <p style="margin:22px 0 0"><a href="${SITE}/content-library.html" style="display:inline-block;padding:15px 28px;border-radius:100px;background:#121b33;${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Explore the Content Library &rarr;</a></p>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:34px 20px 0">
    <img src="${SITE}/assets/icon-logo-lg.png" width="30" height="30" alt="" style="display:block;margin:0 auto 10px;border:0;opacity:0.9">
    <p style="margin:0;${SANS};font-size:15px;font-weight:700;color:#ffffff">Sports Content Playbook</p>
    ${socials.length ? `<p style="margin:16px 0 0">${socials.map(([name, url]) => `<a href="${esc(url)}" style="display:inline-block;margin:0 6px;text-decoration:none"><img src="${SITE}/assets/email/social-${name.toLowerCase()}.png" width="40" height="40" alt="${esc(name)}" style="display:block;border:0"></a>`).join("")}</p>` : ""}
    <p style="margin:20px 0 0;${BODY};font-size:12px;line-height:1.7;color:#6f7d95">You're receiving this because you subscribed at sportscontentplaybook.com.<br>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8b98ae">Unsubscribe</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${SITE}" style="color:#8b98ae">Visit the website</a></p>
  </td></tr>

</table></td></tr></table></body></html>`;
}

// Cover image of a news article (its og:image / twitter:image), handed to save(buf, ext, type) so the newsletter can serve it from our own
// bucket instead of hotlinking the publisher. Returns whatever save() returns, or null when the page has no usable image.
const OK = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const meta = (html, name) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!new RegExp(`(?:property|name)=["']${name}["']`, "i").test(m[0])) continue;
    const c = m[0].match(/content=["']([^"']+)["']/i);
    if (c) return c[1].replace(/&amp;/g, "&");
  }
  return null;
};
export async function articleImage(pageUrl, save) {
  try {
    const opt = { signal: AbortSignal.timeout(15000), redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", accept: "text/html,application/xhtml+xml", "accept-language": "en" } }; // some publishers answer 403 to anything that looks like a bot
    const html = await (await fetch(pageUrl, opt)).text();
    let img = meta(html, "og:image") || meta(html, "twitter:image");
    if (!img) return null;
    img = new URL(img, pageUrl).href;
    if (img.includes("/cdn-cgi/image/")) img = img.replace("/cdn-cgi/image/", "/cdn-cgi/image/format=jpeg,"); // Beehiiv serves GIFs: ask for a JPEG
    const r = await fetch(img, { ...opt, headers: { ...opt.headers, accept: "image/webp,image/jpeg,image/png" } });
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok || !OK[type] || buf.length > 4_000_000) return null;
    return await save(buf, OK[type], type);
  } catch { return null; }
}

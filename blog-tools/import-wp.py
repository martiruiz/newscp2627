#!/usr/bin/env python3
"""Bring the old WordPress blog (sportscontentplaybook.com, Elementor) over to the new blog.

Reads the public WordPress API (no login), and for every post:
  - keeps the text (paragraphs, headings, lists, links, bold) and drops Elementor's wrappers and styles
  - turns Instagram / TikTok / YouTube embeds into the new blog's embed markers (<div class="embed" data-embed="URL">)
  - downloads the cover and the images in the text to assets/blog/ (the old domain will point to the new site)
  - writes the post as the new blog's JSON, marked "legacy": true (blog-tools/build.mjs then skips the SEO rules of
    new articles for it) with "wp_url", the old address, for the redirects

Output: mockups/wp-import.json ([{slug, data}], to insert into blog_posts from Admin) — nothing is written to the database.
    python3 blog-tools/import-wp.py
"""
import html
import json
import os
import re
import urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WP = "https://sportscontentplaybook.com"
UA = {"User-Agent": "SCP-blog-import/1.0 (moving our own WordPress blog to the new site)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def save_image(url, name):
    """Download an image to assets/blog/<name>.<ext> (once); returns the file name or None."""
    url = html.unescape(url)
    if url.startswith("//"):
        url = "https:" + url
    ext = (re.search(r"\.(jpe?g|png|webp|gif)(?:\?|$)", url, re.I) or [None, "jpg"])[1].lower().replace("jpeg", "jpg")
    file = f"{name}.{ext}"
    path = os.path.join(ROOT, "assets/blog", file)
    if not os.path.exists(path):
        try:
            data = get(url)
        except Exception as e:  # a broken image in the old post: left out
            print(f"   ! image not downloaded ({e}): {url}")
            return None
        with open(path, "wb") as f:
            f.write(data)
    return file


def embed_url(url):
    """The post's address as the new blog's embed parser expects it, or None."""
    url = html.unescape(url or "").split("?")[0]
    if url.startswith("//"):
        url = "https:" + url
    if re.search(r"instagram\.com/(?:[\w.]+/)?(p|reel|tv)/[\w-]+", url):
        return url if url.endswith("/") else url + "/"
    if re.search(r"tiktok\.com/@[\w.-]+/video/\d+", url):
        return url
    m = re.search(r"youtube(?:-nocookie)?\.com/embed/([\w-]{11})", url) or re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})", url)
    if m:
        return f"https://www.youtube.com/watch?v={m.group(1)}"
    m = re.search(r"youtube\.com/shorts/([\w-]{11})", url)
    if m:
        return f"https://www.youtube.com/shorts/{m.group(1)}"
    return None


KEEP = {"p", "h2", "h3", "ul", "ol", "li", "a", "strong", "b", "em", "i", "br", "blockquote"}
RENAME = {"h1": "h2", "h4": "h3", "h5": "h3", "h6": "h3"}
SKIP = {"script", "style", "noscript", "svg", "button", "form", "iframe", "video"}


class Clean(HTMLParser):
    """Rebuilds the post's HTML with plain tags only; embeds and images become the new blog's markup."""

    def __init__(self, slug):
        super().__init__(convert_charrefs=True)
        self.slug, self.out, self.skip, self.embed_depth, self.n_img = slug, [], 0, 0, 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        if self.embed_depth:  # inside an Instagram / TikTok blockquote: everything in it is replaced by the marker
            if tag == "blockquote":
                self.embed_depth += 1
            return
        if tag == "blockquote" and ("instagram-media" in cls or "tiktok-embed" in cls):
            url = embed_url(a.get("data-instgrm-permalink") or a.get("cite"))
            if url:
                self.out.append(f'<div class="embed" data-embed="{url}"></div>')
            self.embed_depth = 1
            return
        if tag == "iframe":
            url = embed_url(a.get("src"))
            if url:
                self.out.append(f'<div class="embed" data-embed="{url}"></div>')
            return
        if "elementor-widget-video" in cls and a.get("data-settings"):  # Elementor's YouTube widget
            try:
                url = embed_url(json.loads(html.unescape(a["data-settings"])).get("youtube_url"))
            except Exception:
                url = None
            if url:
                self.out.append(f'<div class="embed" data-embed="{url}"></div>')
        if tag in SKIP:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "img":
            src = a.get("src") or a.get("data-src") or ""
            if not src or src.startswith("data:"):
                return
            self.n_img += 1
            file = save_image(src, f"wp-{self.slug}-{self.n_img}")
            if file:
                alt = html.escape(a.get("alt") or "", quote=True)
                self.out.append(f'<figure class="post-img"><img src="assets/blog/{file}" alt="{alt}" loading="lazy"></figure>')
            return
        tag = RENAME.get(tag, tag)
        if tag not in KEEP:
            return
        if tag == "a":
            href = a.get("href") or ""
            if not href or href.startswith("#") or href.startswith("javascript"):
                self.stack.append(None)
                return
            href = re.sub(r"^https?://(www\.)?sportscontentplaybook\.com/?", "", href) or "index.html"
            ext = "" if not href.startswith("http") else ' target="_blank" rel="noopener"'
            self.out.append(f'<a href="{html.escape(href, quote=True)}"{ext}>')
            self.stack.append("a")
            return
        self.out.append(f"<{tag}>" if tag != "br" else "<br>")

    def handle_endtag(self, tag):
        if self.embed_depth:
            if tag == "blockquote":
                self.embed_depth -= 1
            return
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        tag = RENAME.get(tag, tag)
        if tag == "a":
            if self.stack and self.stack.pop() == "a":
                self.out.append("</a>")
            return
        if tag in KEEP and tag != "br":
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.skip and not self.embed_depth:
            self.out.append(html.escape(data, quote=False))

    def result(self):
        h = "".join(self.out)
        h = re.sub(r"\s+", " ", h)
        for _ in range(3):  # empty paragraphs / headings / list items left by the page builder
            h = re.sub(r"<(p|h2|h3|li|strong|em|b|i)>(\s|&nbsp;| |<br>)*</\1>", "", h)
        h = re.sub(r"\s*(<(?:/?(?:p|h2|h3|ul|ol|li|figure|blockquote)|div class=\"embed\")[^>]*>)\s*", r"\1", h)
        h = h.replace("<p><div", "<div").replace("</div></p>", "</div>")
        h = re.sub(r"(</(?:p|h2|h3|ul|ol|figure|blockquote)>|</div>)", r"\1\n", h)
        return h.strip()


def plain(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def cut(t, n):
    return t if len(t) <= n else re.sub(r"\s+\S*$", "", t[: n - 1]) + "…"


def kind(title, cats):
    t = title.lower()
    if {"Guides", "Resources"} & set(cats) or re.search(r"\bideas?\b|how to|guide|tips", t):
        return "ideas"
    if re.search(r"\bnews\b|launch|update|new feature|announc", t):
        return "news"
    return "trends"  # most of the old posts analyse what clubs and brands did


def main():
    cats = {c["id"]: c["name"] for c in json.loads(get(f"{WP}/wp-json/wp/v2/categories?per_page=100"))}
    posts = json.loads(get(f"{WP}/wp-json/wp/v2/posts?per_page=100&_embed=1&status=publish"))
    existing = {f[:-5] for f in os.listdir(os.path.join(ROOT, "content/blog")) if f.endswith(".json")}
    out = []
    for p in posts:
        slug = re.sub(r"[^a-z0-9]+", "-", html.unescape(p["slug"]).lower()).strip("-")
        title = plain(p["title"]["rendered"])
        if re.fullmatch(r"elementor-\d+", slug):  # Elementor's default address: one from the title (the old one stays in wp_url)
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower().encode("ascii", "ignore").decode()).strip("-")[:90].rstrip("-")
        if slug in existing:
            print(f"   = {slug} already on the new blog, skipped")
            continue
        c = Clean(slug)
        c.feed(p["content"]["rendered"])
        body = c.result()
        ex = plain(p.get("excerpt", {}).get("rendered", "")) or plain(re.search(r"<p>(.*?)</p>", body).group(1) if "<p>" in body else body)
        ex = re.sub(r"\s*(Read more|Leer más|\[…\]|\[&hellip;\]).*$", "", ex)
        yo = p.get("yoast_head_json") or {}
        mtitle = re.sub(r"\s*[–—-]\s*Sports Content Playbook\s*$", "", plain(yo.get("title") or "")) or title
        fm = ((p.get("_embedded") or {}).get("wp:featuredmedia") or [{}])[0] or {}
        og = ((yo.get("og_image") or [{}])[0] or {}).get("url")   # the image the post shares on social media
        cover = save_image(fm["source_url"], slug) if fm.get("source_url") else (save_image(og, slug) if og else None)
        if not cover:  # no cover in WordPress: the first image of the text
            m = re.search(r'src="assets/blog/([^"]+)"', body)
            cover = m.group(1) if m else None
        author = (((p.get("_embedded") or {}).get("author") or [{}])[0] or {}).get("name") or "Martí Ruiz"
        data = {
            "slug": slug, "type": kind(title, [cats.get(i, "") for i in p.get("categories", [])]), "date": p["date"][:10],
            "author": author, "title": title, "meta_title": cut(mtitle, 65), "meta_description": cut(plain(yo.get("description") or "") or ex, 160),
            "excerpt": cut(ex, 260), "primary_keyword": "", "keywords": [], "body_html": body,
            "image": {"file": cover, "alt": plain(fm.get("alt_text") or "") or title, "title": title,
                      "credit": {"author": "Sports Content Playbook", "source_url": p["link"]}} if cover else {},
            "faq": [], "takeaways": [], "sources": [], "references": [],
            "legacy": True, "wp_url": p["link"],
        }
        out.append({"slug": slug, "data": data})
        n = {k: len(re.findall(f'data-embed="https://www.{k}', body)) for k in ("instagram", "tiktok", "youtube")}
        print(f"   ✓ {slug} · {len(plain(body).split())} words · {data['type']} · cover: {cover or 'NONE'} · embeds {n} · images {c.n_img}")
    with open(os.path.join(ROOT, "mockups/wp-import.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"\n{len(out)} posts ready in mockups/wp-import.json")


if __name__ == "__main__":
    main()

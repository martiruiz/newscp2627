#!/usr/bin/env python3
"""Find a real photo for a blog cover on Wikimedia Commons (free licences, credited under the cover).

Usage:
  python3 blog-tools/commons.py "<search>" [--json]          prints the best match (or nothing)
  python3 blog-tools/commons.py --post content/blog/<slug>.json "<search>"
      sets image.credit in the post and writes the cover through photo.py (exit 1 when nothing fits)

A match is a landscape photo (JPEG/PNG, at least 1200 px wide) under CC BY, CC BY-SA, CC0 or public domain. The credit
keeps the author, the licence and its link, and the file page as the source.
"""
import html
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "SCPBlogBot/1.0 (https://sportscontentplaybook.com)"}
FREE = re.compile(r"^(cc[ -]by(-sa)?[ -]?[\d.]*|cc0|public domain|pd.*|attribution.*)$", re.I)


def plain(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def search(query, n=20):
    q = urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": n,
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1600, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{q}", headers=UA), timeout=30) as r:
        pages = json.load(r).get("query", {}).get("pages", {})
    out = []
    for p in sorted(pages.values(), key=lambda x: x.get("index", 99)):
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        lic = plain(m.get("LicenseShortName", {}).get("value"))
        w, h = ii.get("width", 0), ii.get("height", 0)
        if ii.get("mime") not in ("image/jpeg", "image/png") or w < 1200 or not h or w / h < 1.3 or not FREE.match(lic):
            continue
        if re.search(r"logo|map|diagram|chart|flag|coat of arms|svg|screenshot", p["title"], re.I):
            continue
        artist = plain(m.get("Artist", {}).get("value")) or "Unknown author"
        out.append({
            "image": ii.get("thumburl") or ii["url"], "title": p["title"].removeprefix("File:"),
            "credit": {"author": f"{artist[:80]} / Wikimedia Commons", "source_url": ii.get("descriptionurl"),
                       "license": lic, **({"license_url": m["LicenseUrl"]["value"]} if m.get("LicenseUrl") else {})},
        })
    return out


def main():
    args = sys.argv[1:]
    if args[:1] == ["--post"]:
        post_path, query = args[1], args[2]
        hits = search(query)
        if not hits:
            sys.exit(1)
        best = hits[0]
        post = json.loads(Path(post_path).read_text())
        post["image"]["credit"] = best["credit"]
        Path(post_path).write_text(json.dumps(post, indent=2, ensure_ascii=False) + "\n")
        subprocess.run([sys.executable, str(ROOT / "blog-tools/photo.py"), post_path, best["image"]], check=True)
        print(f"{post['slug']}: {best['title']} ({best['credit']['license']})")
        return
    hits = search(args[0])
    print(json.dumps(hits[:5] if "--json" in args else (hits[:1] or None), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

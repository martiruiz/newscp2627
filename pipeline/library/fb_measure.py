#!/usr/bin/env python3
"""Real height of each Facebook post's embed at Facebook's 500 px width (header, text, pictures, counts), so the Content
Library's Facebook cards take the post's exact size (js/library.js; supabase/fb-embed-height.sql). Newest first, only
posts not measured yet; 0 = could not be measured (the card keeps its estimate). A post without a cover also gets one:
its biggest picture as the browser shows it, copied to Storage (bucket "covers", like covers.mjs), with its shape —
Facebook's plugin page only shows album pictures to a real browser, so covers.mjs finds none for them.

  cd pipeline && python3 library/fb_measure.py [--limit 500] [--workers 4]

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or pipeline/.env) and Playwright with Chromium.
"""
import asyncio
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

for line in (Path(__file__).resolve().parent.parent / ".env").read_text().splitlines() if (Path(__file__).resolve().parent.parent / ".env").exists() else []:
    m = re.match(r"^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)\s*$", line)
    if m and not line.strip().startswith("#"):
        os.environ.setdefault(m[1], re.sub(r"^(['\"])(.*)\1$", r"\2", m[2]))
BASE, KEY = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
arg = lambda k, d: int(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
LIMIT, WORKERS = arg("--limit", 10**9), arg("--workers", 4)


def rest(path, body=None, method=None, tries=4):
    for k in range(tries):   # a passing database or network hiccup: try again a little later
        try:
            return rest_once(path, body, method)
        except Exception:
            if k == tries - 1:
                raise
            __import__("time").sleep(5 * (k + 1))


def rest_once(path, body=None, method=None):
    req = urllib.request.Request(f"{BASE}/rest/v1/{path}", data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read()
        return json.loads(t) if t else None


def store(id_, data, ctype):   # same place and name as covers.mjs storeCover
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(ctype)
    if not ext:
        return None
    path = f"{id_ // 1000}/{id_}.{ext}"
    req = urllib.request.Request(f"{BASE}/storage/v1/object/covers/{path}", data=data, method="POST", headers={
        "apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": ctype, "x-upsert": "true", "cache-control": "max-age=31536000"})
    urllib.request.urlopen(req, timeout=60).read()
    return f"{BASE}/storage/v1/object/public/covers/{path}"


def src(url):   # the same embed the library shows (js/library.js previewSrc)
    kind = "video" if re.search(r"/(reel|videos?)/", url) else "post"
    return f"https://www.facebook.com/plugins/{kind}.php?href={urllib.parse.quote(url, safe='')}&show_text=false&width=500"


# the post's biggest picture (not the page's profile picture /t39.30808-1/, nor Facebook's own icons)
BIGGEST = """[...document.images, ...[...document.querySelectorAll('video[poster]')].map(v => ({ src: v.poster, naturalWidth: v.clientWidth, naturalHeight: v.clientHeight }))]
  .filter(i => /^https:\\/\\/scontent/.test(i.src) && !/\\/t39\\.30808-1\\//.test(i.src) && i.naturalWidth >= 200)
  .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)[0]?.src || null"""


GONE = """![...document.images].some(i => /^https:\\/\\/scontent/.test(i.src)) && /no longer available|isn.t available|ya no est. disponible|no est. disponible|n.est plus disponible|non . pi. disponibile|n.o est. mais dispon.vel|nicht mehr verf.gbar/i.test(document.body.innerText)"""


async def measure(ctx, row):
    url, pg = row["url"] or "", await ctx.new_page()
    try:
        await pg.goto(src(url), wait_until="domcontentloaded", timeout=20000)
        await pg.wait_for_timeout(1500)
        # removed or made private: Facebook's "this post is no longer available" box (any language) instead of the post
        if await pg.evaluate(GONE):
            return -1, None
        h = await pg.evaluate("Math.max(0, ...[...document.body.querySelectorAll('*')].map(e => e.getBoundingClientRect().bottom))")
        cover = None
        if not row.get("cover_url"):
            img = await pg.evaluate(BIGGEST)
            if img:
                r = await pg.request.get(img)
                if r.ok:
                    cover = (await r.body(), (r.headers.get("content-type") or "image/jpeg").split(";")[0])
        return max(0, min(4000, round(h))), cover
    except Exception:
        return 0, None
    finally:
        await pg.close()


def image_size(b):   # JPEG / PNG / WebP width and height from the bytes
    import struct
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", b[16:24])
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        if b[12:16] == b"VP8X":
            return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
        if b[12:16] == b"VP8 ":
            return struct.unpack("<HH", b[26:30])[0] & 0x3FFF, struct.unpack("<HH", b[26:30])[1] & 0x3FFF
        return None
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            i += 1
            continue
        mk, ln = b[i + 1], struct.unpack(">H", b[i + 2:i + 4])[0]
        if mk in (0xC0, 0xC1, 0xC2):
            hh, ww = struct.unpack(">HH", b[i + 5:i + 9])
            return ww, hh
        i += 2 + ln
    return None


async def main():
    done = covers = gone = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 500, "height": 900}, locale="en-US")
        while done < LIMIT:
            rows = rest("content_ideas?select=id,url,cover_url,external_id&account_platform=eq.facebook&embed_h=is.null&unavailable_at=is.null"
                        f"&order=published_at.desc.nullslast&limit={min(48, LIMIT - done)}")
            if not rows:
                break
            out, shapes = [], []
            for k in range(0, len(rows), WORKERS):
                part = rows[k:k + WORKERS]
                res = await asyncio.gather(*(measure(ctx, r) for r in part))
                for r, (h, cover) in zip(part, res):
                    if h < 0:   # no longer on Facebook: flagged (gone_at, via the trigger) and hidden from the library (content_hidden)
                        rest(f"content_ideas?id=eq.{r['id']}", {"unavailable_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}, "PATCH")
                        if r.get("external_id"):
                            try:
                                rest("content_hidden?on_conflict=external_id", {"external_id": r["external_id"]}, "POST")
                            except Exception:
                                pass
                        gone += 1
                        h = 0
                    out.append({"id": r["id"], "h": h})
                    url = None
                    try:
                        url = cover and store(r["id"], *cover)
                    except Exception:
                        pass
                    if url:
                        video = bool(re.search(r"/(reel|videos?)/", r["url"] or ""))
                        rest(f"content_ideas?id=eq.{r['id']}", {"cover_url": url, "cover_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), "media_type": "video" if video else "image"}, "PATCH")
                        size = image_size(cover[0])
                        if size:
                            shapes.append({"id": r["id"], "width": size[0], "height": size[1]})
                        covers += 1
            if shapes:
                rest("rpc/apply_media_shape", {"p_rows": shapes})
            rest("rpc/apply_fb_embed_h", {"p_rows": out})
            done += len(out)
            print(f"{done} measured · {covers} new covers · {gone} removed from Facebook · {sum(1 for o in out if not o['h'])} failed in this batch", flush=True)
        await browser.close()
    print(f"Done: {done} Facebook embeds measured.")


asyncio.run(main())

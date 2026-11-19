#!/usr/bin/env python3
"""Real height of each Facebook post's embed at Facebook's 500 px width (header, text, pictures, counts), so the Content
Library's Facebook cards take the post's exact size (js/library.js; supabase/fb-embed-height.sql). Newest first, only
posts not measured yet; 0 = could not be measured (the card keeps its estimate).

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


def rest(path, body=None):
    req = urllib.request.Request(f"{BASE}/rest/v1/{path}", data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def src(url):   # the same embed the library shows (js/library.js previewSrc)
    kind = "video" if re.search(r"/(reel|videos?)/", url) else "post"
    return f"https://www.facebook.com/plugins/{kind}.php?href={urllib.parse.quote(url, safe='')}&show_text=false&width=500"


async def measure(ctx, url):
    pg = await ctx.new_page()
    try:
        await pg.goto(src(url), wait_until="load", timeout=30000)
        await pg.wait_for_timeout(1200)
        h = await pg.evaluate("Math.max(0, ...[...document.body.querySelectorAll('*')].map(e => e.getBoundingClientRect().bottom))")
        return max(0, min(4000, round(h)))
    except Exception:
        return 0
    finally:
        await pg.close()


async def main():
    done = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 500, "height": 900}, locale="en-US")
        while done < LIMIT:
            rows = rest("content_ideas?select=id,url&account_platform=eq.facebook&embed_h=is.null&unavailable_at=is.null"
                        f"&order=published_at.desc.nullslast&limit={min(200, LIMIT - done)}")
            if not rows:
                break
            out = []
            for k in range(0, len(rows), WORKERS):
                part = rows[k:k + WORKERS]
                hs = await asyncio.gather(*(measure(ctx, r["url"] or "") for r in part))
                out += [{"id": r["id"], "h": h} for r, h in zip(part, hs)]
            rest("rpc/apply_fb_embed_h", {"p_rows": out})
            done += len(out)
            print(f"{done} measured · {sum(1 for o in out if not o['h'])} failed in this batch", flush=True)
        await browser.close()
    print(f"Done: {done} Facebook embeds measured.")


asyncio.run(main())

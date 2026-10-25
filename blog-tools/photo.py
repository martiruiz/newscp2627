#!/usr/bin/env python3
"""Turn a photo (article, news or stock) into the blog cover (1200x630 JPEG) with SEO metadata in EXIF.

Usage:
  python3 blog-tools/photo.py content/blog/<slug>.json <image-url-or-local-path> [--brand]
  --brand adds the Sports Content Playbook badge (use it on AI-generated covers)

The post JSON must have image.file, image.alt, image.title and image.credit
({ "author", "source_url", optional "license", "license_url" }). The photo source is
always shown under the cover. Prefer the article's own photo or a current news photo;
"author" is the photographer and/or outlet (e.g. "Marca / Getty Images").
"""
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cover import exif_for  # noqa: E402  (same SEO metadata as branded covers)

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630


def load(src):
    if src.startswith("http"):
        req = urllib.request.Request(src, headers={"User-Agent": "SCPBlogBot/1.0 (https://sportscontentplaybook.com)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return Image.open(io.BytesIO(r.read()))
    return Image.open(src)


def add_brand(cover):
    """SCP badge (logo + name) in the top-left corner."""
    from PIL import ImageDraw, ImageFont
    logo = Image.open(ROOT / "assets" / "icon-logo-lg.png").convert("RGBA")
    logo.thumbnail((44, 42))
    font = ImageFont.truetype(str(ROOT / "blog-tools" / "fonts" / "HostGrotesk.ttf"), 24)
    try:
        font.set_variation_by_name("Bold")
    except Exception:
        pass
    text = "Sports Content Playbook"
    d = ImageDraw.Draw(cover, "RGBA")
    tw = d.textlength(text, font=font)
    x, y, pad = 32, 30, 14
    w, h = pad + logo.width + 12 + tw + pad + 6, 64
    d.rounded_rectangle((x, y, x + w, y + h), radius=32, fill=(18, 27, 51, 215), outline=(240, 184, 74, 160), width=2)
    cover.paste(logo, (x + pad, y + (h - logo.height) // 2), logo)
    d.text((x + pad + logo.width + 12, y + 17), text, font=font, fill=(255, 255, 255))


def main(post_path, src):
    post = json.loads(Path(post_path).read_text())
    credit = post.get("image", {}).get("credit") or {}
    missing = [k for k in ("author", "source_url") if not credit.get(k)]
    if missing:
        sys.exit(f"image.credit is missing: {', '.join(missing)}")
    img = ImageOps.exif_transpose(load(src)).convert("RGB")
    if img.width < 1000:
        print(f"warning: source is only {img.width}px wide, the cover may look soft")
    cover = ImageOps.fit(img, (W, H), method=Image.LANCZOS, centering=(0.5, 0.45))
    if "--brand" in sys.argv:
        add_brand(cover)
    out = ROOT / "assets" / "blog" / post["image"]["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    cover.save(out, "JPEG", quality=86, optimize=True, progressive=True, exif=exif_for(post))
    print(f"photo cover → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1])

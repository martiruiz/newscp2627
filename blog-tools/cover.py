#!/usr/bin/env python3
"""Generate a branded 1200x630 blog cover (JPEG) with SEO metadata embedded in EXIF.

Usage:
  python3 blog-tools/cover.py content/blog/<slug>.json

Reads title, type, primary_keyword, keywords and image.{file,alt,title} from the post JSON
and writes assets/blog/<image.file>.
"""
import json
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "blog-tools" / "fonts"
W, H = 1200, 630
BG = (18, 27, 51)
SURFACE = (23, 33, 59)
GOLD = (240, 184, 74)
WHITE = (255, 255, 255)
MUTED = (180, 192, 211)

TYPE_LABELS = {"news": "NEWS & UPDATES", "trends": "SOCIAL MEDIA TRENDS", "ideas": "SPORTS CONTENT IDEAS"}


def font(name, size, weight):
    f = ImageFont.truetype(str(FONTS / name), size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def wrap(draw, text, fnt, max_width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=fnt) <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def build(post):
    img = Image.new("RGB", (W, H), BG)

    # soft gold glow, top right
    glow = Image.new("RGB", (W, H), BG)
    g = ImageDraw.Draw(glow)
    g.ellipse((700, -300, 1500, 400), fill=(120, 92, 40))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(160)), 0.55)

    d = ImageDraw.Draw(img)
    # card border
    d.rounded_rectangle((28, 28, W - 28, H - 28), radius=26, outline=(92, 76, 44), width=2)

    # logo + brand
    logo = ROOT / "assets" / "icon-logo-lg.png"
    brand_font = font("HostGrotesk.ttf", 30, "Bold")
    x0 = 80
    if logo.exists():
        mark = Image.open(logo).convert("RGBA").resize((52, 49))
        img.paste(mark, (x0, 74), mark)
        x0 += 68
    d.text((x0, 82), "Sports Content Playbook", font=brand_font, fill=WHITE)

    # type pill
    label = TYPE_LABELS.get(post["type"], "BLOG")
    pill_font = font("Inter.ttf", 20, "SemiBold")
    tw = d.textlength(label, font=pill_font)
    d.rounded_rectangle((80, 170, 80 + tw + 40, 210), radius=20, fill=(66, 58, 44))
    d.text((100, 178), label, font=pill_font, fill=GOLD)

    # title (shrink until it fits in 4 lines)
    size = 64
    while True:
        tf = font("HostGrotesk.ttf", size, "SemiBold")
        lines = wrap(d, post["title"], tf, W - 160)
        if len(lines) <= 4 or size <= 40:
            break
        size -= 4
    y = 240
    for i, line in enumerate(lines[:4]):
        d.text((80, y), line, font=tf, fill=WHITE)
        y += int(size * 1.12)

    # primary keyword footer
    kf = font("Inter.ttf", 22, "Medium")
    d.text((80, H - 92), post.get("primary_keyword", ""), font=kf, fill=GOLD)
    d.text((W - 80 - d.textlength("sportscontentplaybook.com", font=kf), H - 92),
           "sportscontentplaybook.com", font=kf, fill=MUTED)
    return img


def exif_for(post):
    img = post["image"]
    keywords = "; ".join(post.get("keywords", []))
    exif = Image.Exif()
    utf16 = lambda s: s.encode("utf-16le") + b"\x00\x00"
    ascii_ = lambda s: unicodedata.normalize("NFKD", s.replace("–", "-").replace("—", "-")).encode("ascii", "ignore").decode()
    exif[0x010E] = ascii_(img.get("alt", post["title"]))  # ImageDescription (ASCII)
    exif[0x013B] = "Sports Content Playbook"               # Artist
    exif[0x8298] = "(c) Sports Content Playbook"           # Copyright
    exif[0x9C9B] = utf16(img.get("title", post["title"]))  # XPTitle
    exif[0x9C9E] = utf16(keywords)                         # XPKeywords
    exif[0x9C9F] = utf16(post.get("primary_keyword", ""))  # XPSubject
    exif[0x9C9C] = utf16(post.get("meta_description", "")) # XPComment
    return exif


def main(path):
    post = json.loads(Path(path).read_text())
    out = ROOT / "assets" / "blog" / post["image"]["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    build(post).save(out, "JPEG", quality=86, optimize=True, progressive=True, exif=exif_for(post))
    print(f"cover → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

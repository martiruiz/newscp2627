"""SCP blog -> Instagram Story (1080x1920) generator.
Usage: python3 tools/social/story.py <config.json> <out_dir>
Config: {"stories":[{"file":"<out name>","tag":"..","title":"..","line":"..","cover":"assets/blog/<x>.jpg"}]}
Safe zones: keep key content out of top 250px and bottom 340px (IG UI + link sticker).
"""
import asyncio, os, sys, json, base64
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
A=R+'/assets/'
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
CSS=f'''@font-face{{font-family:HG;src:url(data:font/woff2;base64,{HG});font-weight:100 900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1920px;position:relative;overflow:hidden;font-family:HG,sans-serif;color:#fff;background:radial-gradient(1300px 1100px at 85% -5%,#22335c 0%,#121b33 55%,#0c1326 100%)}}
.abs{{position:absolute}} .cap{{font-size:24px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}} .gd{{color:#f0b84a}}'''
def page(s):
    cv=b64(os.path.join(R,s['cover']))
    fs=78 if len(s['title'])<48 else 66
    return f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:270px;height:84px">
<div class="abs cap gd" style="right:80px;top:296px">From the blog</div>
<img class="abs" src="data:image/jpeg;base64,{cv}" style="left:80px;top:440px;width:920px;height:575px;object-fit:cover;border-radius:36px;border:2px solid rgba(255,255,255,.14)">
<div class="abs cap gd" style="left:80px;top:1070px">{s['tag']}</div>
<div class="abs" style="left:80px;top:1130px;width:920px;font-size:{fs}px;font-weight:800;line-height:1.06;letter-spacing:-.03em">{s['title']}</div>
<div class="abs" style="left:80px;top:1420px;width:900px;font-size:36px;font-weight:500;line-height:1.3;color:#aab7d2">{s['line']}</div>
<div class="abs" style="left:80px;top:1560px;height:100px;padding:0 52px;border-radius:50px;background:linear-gradient(135deg,#f6c768,#e0a22f);color:#121b33;font-size:36px;font-weight:800;display:flex;align-items:center;gap:16px">Read the article <span style="font-size:40px">→</span></div>'''
async def main():
    from playwright.async_api import async_playwright
    cfg=json.load(open(sys.argv[1])); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1920})
        for s in cfg['stories']:
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body>{page(s)}'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{out}/{s['file']}.jpg",type='jpeg',quality=92)
        await b.close()
asyncio.run(main())

"""SCP Jobs -> Instagram Story (1080x1920) with the day's offers and room for the link sticker.
Usage: python3 tools/social/jobs_story.py <config.json> <logos_dir> <out.jpg>
Config: see configs/jobs-story-2026-11-02.json. Logos: download `jobs.logo_url` to <logos_dir>/<job id>.img.
Safe zones: nothing above y 250; the sticker goes in the free band y 1450-1570 (link: sportscontentplaybook.com/jobs).
"""
import asyncio, base64, html, io, json, os, sys
from PIL import Image
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
A=R+'/assets/'
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
cfg=json.load(open(sys.argv[1])); LOGOS=sys.argv[2]; OUT=sys.argv[3]; J=cfg['jobs']
def lg(i):
    im=Image.open(f'{LOGOS}/{i}.img').convert('RGB').resize((200,200),Image.LANCZOS); bio=io.BytesIO(); im.save(bio,'JPEG',quality=92); return 'data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
CSS=f'''@font-face{{font-family:HG;src:url(data:font/woff2;base64,{HG});font-weight:100 900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1920px;position:relative;overflow:hidden;font-family:HG,sans-serif;color:#fff;background:radial-gradient(1300px 1100px at 85% -5%,#22335c 0%,#121b33 55%,#0c1326 100%)}}
.abs{{position:absolute}} .cap{{font-size:24px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}} .gd{{color:#f0b84a}}
.row{{display:flex;align-items:center;gap:24px;height:86px;border-top:2px solid rgba(255,255,255,.1)}}
.row img{{width:62px;height:62px;flex:none;border-radius:16px;background:#fff;object-fit:cover}}
.row div{{min-width:0}} .t,.s{{white-space:nowrap}}
.t{{font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-.015em}} .s{{font-size:25px;font-weight:500;line-height:1.2;color:#aab7d2;margin-top:3px}} .s b{{color:#f0b84a;font-weight:600}}'''
def row(j):
    tag=f" · <b>{j['tag']}</b>" if j.get('tag') else ''
    return f'''<div class="row"><img src="{lg(j['id'])}"><div><p class="t">{html.escape(j['title'])}</p><p class="s">{html.escape(j['company'])} · {html.escape(j['location'])}{tag}</p></div></div>'''
PAGE=f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:256px;height:72px">
<div class="abs cap gd" style="right:80px;top:280px">SCP Jobs · {cfg['date']}</div>
<div class="abs" style="left:80px;top:352px;width:920px;font-size:104px;font-weight:800;line-height:1;letter-spacing:-.035em">{len(J)} new jobs <span class="gd">today.</span></div>
<div class="abs" style="left:80px;right:80px;top:490px">{''.join(row(j) for j in J)}</div>
<div class="abs cap" style="left:0;right:0;top:1386px;text-align:center;color:#fff">Apply on SCP Jobs <span class="gd">↓</span></div>'''
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1920})
        await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body>{PAGE}'); await pg.wait_for_timeout(300)
        wide=await pg.evaluate("[...document.querySelectorAll('.t,.s')].filter(e=>e.getBoundingClientRect().right>1000).map(e=>e.textContent)")
        if wide: print('TOO WIDE:',wide)
        os.makedirs(os.path.dirname(OUT),exist_ok=True)
        await pg.screenshot(path=OUT,type='jpeg',quality=93)
        await b.close()
asyncio.run(main())

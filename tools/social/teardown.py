"""SCP "post teardown" carousel generator (analisi de contingut esportiu).
Usage: python3 tools/social/teardown.py <config.json> <out_dir> [prefix]
Same config shape as carousel.py (label + slides cover|point|club|cta), plus:
  cover: imgs [1-2 paths]
  point with img: img, handle, callouts [{"v":"781.6k","l":"likes"}, max 3]; body = text under the image, tip = optional hypothesis
  point without img: kicker, title, body, tip (optional)
Image paths are relative to the repo root. Images get rounded corners automatically.
"""
import asyncio, os, sys, json, base64
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
A=R+'/assets/'
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
CSS=f'''@font-face{{font-family:HG;src:url(data:font/woff2;base64,{HG});font-weight:100 900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:HG,sans-serif;color:#fff;background-color:#0d1530;
background-image:linear-gradient(rgba(240,184,74,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(240,184,74,.07) 1px,transparent 1px);background-size:54px 54px}}
.abs{{position:absolute}} .g{{color:#f0b84a}}
.cap{{font-size:22px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}}
.frame{{overflow:hidden;border-radius:34px;border:3px solid #f0b84a;box-shadow:0 30px 70px rgba(0,0,0,.5)}} .frame img{{width:100%;height:100%;object-fit:cover;display:block}}
.pin{{width:64px;height:64px;border-radius:50%;background:#f0b84a;color:#121b33;font-weight:800;font-size:34px;display:flex;align-items:center;justify-content:center;position:absolute;box-shadow:0 0 0 8px rgba(240,184,74,.25)}}
.lab{{position:absolute;font-size:30px;line-height:1.25;font-weight:600;width:230px}} .lab b{{display:block;color:#f0b84a;font-size:52px;font-weight:800;letter-spacing:-.02em;line-height:1.1}}
.box{{border-radius:36px;border:2px solid rgba(240,184,74,.55);background:rgba(18,27,51,.6);padding:40px 48px}}
'''
cfg=json.load(open(sys.argv[1])); OUT=sys.argv[2]; PFX=sys.argv[3] if len(sys.argv)>3 else 'slide'
SL=cfg['slides']; TOT=len(SL)
src=lambda p:'data:image/png;base64,'+b64(os.path.join(R,p))
def hd(k,right=None):
    r=right if right is not None else f'{k+1:02d} / {TOT:02d}'
    return f'<img class="abs" src="data:image/png;base64,{LOGO}" style="left:70px;top:60px;height:80px"><div class="abs cap g" style="right:70px;top:84px">{r}</div>'
def cover(k,s):
    im=[src(p) for p in s.get('imgs',[])[:2]]
    a=f'<div class="abs frame" style="left:150px;top:210px;width:560px;height:625px;transform:rotate(-3deg)"><img src="{im[0]}"></div>' if im else ''
    b=f'<div class="abs frame" style="left:560px;top:420px;width:460px;height:540px;transform:rotate(4deg)"><img src="{im[1]}"></div>' if len(im)>1 else ''
    sub=f'<div class="abs" style="left:70px;top:1235px;width:940px;font-size:26px;color:#aab7d2;font-weight:600">{s["sub"]} Swipe →</div>' if s.get('sub') else ''
    return f'''{hd(k,s.get("kicker","Post teardown"))}{a}{b}
<div class="abs" style="left:70px;top:1000px;width:940px;font-weight:800;font-size:92px;line-height:1;letter-spacing:-.03em">{s['title']}</div>{sub}'''
def point_img(k,s):
    cs=s.get('callouts',[])[:3]; n=len(cs); top,h=250,700
    ys=[top+int(h*(i+.5)/max(n,1))-40 for i in range(n)]
    lines=''.join(f'<path d="M590 {y+32} H700"/>' for y in ys)
    pins=''.join(f'<div class="pin" style="left:700px;top:{y}px">{i+1}</div><div class="lab" style="left:790px;top:{y-12}px"><b>{c["v"]}</b>{c["l"]}</div>' for i,(c,y) in enumerate(zip(cs,ys)))
    tip=f'<div style="margin-top:18px;font-size:32px;font-weight:600;color:#aab7d2">{s["tip"]}</div>' if s.get('tip') else ''
    return f'''{hd(k)}<div class="abs cap" style="left:70px;top:190px;color:#aab7d2">{s['handle']} · {s['kicker']}</div>
<div class="abs frame" style="left:70px;top:{top}px;width:520px;height:{h}px"><img src="{src(s['img'])}"></div>
<svg class="abs" style="left:0;top:0" width="1080" height="1350"><g stroke="#f0b84a" stroke-width="3" fill="none">{lines}</g></svg>{pins}
<div class="abs" style="left:70px;top:1010px;width:940px;border-top:2px solid rgba(240,184,74,.5);padding-top:34px;font-size:40px;line-height:1.25;font-weight:700">{s['body']}{tip}</div>
<div class="abs cap" style="left:70px;top:1290px;font-size:19px;color:#8d9bb8">Public data · no reach</div>'''
def point_txt(k,s):
    tp=s.get('tip') or ''; hy=tp.lower().startswith('hypothesis')
    if hy: tp=tp.split(':',1)[1].strip()
    tip=f'<div class="abs box" style="left:70px;right:70px;top:960px"><div class="cap g" style="font-size:20px;margin-bottom:14px">{"Hypothesis" if hy else "What to change"}</div><div style="font-size:38px;font-weight:700;line-height:1.2">{tp}</div></div>' if tp else ''
    return f'''{hd(k)}<div class="abs cap g" style="left:70px;top:260px">{s['kicker']}</div>
<div class="abs" style="left:70px;top:320px;width:940px;font-size:104px;font-weight:800;line-height:1.03;letter-spacing:-.035em">{s['title']}</div>
<div class="abs" style="left:70px;top:700px;width:900px;font-size:40px;font-weight:500;color:#aab7d2;line-height:1.32">{s['body']}</div>{tip}'''
def club(k,s):
    return f'''{hd(k)}<div class="abs cap g" style="left:70px;top:470px">What it means for a club</div>
<div class="abs" style="left:70px;top:540px;width:940px;font-size:80px;font-weight:800;line-height:1.06;letter-spacing:-.03em">{s['title']}</div>'''
def cta(k,s):
    return f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:70px;top:60px;height:84px">
<div class="abs cap g" style="left:70px;top:360px">{s['kicker']}</div>
<div class="abs" style="left:70px;top:430px;width:940px;font-size:116px;font-weight:800;line-height:1.02;letter-spacing:-.035em">{s['big']}</div>
<div class="abs" style="left:70px;top:850px;width:880px;font-size:40px;color:#aab7d2;font-weight:500;line-height:1.3">{s['sub']}</div>
<div class="abs" style="left:70px;right:70px;top:1080px;height:2px;background:rgba(240,184,74,.55)"></div>
<div class="abs cap" style="left:70px;top:1120px;color:#8d9bb8;font-size:22px">@sportscontentplaybook</div>'''
def render(k,s):
    t=s['type']
    return cover(k,s) if t=='cover' else (point_img(k,s) if s.get('img') else point_txt(k,s)) if t=='point' else club(k,s) if t=='club' else cta(k,s)
async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT,exist_ok=True)
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350})
        for k,s in enumerate(SL):
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body>{render(k,s)}'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/{PFX}-{k+1:02d}.png')
        await b.close()
asyncio.run(main())

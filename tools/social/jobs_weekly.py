import asyncio, base64, os, io, json
from PIL import Image
import sys
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
A=R+'/assets/'
P=os.environ.get('PHOSPHOR','/tmp/ic/node_modules/@phosphor-icons/core/assets/duotone/')
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); SM=b64(A+'favicon-s-192.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
def icon(n): return open(P+n+'-duotone.svg').read().replace('<svg ','<svg width="100%" height="100%" ')
def lg(i):
    im=Image.open(f'{LOGOS}/{i}.img').convert('RGB').resize((300,300),Image.LANCZOS); bio=io.BytesIO(); im.save(bio,'JPEG',quality=92); return 'data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
CSS=f'''@font-face{{font-family:HG;src:url(data:font/woff2;base64,{HG});font-weight:100 900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:HG,sans-serif}}
.dark{{background:radial-gradient(1100px 900px at 85% -5%,#22335c 0%,#121b33 55%,#0c1326 100%);color:#fff}}
.light{{background:linear-gradient(180deg,#f8f9fc 0%,#eef1f6 100%);color:#121b33}}
.abs{{position:absolute}}
.cap{{font-size:23px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}}
.gd{{color:#f0b84a}} .gl{{color:#b87a0c}} .mu{{color:#55617a}} .mud{{color:#8d9bb8}}
.seg{{display:flex;gap:8px;position:absolute;left:80px;right:80px;top:176px}} .seg b{{flex:1;height:5px;border-radius:3px;background:rgba(18,27,51,.12)}} .seg b.on{{background:#f0b84a}} .seg b.done{{background:#121b33}}
.spec{{position:absolute;left:80px;right:80px;display:flex;border-top:2px solid rgba(18,27,51,.14);border-bottom:2px solid rgba(18,27,51,.14)}}
.spec>div{{flex:1;padding:34px 0 34px 34px;border-left:2px solid rgba(18,27,51,.14)}} .spec>div:first-child{{padding-left:0;border-left:none;flex:1.35}}
.spec .cap{{font-size:20px;color:#55617a;margin-bottom:14px}} .spec p{{font-size:40px;font-weight:700;line-height:1.1}}
'''
AREA={'social':('Social media','megaphone'),'content':('Content','pen-nib'),'design':('Design','palette'),'video':('Video','video-camera'),'marketing':('Marketing','chart-line-up'),'partnerships':('Partnerships','handshake')}
TYPE={'full-time':'Full-time','internship':'Internship'}
cfg=json.load(open(sys.argv[1])); LOGOS=sys.argv[2]; OUT=sys.argv[3]; RANGE=cfg['range']
J=[(j['id'],j['title'],j['company'],j['location'],j['type'],j['area'],j['added']) for j in cfg['jobs']]; NJ=len(J)

def pitch(color,op,x,y,r):
    return ''
    return f'<svg class="abs" style="left:0;top:0" width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" stroke="{color}" stroke-opacity="{op}" stroke-width="3"><circle cx="{x}" cy="{y}" r="{r}"/><circle cx="{x}" cy="{y}" r="{r*0.62:.0f}"/><line x1="{x-r*1.3:.0f}" y1="{y}" x2="{x+r*1.3:.0f}" y2="{y}"/></svg>'
def head(k,dark=False):
    c='#fff' if dark else '#121b33'
    return f'<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:{"#aab7d2" if dark else "#55617a"}">SCP Jobs · {RANGE}</div>'
def cover():
    tiles=''.join(f'<div style="width:156px;height:156px;border-radius:40px;background:#fff;padding:14px;box-shadow:0 18px 40px rgba(0,0,0,.35)"><img src="{lg(j[0])}" style="width:100%;height:100%;border-radius:28px;object-fit:cover"></div>' for j in J[:5])
    return 'dark',f'''{pitch('#f0b84a',.16,980,1040,520)}
<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:#aab7d2">SCP Jobs · {RANGE}</div>
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs gd" style="left:62px;top:200px;font-size:470px;font-weight:900;line-height:.9;letter-spacing:-.06em">{NJ}</div>
<div class="abs" style="left:80px;top:640px;width:900px;font-size:104px;font-weight:800;line-height:1.02;letter-spacing:-.03em">sports marketing jobs to put on <span class="gd">your radar.</span></div>
<div class="abs" style="left:80px;top:1015px;width:760px;font-size:38px;color:#aab7d2;font-weight:500;line-height:1.3">New this week on SCP: social, content, design, video and partnerships.</div>
<div class="abs" style="left:80px;top:1150px;display:flex;gap:24px">{tiles}</div>
<div class="abs cap gd" style="right:80px;top:1062px">Swipe →</div>'''
def job(k,j):
    id_,t,co,loc,ty,ar,add=j
    an,ai=AREA[ar]
    seg=''.join(f'<b class="{"done" if n<k-1 else "on" if n==k-1 else ""}"></b>' for n in range(NJ))
    return 'light',f'''{pitch('#121b33',.06,1010,1180,470)}
{head(k)}<div class="seg">{seg}</div>
<div class="abs" style="right:60px;top:210px;font-size:430px;font-weight:900;line-height:.9;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:3px rgba(18,27,51,.10)">{k:02d}</div>
<div class="abs" style="left:80px;top:270px;width:230px;height:230px;border-radius:58px;background:#fff;padding:20px;box-shadow:0 24px 60px rgba(18,27,51,.14);border:2px solid rgba(18,27,51,.06)"><img src="{lg(id_)}" style="width:100%;height:100%;border-radius:40px;object-fit:cover"></div>
<div class="abs" style="left:80px;top:560px;display:flex;align-items:center;gap:16px"><span style="width:38px;height:38px;color:#b87a0c">{icon(ai)}</span><span class="cap gl">{an}</span></div>
<div class="abs" style="left:80px;top:610px;width:920px;height:330px;display:flex;flex-direction:column;justify-content:flex-start;gap:22px"><div style="font-size:{90 if len(t)<=40 else 76}px;font-weight:800;line-height:1.03;letter-spacing:-.03em">{t}</div><div style="font-size:50px;font-weight:600;color:#55617a;display:flex;align-items:center;gap:20px"><i style="width:56px;height:4px;background:#f0b84a;border-radius:2px"></i>{co}</div></div>
<div class="spec" style="top:{940 if len(t)<=40 else 960}px"><div><div class="cap">Location</div><p>{loc}</p></div><div><div class="cap">Contract</div><p>{TYPE[ty]}</p></div><div><div class="cap">Added</div><p>{add}</p></div></div>
<div class="abs" style="left:80px;right:80px;bottom:56px;height:108px;border-radius:34px;background:#121b33;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 28px 0 48px"><div><div style="font-size:36px;font-weight:700">Apply on SCP Jobs</div><div style="font-size:24px;color:#8d9bb8;font-weight:500;margin-top:4px">sportscontentplaybook.com/jobs</div></div><div style="width:76px;height:76px;border-radius:50%;border:2px solid #f0b84a;padding:19px"><svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="#f0b84a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 35 L35 13"/><path d="M17 13 H35 V31"/></svg></div></div>'''
def cta():
    return 'dark',f'''{pitch('#f0b84a',.16,980,1040,520)}
<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:62px;height:84px">
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:330px">New offers every week</div>
<div class="abs" style="left:80px;top:400px;width:920px;font-size:136px;font-weight:800;line-height:1;letter-spacing:-.035em">Every role is on <span class="gd">SCP Jobs.</span></div>
<div class="abs" style="left:80px;top:850px;width:800px;font-size:40px;color:#aab7d2;font-weight:500;line-height:1.3">Filter by social, content, design, video, marketing or partnerships.</div>
<div class="abs" style="left:80px;right:80px;top:1000px;height:2px;background:rgba(240,184,74,.55)"></div>
<div class="abs cap" style="left:80px;top:1040px;color:#8d9bb8;font-size:22px">Browse all open roles</div>
<div class="abs" style="left:80px;right:80px;top:1090px;display:flex;align-items:center;gap:26px"><div style="font-size:50px;font-weight:700;letter-spacing:-.02em">sportscontentplaybook.com<span class="gd">/jobs</span></div><div style="width:54px;height:54px;flex:none"><svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="#f0b84a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 35 L35 13"/><path d="M17 13 H35 V31"/></svg></div></div>'''
async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT,exist_ok=True)
    slides=[cover()]+[job(k+1,j) for k,j in enumerate(J)]+[cta()]
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350})
        for n,(th,inner) in enumerate(slides,1):
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body class="{th}">{inner}'); await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'{OUT}/jobs-{n:02d}.png')
        await b.close()
asyncio.run(main())

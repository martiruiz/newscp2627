import asyncio, base64, os, io, json, sys, importlib.util
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); A=HERE+'/../../assets/'
P=os.environ.get('PHOSPHOR','/tmp/ic/node_modules/@phosphor-icons/core/assets/duotone/')
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); SM=b64(A+'favicon-s-192.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
def icon(n): return open(P+n+'-duotone.svg').read().replace('<svg ','<svg width="100%" height="100%" ')
def lgx(i):
    im=Image.open(f'logo/{i}.img').convert('RGB').resize((300,300),Image.LANCZOS); bio=io.BytesIO(); im.save(bio,'JPEG',quality=92); return 'data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
CSS=f'''@font-face{{font-family:HG;src:url(data:font/woff2;base64,{HG});font-weight:100 900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:HG,sans-serif}}
.dark{{background:radial-gradient(1100px 900px at 85% -5%,#22335c 0%,#121b33 55%,#0c1326 100%);color:#fff}}
.light{{background:linear-gradient(180deg,#f8f9fc 0%,#eef1f6 100%);color:#121b33}}
.abs{{position:absolute}}
.cap{{font-size:23px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}}
.gd{{color:#f0b84a}} .g{{color:#f0b84a}} .light .g{{color:#b87a0c}} .gl{{color:#b87a0c}} .mu{{color:#55617a}} .mud{{color:#8d9bb8}}
.seg{{display:flex;gap:8px;position:absolute;left:80px;right:80px;top:176px}} .seg b{{flex:1;height:5px;border-radius:3px;background:rgba(18,27,51,.12)}} .seg b.on{{background:#f0b84a}} .seg b.done{{background:#121b33}}
.spec{{position:absolute;left:80px;right:80px;display:flex;border-top:2px solid rgba(18,27,51,.14);border-bottom:2px solid rgba(18,27,51,.14)}}
.spec>div{{flex:1;padding:34px 0 34px 34px;border-left:2px solid rgba(18,27,51,.14)}} .spec>div:first-child{{padding-left:0;border-left:none;flex:1.35}}
.spec .cap{{font-size:20px;color:#55617a;margin-bottom:14px}} .spec p{{font-size:40px;font-weight:700;line-height:1.1}}
'''

import re as _re
def brand(n,size=None,color=None):
    p=_re.search(r' d="([^"]+)"',open(os.environ.get('SIMPLEICONS','/tmp/si/node_modules/simple-icons/icons')+f'/{n}.svg').read()).group(1)
    if n=='instagram':
        return f'<svg viewBox="0 0 24 24" width="100%" height="100%"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><path fill="url(#ig)" d="{p}"/></svg>'
    c=color or {'tiktok':'#000000','facebook':'#0866FF','meta':'#0866FF','youtube':'#FF0000','x':'#000000','linkedin':'#0A66C2','threads':'#000000','snapchat':'#FFFC00','pinterest':'#E60023','whatsapp':'#25D366','twitch':'#9146FF'}.get(n,'#121b33')
    return f'<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="{c}" d="{p}"/></svg>'
BR={'tiktok-logo':'tiktok','instagram-logo':'instagram','facebook-logo':'facebook','meta-logo':'meta'}
def gen(n): return 'data:image/png;base64,'+b64(f'av/gen_{n}.png')
def pose(n): return 'data:image/png;base64,'+b64(f'av/pose_{n}.png')
def photo(i):
    im=Image.open(f'../car/img/{i}').convert('RGB'); bio=io.BytesIO(); im.save(bio,'JPEG',quality=90); return 'data:image/jpeg;base64,'+base64.b64encode(bio.getvalue()).decode()
ARW=lambda c:f'<svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 35 L35 13"/><path d="M17 13 H35 V31"/></svg>'
cfg=json.load(open(sys.argv[1])); OUT=sys.argv[2]; LABEL=cfg['label']
N=[(i['img'],i['brand'],i['platform'],i['title'],i['para'],i['tip'],i['date']) for i in cfg['items']]; NN=len(N)
UB=list(dict.fromkeys(i[1] for i in N))[:4]
_pl=list(dict.fromkeys(i[2] for i in N)); PLATS=', '.join(_pl[:-1])+' and '+_pl[-1] if len(_pl)>1 else _pl[0]
def _load_illus():
    sp=importlib.util.spec_from_file_location('illus',HERE+'/illus.py'); m=importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
def GENERIC(ic):
    return f'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="position:absolute;width:520px;height:520px;border-radius:50%;border:2px solid rgba(18,27,51,.08)"></div><div style="position:absolute;width:380px;height:380px;border-radius:50%;border:2px solid rgba(18,27,51,.08)"></div><div style="width:280px;height:280px;border-radius:76px;background:#fff;padding:64px;box-shadow:0 30px 70px rgba(18,27,51,.16);border:2px solid rgba(18,27,51,.06)">{brand(ic)}</div></div>'
def seg(k,dark):
    base='rgba(255,255,255,.18)' if dark else 'rgba(18,27,51,.12)'; done='#fff' if dark else '#121b33'
    return '<div class="seg">'+''.join(f'<b style="background:{done if n<k else "#f0b84a" if n==k else base}"></b>' for n in range(2*NN))+'</div>'
def head(dark,label='SCP Social News'):
    return f'<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:{"#aab7d2" if dark else "#55617a"}">{label}</div>'
def cover():
    tiles=''.join(f'<div style="width:156px;height:156px;border-radius:40px;background:#fff;padding:38px;border:2px solid rgba(18,27,51,.08);box-shadow:0 18px 40px rgba(18,27,51,.12)">{brand(n)}</div>' for n in UB)
    return 'light',f'''{head(False,f'SCP Social News · {LABEL}')}
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(18,27,51,.14)"></div>
<div class="abs gl" style="left:62px;top:200px;font-size:470px;font-weight:900;line-height:.9;letter-spacing:-.06em">{NN}</div>
<div class="abs" style="left:80px;top:640px;width:920px;font-size:104px;font-weight:800;line-height:1.02;letter-spacing:-.03em">platform changes sports teams should <span class="g">know now.</span></div>
<div class="abs" style="left:80px;top:1015px;width:900px;font-size:38px;color:#55617a;font-weight:500;line-height:1.3">{PLATS}: what changed and what it means for a club.</div>
<div class="abs" style="left:80px;top:1160px;display:flex;gap:24px;align-items:center">{tiles}<div class="cap gl" style="margin-left:24px">Swipe →</div></div>'''
def news(k,d):
    img,ic,plat,t,p,tip,date=d; pos=2*k-1
    illus=_load_illus()
    pic=f'<div style="position:absolute;left:0;top:0;width:920px;height:560px;transform-origin:0 0">{illus.ILL[img]() if img in illus.ILL else GENERIC(ic)}</div>'
    return 'light',f'''{head(False)}{seg(pos-1,False)}
<div class="abs" style="left:80px;top:230px;width:920px;height:560px;border-radius:44px;background:linear-gradient(135deg,#f2f4f9,#e2e8f2);border:2px solid rgba(18,27,51,.07);overflow:hidden;position:absolute">{pic}</div>
<div class="abs" style="left:80px;top:810px;display:flex;align-items:center;gap:18px"><div style="display:flex;align-items:center;gap:18px;height:84px;padding:0 36px 0 14px;border-radius:42px;background:#fff;border:2px solid rgba(18,27,51,.1);box-shadow:0 12px 30px rgba(18,27,51,.08)"><span style="width:56px;height:56px;border-radius:50%;background:#fff;padding:6px;border:2px solid rgba(18,27,51,.08)">{brand(ic)}</span><span style="font-weight:900;font-size:40px;letter-spacing:.06em;text-transform:uppercase;color:#121b33">{plat}</span></div><span class="cap mu" style="font-size:22px">{date}</span></div>
<div class="abs" style="left:80px;top:925px;width:920px;display:flex;flex-direction:column;gap:20px"><div style="font-size:66px;font-weight:800;line-height:1.04;letter-spacing:-.03em">{t}</div><div style="font-size:30px;font-weight:500;color:#55617a;line-height:1.3;width:860px">{p}</div></div>
<div class="abs" style="left:80px;right:80px;bottom:124px;height:2px;background:rgba(18,27,51,.14)"></div>
<div class="abs cap gl" style="right:80px;bottom:70px;font-size:20px">Swipe →</div>'''
def club(k,d):
    img,ic,plat,t,p,tip,date=d; pos=2*k
    return 'dark',f'''{head(True)}{seg(pos-1,True)}
<div class="abs" style="right:80px;top:225px;width:300px;height:300px;color:rgba(240,184,74,.9)">{icon(['chats-circle','video','chart-line-up','tag','flask'][k-1])}</div>
<div class="abs" style="left:80px;top:300px;width:150px;height:150px;border-radius:44px;border:2px solid #f0b84a;padding:34px;color:#f0b84a">{icon('lightbulb')}</div>
<div class="abs cap gd" style="left:80px;top:500px">What it means for a club</div>
<div class="abs" style="left:80px;top:650px;width:920px;font-size:80px;font-weight:800;line-height:1.05;letter-spacing:-.03em">{tip}</div>
<div class="abs" style="left:80px;right:80px;bottom:132px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs" style="left:80px;bottom:70px;display:flex;align-items:center;gap:16px"><span style="width:38px;height:38px;background:#fff;border-radius:12px;padding:6px">{brand(ic)}</span><span class="cap" style="color:#aab7d2">{plat}</span></div>
<div class="abs cap" style="right:80px;bottom:78px;color:#8d9bb8;font-size:20px">Swipe →</div>'''
def cta():
    return 'dark',f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:62px;height:84px">
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:330px">Every week</div>
<div class="abs" style="left:80px;top:400px;width:920px;font-size:136px;font-weight:800;line-height:1;letter-spacing:-.035em">The news that matter on <span class="gd">SCP Social News.</span></div>
<div class="abs" style="left:80px;top:900px;width:800px;font-size:36px;color:#aab7d2;font-weight:500;line-height:1.3">Platform changes explained for sports teams, every week.</div>
<div class="abs" style="left:80px;right:80px;top:1040px;height:2px;background:rgba(240,184,74,.55)"></div>
<div class="abs cap" style="left:80px;top:1080px;color:#8d9bb8;font-size:22px">Read all the news</div>
<div class="abs" style="left:80px;top:1130px;display:flex;align-items:center;gap:26px"><div style="font-size:50px;font-weight:700;letter-spacing:-.02em">sportscontentplaybook.com<span class="gd">/news</span></div><div style="width:54px;height:54px;flex:none">{ARW('#f0b84a')}</div></div>'''
async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT,exist_ok=True)
    sl=[cover()]
    for k,d in enumerate(N,1): sl+= [news(k,d),club(k,d)]
    sl.append(cta())
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350})
        for n,(th,inner) in enumerate(sl,1):
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body class="{th}">{inner}'); await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'{OUT}/news-{n:02d}.png')
        await b.close()

asyncio.run(main())

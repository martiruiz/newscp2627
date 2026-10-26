"""Monthly SCP carousel generator.
Usage: python3 tools/social/monthly.py tools/social/configs/YYYY-MM.json <covers_dir> <out_dir>
Needs: playwright (chromium), Pillow not required. Covers: <covers_dir>/<content_ideas.id>.jpg
"""
import asyncio, os, sys, json, base64
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
A=R+'/assets/'
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
LOGO=b64(A+'logo-scp.png'); SM=b64(A+'favicon-s-192.png'); HG=b64(A+'fonts/host-grotesk-latin-ad6d5d.woff2')
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

IGP="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"
def brand(n):
    return f'<svg viewBox="0 0 24 24" width="100%" height="100%"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><path fill="url(#ig)" d="{IGP}"/></svg>'
ARW=lambda c:f'<svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 35 L35 13"/><path d="M17 13 H35 V31"/></svg>'
import re as _re

P=os.environ.get('PHOSPHOR','/tmp/ic/node_modules/@phosphor-icons/core/assets/duotone/')
def icon(n): return open(P+n+'-duotone.svg').read().replace('<svg ','<svg width="100%" height="100%" ')
cfg=json.load(open(sys.argv[1])); OUT=sys.argv[2]; PFX=sys.argv[3] if len(sys.argv)>3 else 'slide'
SL=cfg['slides']; TOT=len(SL)
def hd(dark): return f'<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:{"#aab7d2" if dark else "#55617a"}">SCP · {cfg["label"]}</div>'
def sg(k,dark):
    base='rgba(255,255,255,.18)' if dark else 'rgba(18,27,51,.12)'; dn='#fff' if dark else '#121b33'
    return '<div class="seg">'+''.join(f'<b style="background:{dn if n<k else "#f0b84a" if n==k else base}"></b>' for n in range(TOT-1))+'</div>'
def cover(s):
    t=len(_re.sub('<[^>]+>','',s['title'])); fs=122 if t<40 else 108 if t<60 else 92
    sub=f'<div style="font-size:38px;color:#aab7d2;font-weight:500;line-height:1.3;width:860px">{s["sub"]}</div>' if s.get('sub') else ''
    return 'dark',f'''{hd(True)}<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:300px">{s['kicker']}</div>
<div class="abs" style="left:80px;top:370px;width:920px;display:flex;flex-direction:column;gap:44px"><div style="font-size:{fs}px;font-weight:800;line-height:1.03;letter-spacing:-.035em">{s['title']}</div>{sub}</div>
<div class="abs cap gd" style="left:80px;bottom:90px;font-size:22px">Swipe →</div>'''
def point(k,s):
    t=len(_re.sub('<[^>]+>','',s['title'])); fs=104 if t<28 else 88
    tip=f'<div class="abs" style="left:80px;right:80px;bottom:150px;border-radius:36px;background:#121b33;color:#fff;padding:40px 48px"><div class="cap gd" style="font-size:20px;margin-bottom:14px">What to change</div><div style="font-size:38px;font-weight:700;line-height:1.2">{s["tip"]}</div></div>' if s.get('tip') else ''
    if s.get('img'):
        im=b64(os.path.join(R,s['img'])); fs=64 if t<34 else 56
        return 'light',f'''{hd(False)}{sg(k,False)}
<div class="abs" style="left:80px;top:270px;width:470px;display:flex;flex-direction:column;gap:26px"><div class="cap gl">{s['kicker']}</div><div style="font-size:{fs}px;font-weight:800;line-height:1.05;letter-spacing:-.03em">{s['title']}</div><div style="font-size:32px;font-weight:500;color:#55617a;line-height:1.32">{s['body']}</div></div>
<div class="abs" style="left:600px;top:270px;width:400px;display:flex;flex-direction:column;align-items:flex-end;gap:16px"><img src="data:image/png;base64,{im}" style="height:540px;max-width:400px;object-fit:cover;border-radius:26px;border:2px solid rgba(18,27,51,.14);box-shadow:0 18px 40px rgba(18,27,51,.18)"><div class="cap mu" style="font-size:18px">{s['handle']} · Instagram</div></div>{tip}
<div class="abs cap gl" style="right:80px;bottom:70px;font-size:20px">Swipe →</div>'''
    return 'light',f'''{hd(False)}{sg(k,False)}
<div class="abs" style="left:80px;top:290px;width:150px;height:150px;border-radius:44px;border:2px solid #b87a0c;padding:34px;color:#b87a0c">{icon(s['icon'])}</div>
<div class="abs" style="left:80px;top:500px;width:920px;display:flex;flex-direction:column;gap:30px"><div class="cap gl">{s['kicker']}</div><div style="font-size:{fs}px;font-weight:800;line-height:1.04;letter-spacing:-.03em">{s['title']}</div><div style="font-size:40px;font-weight:500;color:#55617a;line-height:1.32;width:880px">{s['body']}</div></div>{tip}
<div class="abs" style="left:80px;right:80px;bottom:124px;height:2px;background:rgba(18,27,51,.14);{'display:none' if s.get('tip') else ''}"></div><div class="abs cap gl" style="right:80px;bottom:70px;font-size:20px">Swipe →</div>'''
def club(k,s):
    return 'dark',f'''{hd(True)}{sg(k,True)}
<div class="abs" style="left:80px;top:300px;width:150px;height:150px;border-radius:44px;border:2px solid #f0b84a;padding:34px;color:#f0b84a">{icon('lightbulb')}</div>
<div class="abs cap gd" style="left:80px;top:500px">What it means for a club</div>
<div class="abs" style="left:80px;top:570px;width:920px;font-size:78px;font-weight:800;line-height:1.06;letter-spacing:-.03em">{s['title']}</div>
<div class="abs cap gd" style="right:80px;bottom:70px;font-size:20px">Swipe →</div>'''
def cta(s):
    return 'dark',f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:62px;height:84px">
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:360px">{s['kicker']}</div>
<div class="abs" style="left:80px;top:430px;width:920px;font-size:116px;font-weight:800;line-height:1.02;letter-spacing:-.035em">{s['big']}</div>
<div class="abs" style="left:80px;top:850px;width:860px;font-size:40px;color:#aab7d2;font-weight:500;line-height:1.3">{s['sub']}</div>
<div class="abs" style="left:80px;right:80px;top:1080px;height:2px;background:rgba(240,184,74,.55)"></div>
<div class="abs cap" style="left:80px;top:1120px;color:#8d9bb8;font-size:22px">@sportscontentplaybook</div>'''
async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT,exist_ok=True)
    sl=[]
    for k,s in enumerate(SL):
        t=s['type']; sl.append(cover(s) if t=='cover' else point(k,s) if t=='point' else club(k,s) if t=='club' else cta(s))
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350})
        for n,(th,inner) in enumerate(sl,1):
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body class="{th}">{inner}'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/{PFX}-{n:02d}.png')
        await b.close()
asyncio.run(main())

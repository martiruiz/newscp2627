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
cfg=json.load(open(sys.argv[1])); COV=sys.argv[2] if len(sys.argv)>2 else '../monthly/cov'; OUT=sys.argv[3] if len(sys.argv)>3 else 'out8'
M=cfg['month']; ID=cfg['ideas']; TOT=len(ID)+3
def cv(i): return 'data:image/jpeg;base64,'+b64(f'{COV}/{i}.jpg')
def hd(dark=False): return f'<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:{"#aab7d2" if dark else "#55617a"}">SCP Monthly Ideas · {M} {cfg["year"]}</div>'
def sg(k,dark):
    base='rgba(255,255,255,.18)' if dark else 'rgba(18,27,51,.12)'; dn='#fff' if dark else '#121b33'
    return '<div class="seg">'+''.join(f'<b style="background:{dn if n<k else "#f0b84a" if n==k else base}"></b>' for n in range(TOT))+'</div>'
def cover():
    tiles=''.join(f'<div style="width:150px;height:215px;border-radius:22px;overflow:hidden;border:2px solid rgba(255,255,255,.16);box-shadow:0 18px 40px rgba(0,0,0,.35)"><img src="{cv(i["posts"][0]["id"])}" style="width:100%;height:100%;object-fit:cover"></div>' for i in ID)
    return 'dark',f'''{hd(True)}<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs gd" style="left:56px;top:190px;font-size:520px;font-weight:900;line-height:.9;letter-spacing:-.06em">{len(ID)}</div>
<div class="abs" style="left:80px;top:690px;width:920px;font-size:100px;font-weight:800;line-height:1.02;letter-spacing:-.03em">content ideas for <span class="gd">{M}.</span></div>
<div class="abs" style="left:80px;top:925px;width:900px;font-size:36px;color:#aab7d2;font-weight:500;line-height:1.3">With real examples from the SCP library, plus the key dates of the month.</div>
<div class="abs" style="left:80px;top:1040px;display:flex;gap:14px">{tiles}</div>
<div class="abs cap gd" style="left:80px;top:1290px;font-size:21px">Save it for your calendar · Swipe →</div>'''
CHK='<svg viewBox="0 0 256 256" width="100%" height="100%" fill="#f0b84a"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>'
def pill(t): return f'<div style="display:flex;align-items:center;gap:14px;font-size:28px;font-weight:700;color:#121b33"><span style="width:36px;height:36px;flex:none">{CHK}</span>{t}</div>'
def idea(k,d):
    cards=''.join(f'<div style="width:440px"><div style="width:440px;height:450px;border-radius:30px;overflow:hidden;background:#121b33;box-shadow:0 28px 60px rgba(18,27,51,.22);border:2px solid rgba(18,27,51,.08);position:relative"><img src="{cv(p["id"])}" style="width:100%;height:100%;object-fit:cover;object-position:50% 35%"><span style="position:absolute;left:16px;top:16px;width:48px;height:48px;border-radius:50%;background:#fff;padding:9px">{brand("instagram")}</span></div><div style="margin-top:16px;display:flex;align-items:baseline;gap:10px"><span style="font-size:34px;font-weight:800;letter-spacing:-.02em">{p["likes"]}</span><span class="cap mu" style="font-size:19px">likes</span></div></div>' for p in d['posts'])
    return 'light',f'''{hd()}{sg(k,False)}
<div class="abs" style="left:80px;top:206px;right:80px;display:flex;align-items:center;gap:26px"><span class="gl" style="font-size:84px;font-weight:900;letter-spacing:-.04em;line-height:1">0{k}</span><span style="flex:1;height:2px;background:rgba(18,27,51,.14)"></span><span class="cap mu" style="font-size:22px">Idea {k} of {len(ID)}</span></div>
<div class="abs" style="left:80px;top:340px;width:920px;display:flex;flex-direction:column;gap:26px"><div style="font-size:70px;font-weight:800;line-height:1.04;letter-spacing:-.03em">{d['title']}</div><div style="font-size:30px;font-weight:500;color:#55617a;line-height:1.32;width:880px">{d['desc']}</div><div style="display:flex;flex-direction:column;gap:16px;margin-top:6px">{''.join(pill(t) for t in d['tags'])}</div></div>
<div class="abs" style="left:80px;top:830px;display:flex;gap:40px">{cards}</div>'''
def dates():
    rows=''.join(f'<div style="display:flex;gap:30px;padding:20px 0;border-top:2px solid rgba(18,27,51,.14);align-items:baseline"><div class="cap gl" style="font-size:22px;width:200px;flex:none">{a}</div><div style="font-size:34px;font-weight:700;line-height:1.15">{b}</div></div>' for a,b in cfg['dates'])
    return 'light',f'''{hd()}{sg(TOT-2,False)}
<div class="abs cap gl" style="left:80px;top:232px">Key dates</div>
<div class="abs" style="left:80px;top:290px;width:920px;font-size:84px;font-weight:800;line-height:1.02;letter-spacing:-.03em">Plan around these <span class="g">dates.</span></div>
<div class="abs" style="left:80px;right:80px;top:520px">{rows}<div style="border-top:2px solid rgba(18,27,51,.14)"></div></div>
<div class="abs" style="left:80px;top:1250px;font-size:24px;color:#55617a;font-weight:500">Check your own league and federation calendar for local fixtures.</div>'''
def cta():
    W=M.upper()
    return 'dark',f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:62px;height:84px">
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:300px">Free PDF · {M} ideas</div>
<div class="abs" style="left:80px;top:380px;width:920px;font-size:104px;font-weight:800;line-height:1.02;letter-spacing:-.035em">Comment</div>
<div class="abs gd" style="left:72px;top:490px;font-size:{min(215,int(1380/len(W)))}px;font-weight:900;line-height:1;letter-spacing:-.05em;white-space:nowrap">{W}</div>
<div class="abs" style="left:80px;top:800px;width:860px;font-size:40px;color:#aab7d2;font-weight:500;line-height:1.3">and we'll send you the free PDF with all {len(ID)} ideas, the examples and the key dates.</div>
<div class="abs" style="left:80px;right:80px;top:1080px;height:2px;background:rgba(240,184,74,.55)"></div>
<div class="abs cap" style="left:80px;top:1120px;color:#8d9bb8;font-size:22px">@sportscontentplaybook</div>'''

def step_rows(d):
    return ''.join(f'<div style="display:flex;gap:28px;align-items:baseline;padding:16px 0;border-top:2px solid rgba(18,27,51,.14)"><span class="gl" style="font-size:36px;font-weight:900;width:56px;flex:none">{i}</span><span style="font-size:29px;font-weight:600;line-height:1.25">{t}</span></div>' for i,t in enumerate(d['steps'],1))
def pdf_a(k,d):
    hooks=''.join(f'<div style="font-size:30px;font-weight:600;line-height:1.25;padding:4px 0">“{h}”</div>' for h in d['hooks'])
    return 'light',f'''{hd()}
<div class="abs" style="left:80px;top:206px;right:80px;display:flex;align-items:center;gap:26px"><span class="gl" style="font-size:84px;font-weight:900;letter-spacing:-.04em;line-height:1">0{k}</span><span style="flex:1;height:2px;background:rgba(18,27,51,.14)"></span><span class="cap mu" style="font-size:22px">Idea {k} of {len(ID)}</span></div>
<div class="abs" style="left:80px;top:340px;width:920px;display:flex;flex-direction:column;gap:26px"><div style="font-size:70px;font-weight:800;line-height:1.04;letter-spacing:-.03em">{d['title']}</div><div style="font-size:30px;font-weight:500;color:#55617a;line-height:1.32;width:880px">{d['desc']}</div><div style="display:flex;flex-direction:column;gap:16px;margin-top:6px">{''.join(pill(t) for t in d['tags'])}</div></div>
<div class="abs" style="left:80px;right:80px;top:765px"><div class="cap gl" style="font-size:22px;margin-bottom:14px">How to do it</div>{step_rows(d)}<div style="border-top:2px solid rgba(18,27,51,.14)"></div></div>
<div class="abs" style="left:80px;right:80px;top:1170px;padding:6px 0 6px 30px;border-left:6px solid #f0b84a"><div class="cap mu" style="font-size:20px;margin-bottom:10px">Hook templates to adapt</div>{hooks}</div>'''
def pdf_b(k,d):
    cards=''.join(f'<a href="{p["url"]}" style="display:block;width:440px;color:inherit;text-decoration:none"><div style="width:440px;height:600px;border-radius:30px;overflow:hidden;background:#121b33;box-shadow:0 28px 60px rgba(18,27,51,.22);border:2px solid rgba(18,27,51,.08);position:relative"><img src="{cv(p["id"])}" style="width:100%;height:100%;object-fit:cover;object-position:50% 35%"><span style="position:absolute;left:16px;top:16px;width:48px;height:48px;border-radius:50%;background:#fff;padding:9px">{brand("instagram")}</span></div><div style="margin-top:18px;display:flex;align-items:baseline;gap:10px"><span style="font-size:38px;font-weight:800;letter-spacing:-.02em">{p["likes"]}</span><span class="cap mu" style="font-size:20px">likes</span></div><div class="cap gl" style="font-size:20px;margin-top:8px">View the post ↗</div></a>' for p in d['posts'])
    return 'light',f'''{hd()}
<div class="abs" style="left:80px;top:206px;right:80px;display:flex;align-items:center;gap:26px"><span class="gl" style="font-size:84px;font-weight:900;letter-spacing:-.04em;line-height:1">0{k}</span><span style="flex:1;height:2px;background:rgba(18,27,51,.14)"></span><span class="cap mu" style="font-size:22px">Examples from the SCP library</span></div>
<div class="abs" style="left:80px;top:330px;width:920px;font-size:50px;font-weight:800;line-height:1.08;letter-spacing:-.03em">{d['title']}</div>
<div class="abs" style="left:80px;top:500px;display:flex;gap:40px">{cards}</div>
<div class="abs" style="left:80px;right:80px;top:1230px"><div style="font-size:25px;line-height:1.35;color:#55617a;font-weight:500"><b style="color:#121b33">Observed:</b> public like counts when the posts were added to SCP. <b style="color:#121b33">{d['why']}</b></div></div>'''
def cover_a4():
    tiles=''.join(f'<div style="width:150px;height:215px;border-radius:22px;overflow:hidden;border:2px solid rgba(255,255,255,.16);box-shadow:0 18px 40px rgba(0,0,0,.35)"><img src="{cv(i["posts"][0]["id"])}" style="width:100%;height:100%;object-fit:cover"></div>' for i in ID)
    return f'''<div class="abs" style="left:0;top:0;width:1080px;height:1527px">
<img class="abs" src="data:image/png;base64,{SM}" style="left:80px;top:62px;height:72px"><div class="abs cap" style="right:80px;top:84px;color:#aab7d2">Free PDF · {M} {cfg["year"]}</div>
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs gd" style="left:56px;top:200px;font-size:560px;font-weight:900;line-height:.9;letter-spacing:-.06em">{len(ID)}</div>
<div class="abs" style="left:80px;top:760px;width:920px;font-size:104px;font-weight:800;line-height:1.02;letter-spacing:-.03em">content ideas for <span class="gd">{M}.</span></div>
<div class="abs" style="left:80px;top:1010px;width:900px;font-size:36px;color:#aab7d2;font-weight:500;line-height:1.3">With real examples from the SCP library, steps, hooks and the key dates of the month.</div>
<div class="abs" style="left:80px;top:1200px;display:flex;gap:14px">{tiles}</div></div>'''
async def make_pdf(pg,b,OUT):
    pages=[('dark',cover()[1].replace('Save it for your calendar · Swipe →','Free PDF · Plan your month'))]
    for k,d in enumerate(ID,1): pages+= [pdf_a(k,d),pdf_b(k,d)]
    pages+=[dates(),pdf_cta()]
    html=''.join(f'<section class="{th}" style="position:relative;width:1080px;height:1350px;overflow:hidden;page-break-after:always;break-after:page">{inner}</section>' for th,inner in pages)
    pg2=await b.new_page(viewport={'width':1080,'height':1350})
    await pg2.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}body{{height:auto!important;overflow:visible!important;width:1080px}} .seg{{display:none}} @page{{size:1080px 1350px;margin:0}}</style><body>{html}')
    await pg2.wait_for_timeout(800)
    await pg2.pdf(path=f'{OUT}/{cfg["slug_res"]}.pdf',width='1080px',height='1350px',print_background=True)
    pg3=await b.new_page(viewport={'width':1080,'height':1527})
    await pg3.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}body{{height:1527px!important}}</style><body class="dark">{cover_a4()}')
    await pg3.wait_for_timeout(500); await pg3.screenshot(path=f'{OUT}/resource-cover.png')
def pdf_cta():
    return 'dark',f'''<img class="abs" src="data:image/png;base64,{LOGO}" style="left:80px;top:62px;height:84px">
<div class="abs" style="left:80px;top:170px;right:80px;height:2px;background:rgba(255,255,255,.14)"></div>
<div class="abs cap gd" style="left:80px;top:330px">Sports Content Playbook</div>
<div class="abs" style="left:80px;top:400px;width:920px;font-size:120px;font-weight:800;line-height:1;letter-spacing:-.035em">Find more <span class="gd">ideas like these.</span></div>
<div class="abs" style="left:80px;top:850px;width:800px;font-size:36px;color:#aab7d2;font-weight:500;line-height:1.3">Real sports posts, organised by format, moment and angle.</div>
<div class="abs" style="left:80px;right:80px;top:1040px;height:2px;background:rgba(240,184,74,.55)"></div>
<a href="https://sportscontentplaybook.com/" style="color:#fff;text-decoration:none"><div class="abs" style="left:80px;top:1100px;display:flex;align-items:center;gap:26px"><div style="font-size:50px;font-weight:700;letter-spacing:-.02em">sportscontentplaybook.com</div><div style="width:54px;height:54px;flex:none">{ARW('#f0b84a')}</div></div></a>'''
async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT,exist_ok=True)
    sl=[cover()]+[idea(k,d) for k,d in enumerate(ID,1)]+[dates(),cta()]
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350})
        for n,(th,inner) in enumerate(sl,1):
            await pg.set_content(f'<!doctype html><meta charset=utf8><style>{CSS}</style><body class="{th}">{inner}'); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'{OUT}/monthly-{n:02d}.png')
        if len(sys.argv)>4 and sys.argv[4]=='pdf': await make_pdf(pg,b,OUT)
        await b.close()
asyncio.run(main())

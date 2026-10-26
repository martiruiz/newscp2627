import os
FILL=os.environ.get('PHOSPHOR_FILL','/tmp/ic/node_modules/@phosphor-icons/core/assets/fill/')
def fi(n,c='currentColor',s=None):
    svg=open(FILL+n+'-fill.svg').read().replace('<svg ',f'<svg width="100%" height="100%" fill="{c}" ',1)
    return svg
NAVY='#121b33'; GOLD='#f0b84a'; GD='#b87a0c'
def box(x,y,w,h,inner,style=''):
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}{'px' if not isinstance(w,str) else ''};height:{h}px;{style}">{inner}</div>'
def phone(x,y,w,h,inner,rot=0,extra=''):
    return box(x,y,w,h,f'<div style="position:absolute;inset:0;border-radius:44px;background:{NAVY};padding:12px;box-shadow:0 30px 60px rgba(18,27,51,.28)"><div style="position:relative;width:100%;height:100%;border-radius:34px;background:#fff;overflow:hidden">{inner}</div></div>',f'transform:rotate({rot}deg);{extra}')
def av(c,s=36): return f'<div style="width:{s}px;height:{s}px;border-radius:50%;background:{c};flex:none"></div>'
def line(w,h=10,c='#d5dbe8',r=6): return f'<div style="width:{w}px;height:{h}px;border-radius:{r}px;background:{c}"></div>'
def tiktok():
    # phone with video + comment sheet, one comment lifting out with repost
    vid=f'<div style="position:absolute;inset:0;background:linear-gradient(160deg,#25345f,#121b33)"></div><div style="position:absolute;left:50%;top:70px;width:64px;height:64px;margin-left:-32px;border-radius:50%;background:rgba(255,255,255,.18);padding:16px;color:#fff">{fi("play")}</div>'
    sheet=f'''<div style="position:absolute;left:0;right:0;bottom:0;height:250px;background:#fff;border-radius:26px 26px 0 0;padding:16px 16px;display:flex;flex-direction:column;gap:12px">
<div style="display:flex;gap:10px;align-items:center">{av('#cfd6e6',30)}{line(120,9)}</div>
<div style="display:flex;gap:10px;align-items:center;background:#fff6e0;border:2px solid {GOLD};border-radius:16px;padding:10px">{av(GOLD,30)}<div style="display:flex;flex-direction:column;gap:7px">{line(110,9,'#c9a14a')}{line(80,8,'#e3c37a')}</div></div>
<div style="display:flex;gap:10px;align-items:center">{av('#cfd6e6',30)}{line(100,9)}</div></div>'''
    p=phone(150,30,250,500,vid+sheet)
    card=box(560,150,300,170,f'''<div style="width:100%;height:100%;background:#fff;border-radius:28px;padding:22px;box-shadow:0 30px 60px rgba(18,27,51,.22);border:3px solid {GOLD};display:flex;flex-direction:column;gap:16px;transform:rotate(4deg)">
<div style="display:flex;gap:14px;align-items:center">{av(GOLD,52)}<div style="display:flex;flex-direction:column;gap:9px">{line(130,12,NAVY)}{line(90,9)}</div></div>{line(230,12)}{line(170,12)}</div>''')
    rep=box(600,350,220,72,f'<div style="width:100%;height:100%;border-radius:36px;background:{NAVY};color:#fff;display:flex;align-items:center;gap:14px;padding:0 24px;font-weight:800;font-size:30px"><span style="width:36px;height:36px;color:{GOLD}">{fi("repeat")}</span>Repost</div>')
    arrow=f'<svg style="position:absolute;left:380px;top:200px" width="190" height="120" viewBox="0 0 190 120" fill="none" stroke="{GD}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 12"><path d="M0 100 C 60 100, 80 20, 170 20"/></svg>'
    heart=box(790,110,64,64,f'<div style="color:#e5484d;width:100%;height:100%">{fi("heart")}</div>')
    return p+arrow+card+rep+heart
def reels():
    stories=''.join(f'<div style="width:46px;height:46px;border-radius:50%;border:3px solid {GOLD};padding:3px;flex:none"><div style="width:100%;height:100%;border-radius:50%;background:#cfd6e6"></div></div>' for _ in range(4))
    new=f'''<div style="position:absolute;left:0;right:0;top:0;padding:18px 14px 8px;display:flex;gap:10px">{stories}</div>
<div style="position:absolute;left:12px;right:12px;top:92px;bottom:60px;border-radius:24px;background:linear-gradient(160deg,#2a3a68,#121b33)"></div>
<div style="position:absolute;left:50%;top:230px;width:70px;height:70px;margin-left:-35px;border-radius:50%;background:rgba(255,255,255,.2);padding:18px;color:#fff">{fi("play")}</div>
<div style="position:absolute;right:24px;top:300px;display:flex;flex-direction:column;gap:18px;width:34px;color:#fff"><div style="height:34px">{fi("heart")}</div><div style="height:34px">{fi("chat-circle")}</div></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:52px;display:flex;justify-content:space-around;align-items:center">{''.join(line(26,26,'#cfd6e6',8) for _ in range(4))}</div>'''
    old=f'''<div style="position:absolute;left:0;right:0;top:0;padding:18px 14px 8px;display:flex;gap:10px">{stories}</div>
<div style="position:absolute;left:12px;right:12px;top:92px;height:150px;border-radius:18px;background:#e3e8f2"></div>
<div style="position:absolute;left:12px;top:252px;display:flex;gap:10px;align-items:center">{av('#cfd6e6',30)}{line(100,9)}</div>
<div style="position:absolute;left:12px;right:12px;top:296px;height:150px;border-radius:18px;background:#e3e8f2"></div>'''
    p1=phone(100,60,230,450,old,rot=-6,extra='opacity:.55;filter:saturate(.6)')
    p2=phone(430,20,270,520,new,rot=3)
    lab=box(150,18,130,52,f'<div style="width:100%;height:100%;border-radius:26px;background:#fff;border:2px solid rgba(18,27,51,.15);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;letter-spacing:.14em;color:#55617a">BEFORE</div>')
    lab2=box(730,40,150,56,f'<div style="width:100%;height:100%;border-radius:28px;background:{GOLD};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;letter-spacing:.14em;color:{NAVY}">IN TEST</div>')
    arr=f'<div style="position:absolute;left:345px;top:250px;width:70px;height:70px;border-radius:50%;background:{NAVY};color:{GOLD};padding:18px"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M8 24H38M26 12L38 24L26 36"/></svg></div>'
    return p1+lab+arr+p2+lab2
def mosseri():
    items=[('chart-bar','Engagement rate',GOLD),('clock','Timing','#8fb3ff'),('copy','Originality','#7bd3a6'),('flask','Testing','#e59ad0')]
    out=''
    for i,(ic,t,c) in enumerate(items):
        x=60+(i%2)*430; y=40+(i//2)*250
        out+=box(x,y,400,220,f'''<div style="width:100%;height:100%;background:#fff;border-radius:34px;box-shadow:0 24px 50px rgba(18,27,51,.12);border:2px solid rgba(18,27,51,.06);padding:28px;display:flex;flex-direction:column;justify-content:space-between">
<div style="display:flex;justify-content:space-between;align-items:center"><div style="width:76px;height:76px;border-radius:24px;background:{NAVY};padding:18px;color:{c}">{fi(ic)}</div><div style="font-weight:900;font-size:64px;color:rgba(18,27,51,.10);letter-spacing:-.04em">0{i+1}</div></div>
<div style="font-weight:800;font-size:38px;color:{NAVY};letter-spacing:-.02em">{t}</div></div>''')
    return out
def facebook():
    chips=[('Team',1),('Competition',1),('Players',1),('Transfers',0),('Academy',1),('Stadium',0)]
    pos=[(60,40),(60,40)]*3
    items=''
    for t,sel in chips:
        bg=GOLD if sel else '#fff'
        chk=f'<span style="width:30px;height:30px;color:{NAVY}">{fi("check-circle")}</span>' if sel else ''
        items+=f'<div style="white-space:nowrap;display:flex;gap:12px;align-items:center;height:70px;padding:0 30px;border-radius:35px;background:{bg};border:2px solid {"transparent" if sel else "rgba(18,27,51,.14)"};font-weight:800;font-size:32px;color:{NAVY};box-shadow:0 14px 30px rgba(18,27,51,.10)">{chk}{t}</div>'
    out=box(60,36,800,200,f'<div style="display:flex;flex-wrap:wrap;gap:20px 18px">{items}</div>')
    card=box(60,270,500,240,f'''<div style="width:100%;height:100%;background:{NAVY};border-radius:34px;padding:30px;color:#fff;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 30px 60px rgba(18,27,51,.25)">
<div style="font-weight:800;font-size:32px;line-height:1.15">Why did you like this post?</div>
<div style="display:flex;gap:14px">{''.join(f'<div style="height:56px;padding:0 22px;border-radius:28px;background:rgba(255,255,255,.12);display:flex;align-items:center;font-weight:700;font-size:24px">{t}</div>' for t in ('Relevant','Funny','Team'))}</div></div>''')
    sl=box(610,300,260,180,f'''<div style="width:100%;height:100%;background:#fff;border-radius:34px;padding:26px;border:2px solid rgba(18,27,51,.08);box-shadow:0 24px 50px rgba(18,27,51,.10);display:flex;flex-direction:column;justify-content:space-between">
<div style="display:flex;justify-content:space-between;font-weight:800;font-size:22px;color:#55617a;letter-spacing:.06em"><span>LESS</span><span>MORE</span></div>
<div style="position:relative;height:12px;border-radius:6px;background:#e3e8f2"><div style="position:absolute;left:0;top:0;bottom:0;width:70%;border-radius:6px;background:{GOLD}"></div><div style="position:absolute;left:70%;top:-12px;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:{NAVY}"></div></div>
<div style="font-weight:800;font-size:28px;color:{NAVY}">See more of this</div></div>''')
    return out+card+sl
def meta():
    tiers=[('Business','briefcase',250,230,0),('Creator','star',300,300,1),('AI','sparkle',250,370,0)]
    out=''
    x=56
    for t,ic,w,h,hl in [('Business','users',230,270,0),('Creator','star',250,350,0),('AI tools','sparkle',270,430,1)]:
        y=520-h-20
        bg=NAVY if hl else '#fff'; col='#fff' if hl else NAVY; accent=GOLD
        rows=''.join(f'<div style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;color:{accent}">{fi("check-circle")}</span>{line(int(w*0.5),9,"rgba(255,255,255,.35)" if hl else "#d5dbe8")}</div>' for _ in range(3 if h>300 else 2))
        out+=box(x,y,w,h,f'''<div style="width:100%;height:100%;background:{bg};border-radius:34px;padding:26px;color:{col};box-shadow:0 30px 60px rgba(18,27,51,{.28 if hl else .12});border:{"3px solid "+GOLD if hl else "2px solid rgba(18,27,51,.08)"};display:flex;flex-direction:column;justify-content:space-between">
<div><div style="width:64px;height:64px;border-radius:20px;background:{GOLD if hl else NAVY};padding:15px;color:{NAVY if hl else GOLD}">{fi(ic)}</div><div style="margin-top:18px;font-weight:800;font-size:34px;letter-spacing:-.02em">{t}</div></div>
<div style="display:flex;flex-direction:column;gap:12px">{rows}</div></div>''')
        x+=w+36
    return out
ILL={'tiktok':tiktok,'reels':reels,'mosseri':mosseri,'facebook':facebook,'meta':meta}

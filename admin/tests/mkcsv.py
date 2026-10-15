import csv, sys, random
random.seed(4)
H = ["external_id","published_at","embed","url","format","title","sport","competition","club","platform","entity"]
tt = lambda h,i: f'<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@{h}/video/{i}" data-video-id="{i}"><section><a href="https://www.tiktok.com/@{h}/video/{i}"></a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>'
ig = lambda i: f'<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/{i}" data-instgrm-captioned></blockquote>'
xx = lambda h,i: f'<blockquote class="twitter-tweet"><a href="https://twitter.com/{h}/status/{i}#m"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'
yt = lambda i: f"<iframe width='560' height='315' src='https://www.youtube.com/embed/{i}' frameborder='0' allowfullscreen></iframe>"
data = [
 ["7696230470383668502","2026-10-13T19:04:58.000Z",tt("realmadrid","7696230470383668502"),"https://www.tiktok.com/@realmadrid/video/7696230470383668502","Video","🤩 Dressed to impress. @Louis Vuitton","Football","LaLiga,Champions League","Real Madrid","TikTok","Clubs"],
 ["7696155919335427360","2026-10-13T14:15:41.000Z",tt("realmadrid","7696155919335427360"),"https://www.tiktok.com/@realmadrid/video/7696155919335427360","Video","⚽️⚔️🧤 #RealMadrid #RMCity #Goals","Football","LaLiga,Champions League","Real Madrid","TikTok","Clubs"],
 ["2110111919889609020","2026-10-13 20:54:20",xx("FCBarcelona_cat","2110111919889609020"),"https://twitter.com/FCBarcelona_cat/status/2110111919889609020","Images","A L'INFERN TAMBÉ S'HI GUANYA! 🔥","Football","LaLiga","FC Barcelona","X","Clubs"],
 ["2110151280656031846","2026-10-13 23:30:44",xx("FCBarcelona_cat","2110151280656031846"),"https://twitter.com/FCBarcelona_cat/status/2110151280656031846","Video","Milers de quilòmetres per moments com aquest 🫶","Football","LaLiga","FC Barcelona","X","Clubs"],
 ["pie8P6zK_O4","2026-10-12 23:17:42",yt("pie8P6zK_O4"),"https://www.youtube.com/watch?v=pie8P6zK_O4","Video","🔥 MATCH PREVIEW: GALATASARAY vs FC BARCELONA🔥| UEFA CHAMPIONS LEAGUE 26/27","Football","LaLiga","FC Barcelona","YouTube","Clubs"],
 ["75N26Ef-XeI","2026-10-12 22:00:25",yt("75N26Ef-XeI"),"https://www.youtube.com/watch?v=75N26Ef-XeI","Video","There was no angle here 📐 #fcbarcelona #shorts","Football","LaLiga","FC Barcelona","YouTube","Clubs"],
 ["DecugScijpN","2026-10-13T00:00:00.000Z",ig("DecugScijpN"),"https://www.instagram.com/p/DecugScijpN/","carousel","@GrudaBrajan’s strike gives @RBLeipzig the win! 🙌","football","Bundesliga","RB Leipzig","Instagram","Clubs"],
 ["DecDzRYmlgN","2026-10-13T23:36:00Z",ig("DecDzRYmlgN"),"https://www.instagram.com/p/DecDzRYmlgN/","Images","Unsere Startelf gegen Kosovo! 💥 #GemeinsamÖSTERREICH","Football","","Austria","Instagram","Clubs"],
 ["7696306110281698580","2026-10-13T23:58:00Z",tt("raptors","7696306110281698580"),"","Video","YEAHHH KAWHI 👌 #raptors #nba #preseason","Basketball","NBA","Toronto Raptors","TikTok","Clubs"],
 ["7696301432814800159","2026-10-13T23:40:00Z",tt("ufc","7696301432814800159"),"","Video","Ouch 😬 #ufc #mma #dwcs","Martial Arts","UFC","","TikTok","Competitions"],
 ["I-ASOBAL-1","2026-10-11T18:30:00Z",ig("DeASOBAL01"),"https://www.instagram.com/p/DeASOBAL01/","Reel","Parada de l'any 🧤 #LigaAsobal","Handball","Liga Asobal","Fraikin BM Granollers","Instagram","Clubs"],
 ["I-ASOBAL-2","2026-10-11T19:10:00Z",ig("DeASOBAL02"),"https://www.instagram.com/p/DeASOBAL02/","Reel","","Handball","Liga Asobal","Barça Handbol","Instagram","Clubs"],
 ["I-NO-EMBED","2026-10-11T10:00:00Z","","https://www.instagram.com/p/NOEMBED/","Images","Row without embed","Football","LaLiga","Sevilla FC","Instagram","Clubs"],
 ["I-BAD-DATE","yesterday",ig("BADDATE"),"","Images","Row with a broken date","Football","LaLiga","Sevilla FC","Instagram","Clubs"],
 ["7696230470383668502","2026-10-13T19:04:58.000Z",tt("realmadrid","7696230470383668502"),"https://www.tiktok.com/@realmadrid/video/7696230470383668502","Video","🤩 Dressed to impress (last copy wins)","Football","LaLiga,Champions League","Real Madrid","TikTok","Clubs"],
]
for i in range(15):
    d = random.choice(["10","11","12","13"])
    data.append([f"IGX{i:04d}",f"2026-10-{d}T{random.randint(8,22):02d}:{random.randint(0,59):02d}:00Z",ig(f"IGX{i:04d}"),f"https://www.instagram.com/p/IGX{i:04d}/",random.choice(["Images","Carousel","Reel"]),f"Matchday post #{i} 🔴🔵",random.choice(["Football","Basketball"]),random.choice(["LaLiga","Premier League","Serie A","NBA"]),random.choice(["FC Barcelona","Arsenal","AC Milan","Boston Celtics"]),"Instagram",random.choice(["Clubs","Media"])])
out = sys.argv[1]
with open(out,"w",newline="",encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\r\n"); w.writerow(H); w.writerows(data)
print(len(data))

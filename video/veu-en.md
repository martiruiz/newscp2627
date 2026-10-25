# Veu en off (EN) — per generar a ElevenLabs

**Com generar-la**
- **Un fitxer per escena**: `01.mp3` … `09.mp3` (MP3 44.1 kHz o WAV). Així cada escena encaixa amb la seva animació i, si una frase no t'agrada, només regeneres aquella.
- **Veu**: masculina o femenina, anglès neutre (americà o britànic), to de tràiler de producte: segura, propera, amb energia continguda. Evita veus de locutor de ràdio o massa dramàtiques.
- **Ajustos de partida**: Stability ~45 %, Similarity ~75 %, Style ~20 %, Speaker boost activat. Si sona plana, baixa Stability; si canvia de to entre escenes, puja-la.
- Fes servir **la mateixa veu i els mateixos ajustos** per a les 9 escenes.
- Les pauses: els punts suspensius i els salts de línia ja marquen el ritme. Si el teu model accepta `<break time="0.6s" />`, el pots afegir on hi ha ⏸.
- Durada objectiu de cada escena entre parèntesis. Si una surt més llarga, no passa res: ajusto l'animació a l'àudio.

---

**01 — El problema** (≈6 s)
Every club is fighting for the same feed. ⏸
Matchday… signings… sponsors… every single week.

**02 — L'abans** (≈5 s)
And finding what works still means hours of scrolling… ⏸ and guessing.

**03 — El canvi** (≈2 s, curt i sec)
Not anymore.

**04 — La prova** (≈12 s)
The best clubs, competitions and brands in the world… in one place. ⏸
Over five hundred thousand posts, from more than seven hundred and seventy clubs and a hundred and ten competitions… growing every day.

**05 — El cercador** (≈11 s)
Just ask for what you need… ⏸ "signing reels that went viral"… ⏸
and get the posts that actually worked.

**06 — L'anàlisi d'IA** (≈12 s)
Then see why they work. ⏸
AI breaks down the hook, the format and the timing… ⏸
and shows you how to make it yours.

**07 — El Content Plan** (≈9 s)
Drag the best ideas into your Content Plan. ⏸
Your whole week… ready in minutes.

**08 — Per què el necessites** (≈7 s, més lent, amb pes)
Less guessing. ⏸ More ideas that work. ⏸
This is how sports social teams get ahead.

**09 — Tancament** (≈6 s)
Sports Content Playbook. ⏸
The playbook every sports social team needs. ⏸
Try it free.

---

Quan els tinguis, deixa els 9 fitxers a `video/audio/` (ja existeix la carpeta `video/`). Jo en mesuro la durada, hi ajusto les animacions i genero els subtítols en castellà sincronitzats.

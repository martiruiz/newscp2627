-- Content hub (admin/content.html): calendar, scripts and video production status for the social + web content plan.
-- Only admins can read or change it (nothing public). Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Needs public.is_admin() (admin-content.sql). Re-running is safe: the table is created if missing and the plan is loaded only for ids not present yet.

create table if not exists public.content_items (
  id          text primary key,                 -- C001…
  pub_date    date not null,
  day_name    text,
  week        int,
  network     text not null,
  account     text,
  vertical    text,
  format      text,
  production  text,
  topic       text not null,
  source      text,
  cta         text,
  utm         text,
  stage       text not null default 'Per generar',
  due         date,                              -- draft must be reviewed before this date
  note        text,
  owner       text,
  script      text,
  link        text,                              -- audio / video / document (path on the SSD or URL)
  comment     text,                              -- feedback for the content team (Claude)
  updated_at  timestamptz not null default now()
);

alter table public.content_items enable row level security;
drop policy if exists "Admins manage content items" on public.content_items;
create policy "Admins manage content items" on public.content_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.content_items to authenticated;
create index if not exists content_items_date_idx on public.content_items (pub_date, network);

insert into public.content_items (id, pub_date, day_name, week, network, account, vertical, format, production, topic, source, cta, utm, stage, due, note, owner, script) values
($q$C001$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V0 · Novetats de plataformes$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Instagram prova un inici centrat en Reels: què significa per a un club.$q$, $q$Social News d'SCP (SocialGeek News, 8/10)$q$, $q$Llegir l'article a Social News$q$, $q$in-20261026-v0$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C002$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Women's football on social media: why English and Spanish clubs play different games.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261026-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C003$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Per què he creat Sports Content Playbook: el problema real d'un community manager esportiu$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261026-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Si llevas las redes de un club, esto te va a sonar.

DESARROLLO
Cada semana tienes que publicar, y cada semana te preguntas qué publicar.

Las ideas están repartidas entre TikTok, Instagram y YouTube, y nadie te explica por qué un contenido funciona.

LECCIÓN
Por eso he creado Sports Content Playbook.

Un sitio donde encuentras contenido deportivo de referencia, entiendes por qué funciona y lo adaptas a tu club.

[RECURSO] Pantalla de la Content Library (grabación de pantalla)

PREGUNTA
¿De dónde sacas tú las ideas cada semana?

CTA
Sígueme: cada día te enseño cómo se construye esto.$q$),
($q$C004$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Instagram prova un inici centrat en Reels (reutilitza el carrusel d'Instagram).$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261026-v1$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C005$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club. Menciona el calendari de dates (lead magnet #1).$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261026-v18$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C006$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Instagram prova un inici centrat en Reels, en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261026-v1$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, $q$GANCHO
Instagram is testing a home screen that opens on Reels.
[RECURSO] Captura de la notícia a Social News amb el titular visible

DESARROLLO
It's a test, not a launch.
Reels fill the first tab, Stories sit above, and sound plays by default.
Your followers' feed is one swipe away.
[RECURSO] Text a pantalla: «Test, not official»

LECCIÓN
If your club only posts lineups and final scores as static graphics, make a vertical video version.
Strong first seconds, and audio made to be heard.
[RECURSO] Alineació estàtica convertida en vídeo vertical (maqueta pròpia)

PREGUNTA
What would your lineup look like as a 10-second video?

CTA
Full breakdown for sports teams on Social News. Link in bio.$q$),
($q$C007$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261026-v20$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C008$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261026-v10$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C009$q$, $q$2026-10-26$q$::date, $q$Dilluns$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261026-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C010$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V0 · Novetats de plataformes$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Els 4 senyals d'Instagram (Mosseri) i què canviar al club.$q$, $q$Social News d'SCP (1/10)$q$, $q$Reservar demo$q$, $q$in-20261027-v0$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C011$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: From one-off clips to series: the episodic shift in sports social media trends.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261027-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C012$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$La Content Library en 30 s: què trobes i com ho filtres$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261027-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Imagina todos los posts deportivos que funcionan, en un solo sitio.

DESARROLLO
Eso es la Content Library de Sports Content Playbook.

Filtras por deporte, por club, por competición, por formato y por plataforma.

[RECURSO] Grabación de pantalla: aplicar dos filtros en la Content Library

Abres un post y ves el original.

[RECURSO] Grabación de pantalla: abrir un post de referencia

LECCIÓN
Dejas de buscar ideas a ciegas y empiezas por lo que ya funciona en tu deporte.

PREGUNTA
¿Cuánto tiempo pierdes cada semana buscando qué publicar?

CTA
Reserva una demo y te la enseño.

[VERIFICAR] Que los filtros nombrados existen tal cual en la pantalla.$q$),
($q$C013$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V2 · Adapta'l en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Els 4 senyals d'Instagram en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261027-v2$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, $q$GANCHO
Four signals decide what Instagram shows.
[RECURSO] Títol animat «4 signals» amb els quatre números entrant un a un

DESARROLLO
One. Interaction rate matters more than raw views or likes.
Two. The feed stays roughly chronological, so timing counts.
Three. Original content is prioritised over reposts.
Four. Small accounts can be tested with people who don't follow them.
[RECURSO] Una icona per senyal, amb text curt a pantalla

LECCIÓN
For a club, that means kick-off, half-time and full-time posts, and more footage nobody else has.
[RECURSO] Vestidor, túnel i entrenament com a «contingut original»

IDEA DE CONTENIDO
Test a new format with Trial Reels before it goes on your main feed.

PREGUNTA
Which format would you test first?

CTA
Full breakdown on Social News. Link in bio.$q$),
($q$C014$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261027-v10$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C015$q$, $q$2026-10-27$q$::date, $q$Dimarts$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261027-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C016$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V0 · Sèries de contingut$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$De clips solts a sèries: Cubs i Chiefs i com ho prova un club petit.$q$, $q$Blog SCP (19/10)$q$, $q$Seguir @sportscontentplaybook$q$, $q$in-20261028-v0$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C017$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: From schedule drop to tip-off: social media ideas for sports teams from the NBA build-up.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261028-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C018$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Anàlisi amb IA: hook, format i angle d'un post$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261028-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Ver un post no basta: hay que entender por qué funciona.

DESARROLLO
En SCP, cada contenido lleva un análisis con IA.

Te dice cuál es el gancho, qué formato usa y qué ángulo cuenta.

[RECURSO] Grabación de pantalla: abrir el análisis de un contenido

Y lo más útil: cómo adaptarlo a tu club.

LECCIÓN
Copiar un post no sirve. Entender su estructura, sí.

PREGUNTA
¿Sabrías decir en una frase por qué funcionó el último post de tu club?

CTA
Sígueme: cada día te enseño cómo se construye esto.

[VERIFICAR] Qué campos aparecen hoy en el análisis (hook, formato, ángulo, recursos visuales) y nombrar solo los que existen.$q$),
($q$C019$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V5 · Novetats / Social News$q$, $q$Post de text + imatge$q$, $q$Text + imatge$q$, $q$La notícia de plataformes més rellevant de la setmana i què en pot fer un club.$q$, $q$Social News d'SCP$q$, $q$Llegir a Social News$q$, $q$li-20261028-v5$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C020$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V15 · Martí a càmera (reutilitzat)$q$, $q$Reel (clip de 30 s)$q$, $q$Reutilitza el clip de Martí$q$, $q$Reutilitza el clip del dia de Martí a LinkedIn (mateix gravat).$q$, $q$Clip de Martí$q$, $q$Seguir$q$, $q$ti-20261028-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Depèn del gravat de Martí.$q$, $q$Martí grava; Claude escriu el guió$q$, null),
($q$C021$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261028-v20$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C022$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261028-v10$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C023$q$, $q$2026-10-28$q$::date, $q$Dimecres$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261028-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C024$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V5 · Novetats de plataformes$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$TikTok permet repostejar comentaris: la comunitat com a palanca de creixement.$q$, $q$Social News d'SCP (22/10)$q$, $q$Newsletter (link in bio)$q$, $q$in-20261029-v5$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C025$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: One match, many feeds: football social media content ideas from the ISL's YouTube start.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261029-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C026$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Guardats i col·leccions: no perdis cap idea$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261029-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Verificar que la funció esmentada és disponible abans de gravar.$q$, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
La mejor idea del mes se pierde en una captura de pantalla.

DESARROLLO
En SCP guardas un contenido con un clic.

Lo organizas en colecciones: por tema, por campaña o por deporte.

[RECURSO] Grabación de pantalla: guardar un post y añadirlo a una colección

Y cuando toca publicar, vuelves a la colección y ahí está.

LECCIÓN
Una idea que no se guarda bien es una idea que no se usa.

PREGUNTA
¿Dónde guardas tú las ideas que ves?

CTA
Sígueme y lo vemos paso a paso.

[VERIFICAR] Que "guardar" y "colecciones" están disponibles en el plan actual.$q$),
($q$C027$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$TikTok permet repostejar comentaris, en 30 s.$q$, $q$Social News / viral del dia$q$, $q$Seguir$q$, $q$ti-20261029-v9$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, $q$GANCHO
On TikTok, a single comment can now be a post.
[RECURSO] Captura del titular i animació d'un comentari que surt del vídeo

DESARROLLO
Users can repost one comment without sharing the original video.
Replies can reach people who never saw the clip.
For a club, community management becomes a growth lever.

LECCIÓN
A sharp reply or a great fan comment can travel on its own.
[RECURSO] El comentari es converteix en targeta pròpia

IDEA DE CONTENIDO
Ask a question or a prediction in your caption, then amplify the best fan answer.

PREGUNTA
Who answers your comments during a match?

CTA
The weekly digest of changes like this goes out every Monday. Newsletter, link in bio.$q$),
($q$C028$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261029-v10$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C029$q$, $q$2026-10-29$q$::date, $q$Dijous$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261029-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C030$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V7 · Lead magnet$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Promoció del Sports Content Calendar 2026–27 (lead magnet #1).$q$, $q$Lead magnet #1 (fet)$q$, $q$Descarregar el calendari (landing)$q$, $q$in-20261030-v7$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, $q$Depèn que la landing sigui en directe (PR #3 + SQL).$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C031$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Sports Social Media Trends: YouTube Shorts now rewards original content.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261030-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C032$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$De la idea al pla: planificar la setmana de continguts$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261030-v15$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Verificar que la funció esmentada és disponible abans de gravar.$q$, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Tener ideas no es lo mismo que tener un plan.

DESARROLLO
Con SCP pasas de un contenido guardado a una semana planificada.

[RECURSO] Grabación de pantalla: la planificación editorial con una semana llena

Ves de un vistazo qué publicas y cuándo.

LECCIÓN
El plan es lo que convierte la inspiración en publicaciones.

PREGUNTA
¿Tienes ahora mismo la semana que viene planificada?

CTA
Reserva una demo.

[VERIFICAR] Estado real de la planificación editorial. Si todavía está en desarrollo, grabar este clip como "lo que viene" y decirlo así.$q$),
($q$C033$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V7 · Recurs gratuït$q$, $q$Post de text + imatge/PDF$q$, $q$Text + imatge$q$, $q$Recurs de la setmana: Lead magnet #1: Sports Content Calendar 2026–27.$q$, $q$Lead magnets$q$, $q$Descarregar el recurs$q$, $q$li-20261030-v7$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C034$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V16 · Anàlisi diari$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Anàlisi d'un contingut esportiu del dia: gancho, format, angle, lliçó.$q$, $q$Contingut viral del dia$q$, $q$Seguir$q$, $q$ti-20261030-v16$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, $q$GANCHO
One Short reached 1.1 million views.
[RECURSO] Número gran animat «1.1M» sobre fons fosc

DESARROLLO
It showed a craftsman lettering a player's name on a Barcelona shirt.
According to vidIQ, that was around nine times the channel's usual performance.
On 1 October, YouTube confirmed that Shorts will prioritise original content.
[RECURSO] Captura de l'article amb el titular visible

LECCIÓN
The pattern is access: the kit room, the training ground, the player's voice.
[RECURSO] Tres icones: kit room, camp d'entrenament, veu del jugador

IDEA DE CONTENIDO
What can only your club film this week?

PREGUNTA
Do you have a process video waiting to be shot?

CTA
Full article on the Sports Content Playbook blog. Link in bio.$q$),
($q$C035$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261030-v20$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C036$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261030-v10$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C037$q$, $q$2026-10-30$q$::date, $q$Divendres$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261030-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C038$q$, $q$2026-10-31$q$::date, $q$Dissabte$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How top clubs turned Halloween into a content playground (Halloween).$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261031-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C039$q$, $q$2026-10-31$q$::date, $q$Dissabte$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261031-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C040$q$, $q$2026-11-01$q$::date, $q$Diumenge$q$, 1, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Why Nike won the World Cup marketing battle after the films were released.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261101-v14$q$, $q$Esborrany fet$q$, $q$2026-10-25$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C041$q$, $q$2026-11-01$q$::date, $q$Diumenge$q$, 1, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261101-v19$q$, $q$Per generar$q$, $q$2026-10-25$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C042$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V1 · Autòpsia de post$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Un post real de la Content Library: hook, format, angle, per què funciona (dades observades, no causalitat) i com adaptar-lo.$q$, $q$Content Library d'SCP (post + anàlisi IA)$q$, $q$Reservar demo$q$, $q$in-20261102-v1$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal triar el post i la seva anàlisi a la base de dades.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C043$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How the Tour de France turns cities into global brands.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261102-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Hi ha 42 articles al blog; només 5 són nous des del 15/10: s'usa l'arxiu. Títols a verificar amb el blog.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C044$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Com construeixo un SaaS esportiu: el procés d'un emprenedor, setmana a setmana$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261102-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Esta semana he tomado una decisión que cambia el producto.

DESARROLLO
[TU EJEMPLO] Qué he hecho esta semana en SCP.

[TU EJEMPLO] Qué decisión he tomado.

[TU EJEMPLO] Por qué.

LECCIÓN
[TU EJEMPLO] Lo que he aprendido de esa decisión.

PREGUNTA
¿Tú qué cambiarías primero en tu producto o en tu club?

CTA
Sígueme y te cuento el próximo paso la semana que viene.$q$),
($q$C045$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Reutilitza el carrusel d'Instagram del dilluns.$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261102-v1$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C046$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club. Menciona el lead magnet #2 de divendres.$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261102-v18$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C047$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Versió curta de l'autòpsia del dia (mateix post que Instagram/LinkedIn).$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261102-v1$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C048$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261102-v20$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C049$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261102-v10$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C050$q$, $q$2026-11-02$q$::date, $q$Dilluns$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261102-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C051$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V2 · Adapta'l a la teva mida$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Una mateixa idea adaptada a tres mides: club gran, club mitjà, club petit/amateur (esports diferents cada setmana).$q$, $q$Content Library d'SCP$q$, $q$Reservar demo$q$, $q$in-20261103-v2$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C052$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Inter Milan's masterclass in storytelling-driven reels.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261103-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C053$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$El que mirem en un post abans de copiar-lo$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261103-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Antes de copiar un post, hazte tres preguntas.

DESARROLLO
Una: ¿por qué funcionó? ¿Emoción, acceso o momento?

Dos: ¿encaja con mi club?

Tres: ¿puedo hacerlo con los recursos que tengo?

[RECURSO] Tres tarjetas animadas con las tres preguntas

LECCIÓN
Si una respuesta es no, adapta la idea. No la copies.

PREGUNTA
¿Cuál de las tres sueles saltarte?

CTA
Sígueme: cada día analizo contenido deportivo.$q$),
($q$C054$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V2 · Adapta'l en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Una idea, tres mides de club, en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261103-v2$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C055$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261103-v10$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C056$q$, $q$2026-11-03$q$::date, $q$Dimarts$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261103-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C057$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V4 · Dos clubs, mateix moment$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Dos clubs, un mateix moment, dues narratives (comparació de com ho van comunicar).$q$, $q$Content Library (2 posts del mateix moment)$q$, $q$Seguir$q$, $q$in-20261104-v4$q$, $q$Depèn de dades$q$, $q$2026-10-29$q$::date, $q$Cal trobar dos posts comparables.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C058$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Why sports memes dominate TikTok.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261104-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C059$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Autòpsia d'un post: 3 lliçons (lligat a la de dilluns)$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261104-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Un post. Tres lecciones.

DESARROLLO
[DATO] El post analizado el lunes 2/11 en la Content Library.

[RECURSO] Captura del post

Lo observado: [DATO].

El patrón: [DATO].

LECCIÓN
Cómo adaptarlo a un club pequeño: [DATO].

PREGUNTA
¿Qué lección te llevas?

CTA
Reserva una demo y mira el análisis completo.$q$),
($q$C060$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V5 · Novetats / Social News$q$, $q$Post de text + imatge$q$, $q$Text + imatge$q$, $q$La notícia de plataformes més rellevant de la setmana i què en pot fer un club.$q$, $q$Social News d'SCP$q$, $q$Llegir a Social News$q$, $q$li-20261104-v5$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C061$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V15 · Martí a càmera (reutilitzat)$q$, $q$Reel (clip de 30 s)$q$, $q$Reutilitza el clip de Martí$q$, $q$Reutilitza el clip del dia de Martí a LinkedIn (mateix gravat).$q$, $q$Clip de Martí$q$, $q$Seguir$q$, $q$ti-20261104-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Depèn del gravat de Martí.$q$, $q$Martí grava; Claude escriu el guió$q$, null),
($q$C062$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261104-v20$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C063$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261104-v10$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C064$q$, $q$2026-11-04$q$::date, $q$Dimecres$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261104-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C065$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V6 · Mètriques per competició$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Mètriques d'equips d'una competició (ex.: engagement dels clubs d'una lliga) amb la font.$q$, $q$Dades de la Content Library (consulta)$q$, $q$Veure la Content Library$q$, $q$in-20261105-v6$q$, $q$Depèn de dades$q$, $q$2026-10-29$q$::date, $q$Cal consultar les dades reals; no s'inventa cap xifra.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C066$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: The rise of Reels and TikToks vs YouTube Shorts.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261105-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C067$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Adapta-ho a la teva mida: club gran vs. club petit$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261105-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
La misma idea, tres tamaños de club.

DESARROLLO
Club grande: producción y recursos.

Club mediano: un formato repetible.

Club pequeño: el móvil, un reto y constancia.

Ejemplo: pasar de un clip suelto a una serie. Meta lleva desde junio probando una función de series en Reels y los Chicago Cubs publicaron una serie de 17 episodios solo en TikTok.

[RECURSO] Captura del artículo de series del blog de SCP

LECCIÓN
No hace falta el presupuesto de los Cubs. Hace falta repetir un formato.

PREGUNTA
¿Qué formato podría repetir tu club cada semana?

CTA
Tienes el artículo completo en el blog. Enlace en la bio.$q$),
($q$C068$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$El contingut esportiu viral de la setmana i per què funciona (només el que es pot observar).$q$, $q$Social News / viral del dia$q$, $q$Seguir$q$, $q$ti-20261105-v9$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C069$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261105-v10$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C070$q$, $q$2026-11-05$q$::date, $q$Dijous$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261105-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C071$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V7 · Lead magnet$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Promoció del lead magnet #2: Pack d'idees per moment (partit, fitxatge, patrocinadors, aniversaris).$q$, $q$Lead magnet #2 (el genera Claude)$q$, $q$Descarregar el recurs (landing)$q$, $q$in-20261106-v7$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$El PDF s'ha de tenir fet el dilluns 02/11.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C072$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Copy ideas for every moment in sports content (lead magnet #2).$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261106-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C073$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Els recursos gratuïts d'SCP: el calendari i el pack d'idees$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261106-v15$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Hay 28 fechas este curso que merecen un post.

DESARROLLO
El Sports Content Calendar 2026-27 recoge 28 fechas, en 8 meses y 9 deportes.

Cada fecha lleva un ángulo de contenido.

[RECURSO] Portada y página interior del calendario

LECCIÓN
Con él planificas el curso en una tarde en vez de improvisar cada semana.

PREGUNTA
¿Qué fecha de tu deporte no quieres perderte?

CTA
Descárgalo gratis. Enlace en la bio.

[VERIFICAR] Que la landing está en directo y el enlace funciona.$q$),
($q$C074$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V7 · Recurs gratuït$q$, $q$Post de text + imatge/PDF$q$, $q$Text + imatge$q$, $q$Recurs de la setmana: Lead magnet #2: pack d'idees per moment.$q$, $q$Lead magnets$q$, $q$Descarregar el recurs$q$, $q$li-20261106-v7$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C075$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V3 · Analitzem el teu post$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Anàlisi en 30 s d'un post enviat per un club o creador.$q$, $q$Post enviat per un seguidor$q$, $q$Enviar-nos el teu post$q$, $q$ti-20261106-v3$q$, $q$Depèn de dades$q$, $q$2026-10-29$q$::date, $q$Cal rebre posts amb permís per analitzar-los.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C076$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261106-v20$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C077$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261106-v10$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C078$q$, $q$2026-11-06$q$::date, $q$Divendres$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261106-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C079$q$, $q$2026-11-07$q$::date, $q$Dissabte$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: The new playing field of vertical video in sport.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261107-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C080$q$, $q$2026-11-07$q$::date, $q$Dissabte$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261107-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C081$q$, $q$2026-11-08$q$::date, $q$Diumenge$q$, 2, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Winning loud, losing smart: Super Bowl Instagram tactics.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261108-v14$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C082$q$, $q$2026-11-08$q$::date, $q$Diumenge$q$, 2, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261108-v19$q$, $q$Per generar$q$, $q$2026-10-29$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C083$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V1 · Autòpsia de post$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Un post real de la Content Library: hook, format, angle, per què funciona (dades observades, no causalitat) i com adaptar-lo.$q$, $q$Content Library d'SCP (post + anàlisi IA)$q$, $q$Reservar demo$q$, $q$in-20261109-v1$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal triar el post i la seva anàlisi a la base de dades.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C084$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Two French rugby clubs, one digital mindset.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261109-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C085$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Què he après de les 5 notícies de plataformes d'aquesta setmana$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261109-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Esta semana han cambiado tres cosas en las redes que afectan a tu club.

DESARROLLO
[DATO] Noticia 1 de Social News.

[DATO] Noticia 2.

[DATO] Noticia 3.

LECCIÓN
Qué hacer el lunes: [DATO].

PREGUNTA
¿Cuál de las tres te afecta más?

CTA
Todo en Social News. Enlace en la bio.$q$),
($q$C086$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Reutilitza el carrusel d'Instagram del dilluns.$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261109-v1$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C087$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club.$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261109-v18$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C088$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Versió curta de l'autòpsia del dia (mateix post que Instagram/LinkedIn).$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261109-v1$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C089$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261109-v20$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C090$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261109-v10$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C091$q$, $q$2026-11-09$q$::date, $q$Dilluns$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261109-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C092$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V2 · Adapta'l a la teva mida$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Una mateixa idea adaptada a tres mides: club gran, club mitjà, club petit/amateur (esports diferents cada setmana).$q$, $q$Content Library d'SCP$q$, $q$Reservar demo$q$, $q$in-20261110-v2$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C093$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Inside Six Nations Instagram strategy.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261110-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C094$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Cómo decidimos qué entra en la Content Library$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261110-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
No todo lo viral merece entrar en una biblioteca.

DESARROLLO
Cada contenido pasa por 10 criterios de selección.

Impacto demostrable, originalidad, calidad técnica, tendencias globales y valor práctico, entre otros.

[RECURSO] Captura de la página de criterios de selección

LECCIÓN
Calidad antes que volumen: una biblioteca útil es la que filtra por ti.

PREGUNTA
¿Cuántos de esos criterios aplicas tú cuando eliges qué copiar?

CTA
Sígueme y te enseño cómo lo aplicamos.

Fuente: página de criterios del sitio (10 criterios). No añadir criterios que no estén ahí.$q$),
($q$C095$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V2 · Adapta'l en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Una idea, tres mides de club, en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261110-v2$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C096$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261110-v10$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C097$q$, $q$2026-11-10$q$::date, $q$Dimarts$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261110-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C098$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Reel d'actualitat: el contingut esportiu viral de la setmana i per què ha funcionat.$q$, $q$Social News / viral de la setmana$q$, $q$Seguir$q$, $q$in-20261111-v9$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C099$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How the Seattle Seahawks turned draft calls into high-impact content.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261111-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C100$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Per què un equip petit pot competir amb contingut (exemple del sector)$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261111-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
El contenido que más crece no es el más caro.

DESARROLLO
Un Short de un artesano rotulando un nombre en una camiseta del FC Barcelona llegó a 1,1 millones de vistas.

Según vidIQ, fue unas nueve veces el rendimiento habitual del canal.

[RECURSO] Número "1,1 M" animado y captura del artículo

LECCIÓN
El patrón es el acceso: el taller, el vestuario, el entrenamiento, la voz del jugador.

Eso también lo puede filmar un club pequeño.

PREGUNTA
¿Qué puede filmar tu club que nadie más puede?

CTA
Tienes el artículo en el blog. Enlace en la bio.

Fuente: blog SCP del 15/10.$q$),
($q$C101$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V5 · Novetats / Social News$q$, $q$Post de text + imatge$q$, $q$Text + imatge$q$, $q$La notícia de plataformes més rellevant de la setmana i què en pot fer un club.$q$, $q$Social News d'SCP$q$, $q$Llegir a Social News$q$, $q$li-20261111-v5$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C102$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V15 · Martí a càmera (reutilitzat)$q$, $q$Reel (clip de 30 s)$q$, $q$Reutilitza el clip de Martí$q$, $q$Reutilitza el clip del dia de Martí a LinkedIn (mateix gravat).$q$, $q$Clip de Martí$q$, $q$Seguir$q$, $q$ti-20261111-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Depèn del gravat de Martí.$q$, $q$Martí grava; Claude escriu el guió$q$, null),
($q$C103$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261111-v20$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C104$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261111-v10$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C105$q$, $q$2026-11-11$q$::date, $q$Dimecres$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261111-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C106$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V10 · Ofertes de feina$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Les ofertes de feina de la setmana en màrqueting digital esportiu.$q$, $q$Jobs d'SCP (admin)$q$, $q$Veure totes a Jobs$q$, $q$in-20261112-v10$q$, $q$Depèn de dades$q$, $q$2026-11-05$q$::date, $q$Cal que hi hagi ofertes publicades a Jobs.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C107$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How MotoGP turned the Catalan GP into a local-first digital experience.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261112-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C108$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Les ofertes de feina del sector: què demanen ara$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261112-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Estas son las ofertas de marketing deportivo de la semana.

DESARROLLO
[DATO] 2-3 ofertas reales publicadas en Jobs de SCP.

[RECURSO] Captura de Jobs

LECCIÓN
Qué piden en común: [DATO].

PREGUNTA
¿Qué te falta para la que más te gusta?

CTA
Todas las ofertas en Jobs. Enlace en la bio.$q$),
($q$C109$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$El contingut esportiu viral de la setmana i per què funciona (només el que es pot observar).$q$, $q$Social News / viral del dia$q$, $q$Seguir$q$, $q$ti-20261112-v9$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C110$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261112-v10$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C111$q$, $q$2026-11-12$q$::date, $q$Dijous$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261112-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C112$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V7 · Lead magnet$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Promoció del lead magnet #3: Pack de prompts per a community managers.$q$, $q$Lead magnet #3 (el genera Claude)$q$, $q$Descarregar el recurs (landing)$q$, $q$in-20261113-v7$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$El PDF s'ha de tenir fet el dilluns 09/11.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C113$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: The AI revolution in clubs (lead magnet #3).$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261113-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C114$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Els prompts que fem servir amb IA per al contingut esportiu$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261113-v15$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
El prompt que uso para sacar ideas de contenido de un club.

DESARROLLO
[DATO] El prompt real del pack (cuando exista el lead magnet #3).

[RECURSO] Pantalla con el prompt

Le das tres datos: deporte, tamaño del club y recursos.

Y lo revisas siempre antes de publicar.

LECCIÓN
La IA da la idea. Tú pones el criterio.

PREGUNTA
¿Qué le pedirías primero a la IA para tu club?

CTA
Descarga el pack. Enlace en la bio.$q$),
($q$C115$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V7 · Recurs gratuït$q$, $q$Post de text + imatge/PDF$q$, $q$Text + imatge$q$, $q$Recurs de la setmana: Lead magnet #3: prompts per a community managers.$q$, $q$Lead magnets$q$, $q$Descarregar el recurs$q$, $q$li-20261113-v7$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C116$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V16 · Anàlisi diari$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Anàlisi d'un contingut esportiu del dia: gancho, format, angle, lliçó.$q$, $q$Contingut viral del dia$q$, $q$Seguir$q$, $q$ti-20261113-v16$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C117$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261113-v20$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C118$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261113-v10$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C119$q$, $q$2026-11-13$q$::date, $q$Divendres$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261113-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C120$q$, $q$2026-11-14$q$::date, $q$Dissabte$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How Atlético de Madrid turned a gameday graphic into a sponsorship asset.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261114-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C121$q$, $q$2026-11-14$q$::date, $q$Dissabte$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261114-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C122$q$, $q$2026-11-15$q$::date, $q$Diumenge$q$, 3, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Chicago Bulls' localization strategy in the global era.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261115-v14$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C123$q$, $q$2026-11-15$q$::date, $q$Diumenge$q$, 3, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261115-v19$q$, $q$Per generar$q$, $q$2026-11-05$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C124$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V1 · Autòpsia de post$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Un post real de la Content Library: hook, format, angle, per què funciona (dades observades, no causalitat) i com adaptar-lo.$q$, $q$Content Library d'SCP (post + anàlisi IA)$q$, $q$Reservar demo$q$, $q$in-20261116-v1$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal triar el post i la seva anàlisi a la base de dades.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C125$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Beyond the pitch: turning premium experiences into powerful content.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261116-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C126$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Un error que he comès construint SCP (i què he canviat)$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261116-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Me equivoqué con esto y lo he cambiado.

DESARROLLO
[TU EJEMPLO] Qué hice.

[TU EJEMPLO] Qué pasó.

[TU EJEMPLO] Qué he cambiado.

LECCIÓN
[TU EJEMPLO] Lo que haría distinto hoy.

PREGUNTA
¿Cuál es el último error del que has aprendido algo?

CTA
Sígueme: aquí enseño también lo que sale mal.$q$),
($q$C127$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Reutilitza el carrusel d'Instagram del dilluns.$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261116-v1$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C128$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club.$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261116-v18$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C129$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Versió curta de l'autòpsia del dia (mateix post que Instagram/LinkedIn).$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261116-v1$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C130$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261116-v20$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C131$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261116-v10$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C132$q$, $q$2026-11-16$q$::date, $q$Dilluns$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261116-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C133$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V2 · Adapta'l a la teva mida$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Una mateixa idea adaptada a tres mides: club gran, club mitjà, club petit/amateur (esports diferents cada setmana).$q$, $q$Content Library d'SCP$q$, $q$Reservar demo$q$, $q$in-20261117-v2$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C134$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: From numbers to narrative: visualizing Champions League qualification.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261117-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C135$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Com decidim què entra a la Content Library$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261117-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
El jueves analizo cinco posts en directo.

DESARROLLO
Vamos a ver por qué funcionan y cómo adaptarlos a un club.

Puedes mandarme el tuyo y lo analizamos en directo.

[DATO] Día y hora confirmados (propuesta: jueves 19/11).

LECCIÓN
Un post analizado delante de otros se entiende mucho mejor.

PREGUNTA
¿Qué post de tu club quieres que mire?

CTA
Envíame tu post por mensaje y entra al directo.

[VERIFICAR] Confirmar fecha, hora y plataforma del directo antes de grabar.$q$),
($q$C136$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V2 · Adapta'l en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Una idea, tres mides de club, en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261117-v2$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C137$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261117-v10$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C138$q$, $q$2026-11-17$q$::date, $q$Dimarts$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261117-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C139$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V8 · Motion graphics$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Reel animat (motion graphics) que explica una funció o un concepte: 'què és l'anàlisi amb IA d'un post'.$q$, $q$Producte SCP (verificar la funció)$q$, $q$Reservar demo$q$, $q$in-20261118-v8$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Verificar abans que la funció descrita és disponible.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C140$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How an unknown footballer became one of the World Cup's biggest social media stories.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261118-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C141$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Dos clubs, un moment, dues narratives (exemple de la setmana)$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261118-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Mismo partido, dos formas de contarlo.

DESARROLLO
[DATO] Post del club A y qué hizo.

[RECURSO] Captura del post A

[DATO] Post del club B y qué hizo.

[RECURSO] Captura del post B

LECCIÓN
[DATO] Qué se puede aprender de la comparación.

PREGUNTA
¿Cuál habrías publicado tú?

CTA
Sígueme.$q$),
($q$C142$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V5 · Novetats / Social News$q$, $q$Post de text + imatge$q$, $q$Text + imatge$q$, $q$La notícia de plataformes més rellevant de la setmana i què en pot fer un club.$q$, $q$Social News d'SCP$q$, $q$Llegir a Social News$q$, $q$li-20261118-v5$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C143$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V15 · Martí a càmera (reutilitzat)$q$, $q$Reel (clip de 30 s)$q$, $q$Reutilitza el clip de Martí$q$, $q$Reutilitza el clip del dia de Martí a LinkedIn (mateix gravat).$q$, $q$Clip de Martí$q$, $q$Seguir$q$, $q$ti-20261118-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Depèn del gravat de Martí.$q$, $q$Martí grava; Claude escriu el guió$q$, null),
($q$C144$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261118-v20$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C145$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261118-v10$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C146$q$, $q$2026-11-18$q$::date, $q$Dimecres$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261118-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C147$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V11 · Creadors destacats$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Creadors de contingut esportiu destacats del moment i què en podem aprendre.$q$, $q$Content Library (creadors)$q$, $q$Seguir$q$, $q$in-20261119-v11$q$, $q$Depèn de dades$q$, $q$2026-11-12$q$::date, $q$Cal confirmar que podem citar els creadors.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C148$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How the Dakar Rally became social media storytelling.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261119-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C149$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Com mesurem el contingut sense atribuir-li causalitat falsa$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261119-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Que un post funcione no prueba por qué funcionó.

DESARROLLO
Primero, el dato observado: vistas, reacciones, comparación con la media del canal.

Después, la hipótesis: por qué creemos que pasó.

Ejemplo: el Short de la camiseta rindió unas nueve veces la media del canal, según vidIQ. Eso es un dato. Por qué fue así, es una hipótesis.

LECCIÓN
No atribuyas causas a una métrica sin evidencia.

PREGUNTA
¿Comparas tus posts con la media de tu propio canal?

CTA
Sígueme: separo datos de hipótesis en cada análisis.$q$),
($q$C150$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V17 · Directe mensual$q$, $q$Directe LinkedIn$q$, $q$Martí en directe$q$, $q$Analitzem 5 posts en directe (data proposta).$q$, $q$Posts enviats / de la Content Library$q$, $q$Reservar demo$q$, $q$li-20261119-v17$q$, $q$Cal confirmar$q$, $q$2026-11-12$q$::date, $q$Cal que Martí confirmi data i hora; recollir els 5 posts abans.$q$, $q$Martí en directe$q$, $q$GANCHO
Que un post funcione no prueba por qué funcionó.

DESARROLLO
Primero, el dato observado: vistas, reacciones, comparación con la media del canal.

Después, la hipótesis: por qué creemos que pasó.

Ejemplo: el Short de la camiseta rindió unas nueve veces la media del canal, según vidIQ. Eso es un dato. Por qué fue así, es una hipótesis.

LECCIÓN
No atribuyas causas a una métrica sin evidencia.

PREGUNTA
¿Comparas tus posts con la media de tu propio canal?

CTA
Sígueme: separo datos de hipótesis en cada análisis.$q$),
($q$C151$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$El contingut esportiu viral de la setmana i per què funciona (només el que es pot observar).$q$, $q$Social News / viral del dia$q$, $q$Seguir$q$, $q$ti-20261119-v9$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C152$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261119-v10$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C153$q$, $q$2026-11-19$q$::date, $q$Dijous$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261119-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C154$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V7 · Lead magnet$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Promoció del lead magnet #4: Rotatiu: pack d'anàlisis de posts.$q$, $q$Lead magnet #4 (el genera Claude)$q$, $q$Descarregar el recurs (landing)$q$, $q$in-20261120-v7$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$El PDF s'ha de tenir fet el dilluns 16/11.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C155$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: What's new in Sports Content Playbook: smarter search, faster inspiration.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261120-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C156$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Directe de dijous: avís i què analitzarem$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261120-v15$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Cinco posts analizados en directo. Esto es lo que se repite.

DESARROLLO
[DATO] Los 5 posts en una línea cada uno.

LECCIÓN
[DATO] El patrón.

[DATO] Una idea para tu club.

PREGUNTA
¿Te reconoces en alguno?

CTA
Reserva una demo.$q$),
($q$C157$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V7 · Recurs gratuït$q$, $q$Post de text + imatge/PDF$q$, $q$Text + imatge$q$, $q$Recurs de la setmana: Lead magnet #4: pack d'anàlisis.$q$, $q$Lead magnets$q$, $q$Descarregar el recurs$q$, $q$li-20261120-v7$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C158$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V3 · Analitzem el teu post$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Anàlisi en 30 s d'un post enviat per un club o creador.$q$, $q$Post enviat per un seguidor$q$, $q$Enviar-nos el teu post$q$, $q$ti-20261120-v3$q$, $q$Depèn de dades$q$, $q$2026-11-12$q$::date, $q$Cal rebre posts amb permís per analitzar-los.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C159$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261120-v20$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C160$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261120-v10$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C161$q$, $q$2026-11-20$q$::date, $q$Divendres$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261120-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C162$q$, $q$2026-11-21$q$::date, $q$Dissabte$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How the EuroLeague balanced information and emotion during the Final Four.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261121-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C163$q$, $q$2026-11-21$q$::date, $q$Dissabte$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261121-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C164$q$, $q$2026-11-22$q$::date, $q$Diumenge$q$, 4, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Milano Cortina 2026: balanced storytelling on the road to the Winter Games.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261122-v14$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C165$q$, $q$2026-11-22$q$::date, $q$Diumenge$q$, 4, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261122-v19$q$, $q$Per generar$q$, $q$2026-11-12$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C166$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V1 · Autòpsia de post$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Un post real de la Content Library: hook, format, angle, per què funciona (dades observades, no causalitat) i com adaptar-lo.$q$, $q$Content Library d'SCP (post + anàlisi IA)$q$, $q$Reservar demo$q$, $q$in-20261123-v1$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal triar el post i la seva anàlisi a la base de dades.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C167$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Two finals, two narratives: how Barça and Madrid communicated the Supercopa.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261123-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C168$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Què toca publicar aquest Black Friday al sector esportiu$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261123-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
El Black Friday no pide un banner. Pide un clip.

DESARROLLO
Una acción con patrocinador, mostrada como un clip de 15 segundos del producto en uso.

Una sola oferta limitada, no varias.

Y preparada con tiempo, no el mismo día.

[RECURSO] Maqueta de un clip de 15 s (nuestra, no de un club real)

LECCIÓN
Una oferta clara y un clip bien hecho valen más que cinco banners.

PREGUNTA
¿Qué oferta enseñarías tú en un clip de 15 segundos?

CTA
Tienes más ideas de fechas en el calendario gratuito. Enlace en la bio.$q$),
($q$C169$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Reutilitza el carrusel d'Instagram del dilluns.$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261123-v1$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C170$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club.$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261123-v18$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C171$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Versió curta de l'autòpsia del dia (mateix post que Instagram/LinkedIn).$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261123-v1$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C172$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261123-v20$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C173$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261123-v10$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C174$q$, $q$2026-11-23$q$::date, $q$Dilluns$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261123-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C175$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V2 · Adapta'l a la teva mida$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Una mateixa idea adaptada a tres mides: club gran, club mitjà, club petit/amateur (esports diferents cada setmana).$q$, $q$Content Library d'SCP$q$, $q$Reservar demo$q$, $q$in-20261124-v2$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C176$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: What sports teams got right and wrong on Mother's Day content.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261124-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C177$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Novetats d'SCP d'aquest mes (només el que ja funciona)$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261124-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Verificar que la funció esmentada és disponible abans de gravar.$q$, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Esto es lo nuevo en Sports Content Playbook este mes.

DESARROLLO
[DATO] Novedad 1 (solo si ya está disponible).

[RECURSO] Grabación de pantalla de la novedad 1

[DATO] Novedad 2.

[RECURSO] Grabación de pantalla de la novedad 2

[DATO] Novedad 3.

LECCIÓN
Para quién sirve cada una: [DATO] (club pequeño, agencia, federación...).

PREGUNTA
¿Cuál te gustaría probar primero?

CTA
Entra y pruébalo.

[VERIFICAR] Reunir el registro de cambios del producto la semana del 16/11. Solo funciones ya disponibles.$q$),
($q$C178$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V2 · Adapta'l en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Una idea, tres mides de club, en 30 s.$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261124-v2$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C179$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261124-v10$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C180$q$, $q$2026-11-24$q$::date, $q$Dimarts$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261124-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C181$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V4 · Dos clubs, mateix moment$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Dos clubs, un mateix moment, dues narratives (segona edició, altre esport).$q$, $q$Content Library (2 posts del mateix moment)$q$, $q$Seguir$q$, $q$in-20261125-v4$q$, $q$Depèn de dades$q$, $q$2026-11-19$q$::date, $q$Cal trobar dos posts comparables.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C182$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Why the best sponsored content creates the moment instead of interrupting it.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261125-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C183$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Resum del mes: què hem après publicant cada dia$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261125-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Un mes publicando cada día. Esto es lo que ha pasado.

DESARROLLO
[DATO] Cifras reales de las cuentas de noviembre (solo las que podamos demostrar).

[DATO] Qué formato ha funcionado más.

LECCIÓN
[DATO] Qué cambiamos.

PREGUNTA
¿Qué formato probarías tú?

CTA
Sígueme.$q$),
($q$C184$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V5 · Novetats / Social News$q$, $q$Post de text + imatge$q$, $q$Text + imatge$q$, $q$La notícia de plataformes més rellevant de la setmana i què en pot fer un club.$q$, $q$Social News d'SCP$q$, $q$Llegir a Social News$q$, $q$li-20261125-v5$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C185$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V15 · Martí a càmera (reutilitzat)$q$, $q$Reel (clip de 30 s)$q$, $q$Reutilitza el clip de Martí$q$, $q$Reutilitza el clip del dia de Martí a LinkedIn (mateix gravat).$q$, $q$Clip de Martí$q$, $q$Seguir$q$, $q$ti-20261125-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Depèn del gravat de Martí.$q$, $q$Martí grava; Claude escriu el guió$q$, null),
($q$C186$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261125-v20$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C187$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261125-v10$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C188$q$, $q$2026-11-25$q$::date, $q$Dimecres$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261125-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C189$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V13 · Novetats d'SCP (mensual)$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Novetats del producte d'aquest mes.$q$, $q$Registre de canvis del producte (cal reunir-lo)$q$, $q$Provar SCP$q$, $q$in-20261126-v13$q$, $q$Cal confirmar$q$, $q$2026-11-19$q$::date, $q$Només funcions realment disponibles; confirmar-les amb el codi.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C190$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Powerful songs for pre-match stories (free gameday playlist).$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261126-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C191$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$El que els clubs fan bé en contingut quan hi ha patrocinadors$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261126-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
El mejor contenido patrocinado no interrumpe: crea el momento.

DESARROLLO
[DATO] Lección del artículo del blog sobre patrocinio (leerlo antes de grabar; hoy no hay artículo en el blog que lo cubra, ver nota).

[RECURSO] Captura del artículo

LECCIÓN
[DATO] Cómo aplicarlo a un club.

PREGUNTA
¿Tu patrocinador aparece en tu contenido o solo en un banner?

CTA
Sígueme.

Nota: en el blog local solo hay 3 artículos (series, NBA, YouTube Shorts). Si no se publica el de patrocinio antes, este clip se sustituye por el del NBA (ver más abajo).$q$),
($q$C192$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V9 · Reel d'actualitat viral$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$El contingut esportiu viral de la setmana i per què funciona (només el que es pot observar).$q$, $q$Social News / viral del dia$q$, $q$Seguir$q$, $q$ti-20261126-v9$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C193$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261126-v10$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C194$q$, $q$2026-11-26$q$::date, $q$Dijous$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261126-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C195$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V12 · Moment del calendari$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Black Friday per a clubs: una acció amb patrocinador mostrada com a clip de producte en ús de 15 s, no com a banner.$q$, $q$Sports Content Calendar 2026–27 (data fixa 27/11)$q$, $q$Descarregar el calendari$q$, $q$in-20261127-v12$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Idea del calendari; sense xifres de rendiment.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C196$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: The smart way to keep sponsors visible without ruining the content (Black Friday).$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261127-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C197$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Pla del mes que ve: què provarem$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261127-v15$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Esto es lo que vamos a probar en diciembre.

DESARROLLO
[TU EJEMPLO] Prueba 1 y por qué.

[TU EJEMPLO] Prueba 2 y por qué.

[TU EJEMPLO] Prueba 3 y por qué.

LECCIÓN
Probar poco, medir y decidir.

PREGUNTA
¿Qué vas a probar tú en diciembre?

CTA
Sígueme y te cuento los resultados.$q$),
($q$C198$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V7 · Recurs gratuït$q$, $q$Post de text + imatge/PDF$q$, $q$Text + imatge$q$, $q$Recurs de la setmana: Black Friday per a clubs (idea del calendari) amb enllaç al calendari.$q$, $q$Lead magnets$q$, $q$Descarregar el recurs$q$, $q$li-20261127-v7$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C199$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V16 · Anàlisi diari$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Anàlisi d'un contingut esportiu del dia: gancho, format, angle, lliçó.$q$, $q$Contingut viral del dia$q$, $q$Seguir$q$, $q$ti-20261127-v16$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C200$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261127-v20$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C201$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261127-v10$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C202$q$, $q$2026-11-27$q$::date, $q$Divendres$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261127-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C203$q$, $q$2026-11-28$q$::date, $q$Dissabte$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: Never lose a great idea again: your personalized library.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261128-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C204$q$, $q$2026-11-28$q$::date, $q$Dissabte$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261128-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C205$q$, $q$2026-11-29$q$::date, $q$Diumenge$q$, 5, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How the Tour de France turns cities into global brands.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261129-v14$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C206$q$, $q$2026-11-29$q$::date, $q$Diumenge$q$, 5, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261129-v19$q$, $q$Per generar$q$, $q$2026-11-19$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null),
($q$C207$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Instagram$q$, $q$@sportscontentplaybook (EN)$q$, $q$V1 · Autòpsia de post$q$, $q$Carrusel$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Un post real de la Content Library: hook, format, angle, per què funciona (dades observades, no causalitat) i com adaptar-lo.$q$, $q$Content Library d'SCP (post + anàlisi IA)$q$, $q$Reservar demo$q$, $q$in-20261130-v1$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, $q$Cal triar el post i la seva anàlisi a la base de dades.$q$, $q$Claude genera, Martí revisa$q$, null),
($q$C208$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Instagram Stories$q$, $q$@sportscontentplaybook (EN)$q$, $q$V14 · Blog a Stories$q$, $q$Story (1 frame + sticker d'enllaç)$q$, $q$Story (disseny)$q$, $q$Article del dia: How football clubs turned Spotify Wrapped into a social media moment.$q$, $q$Blog d'SCP (article existent)$q$, $q$Obrir l'article (sticker)$q$, $q$in-20261130-v14$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C209$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$LinkedIn Martí$q$, $q$Martí Ruiz (ES/CA)$q$, $q$V15 · Martí a càmera (sèrie 30 s)$q$, $q$Vídeo vertical 30 s$q$, $q$Martí a càmera (dia de gravació)$q$, $q$Obrim desembre: què hem après del primer mes de contingut diari$q$, $q$Experiència de Martí / producte SCP$q$, $q$Un sol CTA: seguir o demo segons el dia$q$, $q$li-20261130-v15$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, null, $q$Martí grava (lot setmanal); Claude escriu el guió$q$, $q$GANCHO
Treinta días de contenido diario. Tres lecciones.

DESARROLLO
[DATO] Lección 1, con dato real.

[DATO] Lección 2, con dato real.

[DATO] Lección 3, con dato real.

LECCIÓN
Qué mantenemos y qué dejamos: [DATO].

PREGUNTA
¿Qué mantendrías tú?

CTA
Sígueme: en diciembre seguimos.$q$),
($q$C210$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$LinkedIn pàgina$q$, $q$Pàgina SCP (EN)$q$, $q$V1 · Autòpsia de post (carrusel)$q$, $q$Carrusel (PDF)$q$, $q$Carrusel (disseny, sense veu)$q$, $q$Reutilitza el carrusel d'Instagram del dilluns.$q$, $q$Mateix material que Instagram$q$, $q$Reservar demo$q$, $q$li-20261130-v1$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C211$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Newsletter$q$, $q$Resend · SCP$q$, $q$V18 · Newsletter setmanal$q$, $q$Email (08:00)$q$, $q$Automàtic + revisió$q$, $q$Els millors posts de la setmana, per què han funcionat i una idea per al teu club.$q$, $q$Pipeline de newsletter (esborrany generat automàticament)$q$, $q$Reservar demo o llegir el blog (un de sol)$q$, $q$ne-20261130-v18$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, $q$08:00 dilluns; l'esborrany es revisa el diumenge. Avui l'enviament requereix prémer Enviar (risc conegut).$q$, $q$Automàtic + revisió humana$q$, null),
($q$C212$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$TikTok$q$, $q$TikTok SCP (EN)$q$, $q$V1 · Autòpsia en 30 s$q$, $q$Reel$q$, $q$Motion graphics + veu en off de Martí (ElevenLabs)$q$, $q$Versió curta de l'autòpsia del dia (mateix post que Instagram/LinkedIn).$q$, $q$Mateix material que Instagram$q$, $q$Seguir$q$, $q$ti-20261130-v1$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, null, $q$Claude genera, Martí revisa$q$, null),
($q$C213$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Web · Blog$q$, $q$sportscontentplaybook.com/blog$q$, $q$V20 · Article de blog$q$, $q$Article$q$, $q$Web (automàtic o editorial)$q$, $q$Article nou basat en una notícia o un cas verificable, amb fonts citades.$q$, $q$Social News / fonts originals$q$, $q$—$q$, $q$web-20261130-v20$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, $q$Ritme proposat 3/setmana (no diari): no hi ha flux automàtic d'articles i cadascun necessita font i revisió.$q$, $q$Claude escriu, Martí revisa$q$, null),
($q$C214$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Web · Jobs$q$, $q$sportscontentplaybook.com/jobs.html$q$, $q$V10 · Oferta de feina$q$, $q$Oferta$q$, $q$Web (automàtic o editorial)$q$, $q$Afegir/revisar com a mínim una oferta de màrqueting digital esportiu.$q$, $q$Cerca manual d'ofertes (admin Jobs)$q$, $q$—$q$, $q$web-20261130-v10$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, $q$Cal confirmar com s'alimenten les ofertes.$q$, $q$Martí/equip + Claude proposa ofertes$q$, null),
($q$C215$q$, $q$2026-11-30$q$::date, $q$Dilluns$q$, 6, $q$Web · Social News$q$, $q$sportscontentplaybook.com/news$q$, $q$V19 · Social News$q$, $q$Notícia$q$, $q$Web (automàtic o editorial)$q$, $q$Notícia del dia sobre plataformes i contingut esportiu.$q$, $q$Fonts d'actualitat (cadena existent)$q$, $q$—$q$, $q$web-20261130-v19$q$, $q$Per generar$q$, $q$2026-11-26$q$::date, $q$Avui el workflow s'executa cada ~30 h, no cada dia: cal canviar-ho (cost d'IA).$q$, $q$Automàtic + revisió$q$, null)
on conflict (id) do nothing;

-- Reel scripts rewritten (2026-10-26): no section labels, a hook that stops the scroll, open loops, the value at the end.
-- Visual cues and checks move to the note. Applies to the Content hub (content_items).
begin;

update public.content_items set script = $s$Hay un problema que tiene todo el que lleva las redes de un club.
Y casi nadie lo dice en voz alta.
Cada lunes, la misma pregunta: ¿qué publico esta semana?
Abres TikTok. Instagram. YouTube.
Ves cosas que funcionan.
Pero nadie te dice por qué funcionan.
Y sin el porqué, copias. Y copiar no funciona.
Por eso he creado Sports Content Playbook:
contenido deportivo que funciona, el porqué de cada uno y cómo adaptarlo a tu club.
Sígueme: cada día te enseño cómo lo construyo.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla de la Content Library al final.$n$), updated_at = now() where id = 'C003';

update public.content_items set script = $s$Instagram is testing an app that doesn't open on your feed.
And if your club only posts graphics, that's bad news.
In the test, the first tab is Reels.
Stories on top. Sound on by default.
Your followers' feed? One swipe away.
It's a test, not a launch.
But it shows where Instagram is going.
So here's the move:
turn the lineup graphic you post every matchday into a 10-second vertical video.
Strong first second. Audio made to be heard.
Full breakdown for sports teams on Social News. Link in bio.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del titular a Social News; text «Test, not official»; alineació estàtica convertida en vídeo vertical (maqueta pròpia).$n$), updated_at = now() where id = 'C006';

update public.content_items set script = $s$Mbappé marcó los dos goles.
Pero el vídeo más visto del Madrid no es suyo.
Ni siquiera es un gol.
78,8 millones de reproducciones en nueve horas.
Más de ocho veces lo que hace la cuenta normalmente.
270.000 compartidos.
Es un regate de Diomande. Unos segundos. Sin música épica.
Y el segundo más visto tampoco es un gol: el cartel de matchday. 28 millones, firmado por HP.
¿Por qué?
Nadie comparte un gol del rival.
Pero todo el mundo comparte la jugada que le levanta del sofá.
El gol lo tiene todo el mundo. La jugada que no sale en el resumen es solo tuya.
Y el patrocinador no interrumpe: firma el momento.
Comenta MATCHDAY y te envío el checklist de 10 vídeos de partido que no son el gol.$s$, note = concat_ws(' · ', note, $n$Visuals (en orden): texto «78,8 M. Y no es un gol»; 01_clasico_grid_reels_realmadrid.png; 01_clasico_diomande_78.8M_views.png; 01_clasico_matchday_HP_28.2M_views.png.$n$), updated_at = now() where id = 'C216';

update public.content_items set script = $s$El vídeo más visto de la Serie Mundial no es una jugada.
Es un señor colocando una base.
4,6 millones de reproducciones.
Siete veces y media la media de la MLB.
Y solo 55.000 likes.
Eso es lo raro. Y es la clave.
Un operario prepara el campo antes del Game 2. Un texto: «Satisfying».
Este vídeo no se aplaude. Se mira. Y se vuelve a mirar.
El segundo más visto: el himno de Kylie Cantrall. 4,5 millones, en co-autoría con ella. Dos audiencias en un solo vídeo.
El partido empieza horas antes del primer lanzamiento.
El ritual también es contenido.
¿Quién lo graba en tu estadio antes de que se abran las puertas?
Comenta BACKSTAGE y te envío el checklist de vídeos de matchday.$s$, note = concat_ws(' · ', note, $n$Visuals (en orden): 02_worldseries_grid_reels_mlb.png; 02_worldseries_base_satisfying_4.6M_views.png; 02_worldseries_himno_kyliecantrall_4.5M_views.png.$n$), updated_at = now() where id = 'C217';

update public.content_items set script = $s$La NBA acaba de fichar a 500 jugadores.
Ninguno juega al baloncesto.
Son creadores de contenido, elegidos con ayuda de TikTok.
Y la liga les abre espacios propios en X y en TikTok.
¿Por qué haría eso la NBA?
Mirad su cuenta esta semana.
El vídeo más visto no es un mate.
Es Samuel, un niño imitando a un halcón en medio de la pista. 4,7 millones. Seis veces su media. En co-autoría con los Hawks.
El segundo: el tiro de Luka grabado desde la grada. 2,5 millones.
Ahí está la respuesta.
El plano de televisión lo tiene todo el mundo. El del aficionado, no.
La liga ya no compite con los creadores: los convierte en su red de distribución.
Comenta FANS y te envío el ranking de los Reels más vistos del fin de semana.$s$, note = concat_ws(' · ', note, $n$Visuals (en orden): texto «500 creadores. Una liga»; 03_nba_grid_reels_nba.png; 03_nba_hawks_samuel_4.7M_views.png; 03_nba_luka_angulo_2.5M_views.png.$n$), updated_at = now() where id = 'C218';

update public.content_items set script = $s$El jefe de Instagram ha dicho algo sobre la IA que cambia cómo deberías publicar.
Y no es lo que esperas.
Adam Mosseri: el contenido hecho con IA no pierde alcance por ser IA.
Lo que le preocupa es otra cosa: la IA que copia a los creadores.
Más etiquetas. Y una petición: que cada uno marque su contenido generado.
Pero lo interesante no es lo que dice. Es cómo lo dice.
Una serie: «Cómo funciona el ranking». Capítulo cuatro.
23 millones de reproducciones.
Él a cámara. Una idea por vídeo. Un número en el título.
Quien vio el tres, busca el cuatro.
La IA puede copiar tu formato. No puede copiar tu cara ni tu criterio.
Y una serie convierte a un espectador en un seguidor.
Comenta ALGORITMO y te envío las señales de ranking que explica Mosseri.$s$, note = concat_ws(' · ', note, $n$Visuals (en orden): texto «No penalizamos el contenido de IA por ser IA»; 04_instagram_grid_reels_mosseri.png; 04_instagram_mosseri_ranking_23M_views.png.$n$), updated_at = now() where id = 'C219';

update public.content_items set script = $s$Spotify paga la camiseta del Barça.
Y en el Clásico le dejó el pecho a otro.
En la camiseta no ponía Spotify. Ponía GOLF, la marca de Tyler, The Creator.
Por primera vez, Spotify da a un artista el control creativo total.
¿Una locura? Mirad los números.
«Recreando el look de Lamine»: 37,2 millones. 1,5 millones de likes.
Barça, Spotify, una creadora y la marca de un artista en un solo vídeo.
Esa misma semana, otro patrocinador hizo un quiz con Gemini: 6,7 millones.
Cinco veces menos.
Cuando la marca deja el protagonismo a la cultura, el vídeo deja de parecer un anuncio.
Y la gente lo comparte como si fuera suyo.
Comenta COLAB y te envío los 50 Reels deportivos analizados.$s$, note = concat_ws(' · ', note, $n$Visuals (en orden): texto «37,2 M. El patrocinador no sale delante»; 05_golfwang_grid_reels_fcbarcelona.png; 05_golfwang_lamine_look_37.2M_views.png; 05_golfwang_quiz_gemini_6.7M_views.png.$n$), updated_at = now() where id = 'C220';

update public.content_items set script = $s$Imagina todos los posts deportivos que funcionan, en un solo sitio.
Ahora deja que te enseñe lo que de verdad cambia.
Clubs, ligas y competiciones.
Filtras por deporte, por club, por formato o por plataforma.
Abres uno y ves el original.
Pero lo mejor no es encontrar ideas.
Es dejar de buscarlas a ciegas.
Empiezas cada semana por lo que ya funciona en tu deporte.
Es la Content Library de Sports Content Playbook. Reserva una demo y te la enseño.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla aplicando dos filtros; abrir un post de referencia. Verificar: que los filtros nombrados existen tal cual en pantalla.$n$), updated_at = now() where id = 'C012';

update public.content_items set script = $s$Four signals decide who sees your club's posts on Instagram.
And the fourth one is good news for small clubs.
One: interaction rate matters more than raw views or likes.
Two: the feed is roughly chronological, so timing counts.
Three: original content beats reposts.
Four: small accounts get tested with people who don't follow them yet.
For a club, that means posting at kick-off, half-time and full-time.
And filming what nobody else can: the dressing room, the tunnel, training.
Then test new formats with Trial Reels before they hit your main feed.
Full breakdown on Social News. Link in bio.$s$, note = concat_ws(' · ', note, $n$Visuals: títol «4 signals» amb els números entrant un a un; una icona per senyal; vestidor, túnel i entrenament.$n$), updated_at = now() where id = 'C013';

update public.content_items set script = $s$Puedes ver mil posts que funcionan y no aprender nada.
Te cuento por qué.
Ver un post no te dice qué lo hizo funcionar.
En SCP, cada contenido lleva un análisis con IA.
El gancho. El formato. El ángulo.
Y lo más útil: cómo adaptarlo a tu club.
Porque copiar un post no sirve.
Entender su estructura, sí.
Sígueme: cada día te enseño cómo se construye esto.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla abriendo el análisis de un contenido. Verificar: qué campos aparecen hoy en el análisis y nombrar solo los que existen.$n$), updated_at = now() where id = 'C018';

update public.content_items set script = $s$La mejor idea del mes está ahora mismo en tu carrete.
Perdida entre cientos de capturas de pantalla.
Y el día que la necesitas, no la encuentras.
En SCP la guardas con un clic.
La metes en una colección: por tema, por campaña o por deporte.
Y cuando toca publicar, está ahí.
Una idea que no se guarda bien es una idea que nunca se publica.
Sígueme y lo vemos paso a paso.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla guardando un post y añadiéndolo a una colección. Verificar: que guardar y colecciones están en el plan actual.$n$), updated_at = now() where id = 'C026';

update public.content_items set script = $s$On TikTok, a comment can now get more views than the video.
Here's how.
Users can repost a single comment, without sharing the original video.
So a reply can reach people who never saw the clip.
Which means whoever answers your comments during a match just became a growth channel.
A sharp reply, or a great fan comment, can travel on its own.
Try this: ask for a prediction in your caption, then repost the best fan answer.
Every Monday I send changes like this in the newsletter. Link in bio.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del titular; un comentari que surt del vídeo i es converteix en targeta pròpia.$n$), updated_at = now() where id = 'C027';

update public.content_items set script = $s$Tener cincuenta ideas guardadas no sirve de nada.
Y pasa en casi todos los clubs.
Las ideas no se publican solas.
Con SCP pasas de un contenido guardado a una semana planificada.
De un vistazo: qué publicas y cuándo.
El plan es lo que convierte la inspiración en publicaciones.
¿Tienes la semana que viene planificada? Reserva una demo.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla del Content Plan con una semana llena. Verificar: estado real del Content Plan antes de grabar.$n$), updated_at = now() where id = 'C032';

update public.content_items set script = $s$1.1 million views. No goals, no stars.
Just a man with a brush.
A craftsman lettering a player's name on a Barcelona shirt.
According to vidIQ, around nine times the channel's usual numbers.
And it isn't luck.
On 1 October, YouTube confirmed Shorts will prioritise original content.
The pattern is access: the kit room, the training ground, the player's voice.
Things only your club can film.
So what can only your club film this week?
Full article on the Sports Content Playbook blog. Link in bio.$s$, note = concat_ws(' · ', note, $n$Visuals: número gran «1.1M» sobre fons fosc; captura de l'article; tres icones: kit room, entrenament, veu del jugador.$n$), updated_at = now() where id = 'C034';

update public.content_items set script = $s$Esta semana he tomado una decisión que cambia el producto.
Y casi no la tomo.
[Qué he hecho esta semana en SCP]
[La decisión]
[Por qué dudaba]
[Lo que he aprendido]
Sígueme: la semana que viene te cuento qué ha pasado.$s$, updated_at = now() where id = 'C044';

update public.content_items set script = $s$Antes de copiar un post de otro club, hazte tres preguntas.
La tercera es la que más se salta.
Una: ¿por qué funcionó? ¿Emoción, acceso o momento?
Dos: ¿encaja con mi club?
Tres: ¿puedo hacerlo con lo que tengo?
Si alguna respuesta es no, no lo copies.
Adáptalo.
Sígueme: cada día analizo contenido deportivo.$s$, note = concat_ws(' · ', note, $n$Visuals: tres tarjetas animadas con las tres preguntas.$n$), updated_at = now() where id = 'C053';

update public.content_items set script = $s$Un solo post. Tres lecciones.
Y la última sirve a cualquier club, por pequeño que sea.
[El post analizado el lunes 2/11]
[Lección 1: lo observado]
[Lección 2: el patrón]
[Lección 3: cómo adaptarlo a un club pequeño]
Reserva una demo y mira el análisis completo.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del post.$n$), updated_at = now() where id = 'C059';

update public.content_items set script = $s$La misma idea funciona en un club de Primera y en el club de tu barrio.
Solo cambia una cosa.
Un club grande la hace con producción y recursos.
Uno mediano, con un formato que repite.
Uno pequeño, con un móvil, un reto y constancia.
Los Chicago Cubs publicaron una serie de 17 episodios solo en TikTok.
Y Meta lleva desde junio probando series en Reels.
No necesitas su presupuesto.
Necesitas repetir un formato.
El artículo completo, en el blog. Enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del artículo de series del blog de SCP.$n$), updated_at = now() where id = 'C067';

update public.content_items set script = $s$Hay 28 fechas este curso en las que tu club debería publicar algo.
¿Cuántas tienes apuntadas?
Las hemos reunido todas: 28 fechas, 8 meses, 9 deportes.
Cada una con un ángulo de contenido listo para usar.
Planificas el curso en una tarde.
Y dejas de improvisar cada semana.
Es el Sports Content Calendar 2026-27. Gratis, enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: portada y página interior del calendario. Verificar: que la landing está en directo y el enlace funciona.$n$), updated_at = now() where id = 'C073';

update public.content_items set script = $s$Esta semana han cambiado tres cosas en las redes.
Y la tercera afecta a tu club desde el lunes.
[Noticia 1 de Social News]
[Noticia 2]
[Noticia 3]
[Qué hacer el lunes]
Todo en Social News. Enlace en la bio.$s$, updated_at = now() where id = 'C085';

update public.content_items set script = $s$No todo lo viral entra en nuestra biblioteca.
Tenemos una lista para decidirlo.
Cada contenido pasa 10 criterios.
Impacto demostrable. Originalidad. Calidad técnica. Tendencias globales. Valor práctico. Y cinco más.
¿Por qué tan estrictos?
Porque una biblioteca útil no es la que tiene más posts.
Es la que filtra por ti.
Sígueme y te enseño cómo lo aplicamos.$s$, note = concat_ws(' · ', note, $n$Visuals: captura de la página de criterios de selección. Fuente: página de criterios del sitio (10 criterios); no añadir criterios que no estén ahí.$n$), updated_at = now() where id = 'C094';

update public.content_items set script = $s$El contenido que más crece no es el más caro.
Te lo demuestro con un pincel.
Un artesano rotulando un nombre en una camiseta del Barça.
1,1 millones de vistas en Shorts.
Según vidIQ, unas nueve veces lo normal del canal.
Sin estrellas. Sin goles. Sin presupuesto.
El patrón es el acceso: el taller, el vestuario, el entrenamiento, la voz del jugador.
Y eso también lo puede grabar un club pequeño.
El artículo, en el blog. Enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: número «1,1 M» animado y captura del artículo. Fuente: blog SCP del 15/10.$n$), updated_at = now() where id = 'C100';

update public.content_items set script = $s$Esto es lo que piden ahora las ofertas de marketing deportivo.
Y hay algo que se repite en casi todas.
[2-3 ofertas reales de Jobs de SCP]
[Lo que piden en común]
Todas las ofertas, en Jobs. Enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: captura de Jobs.$n$), updated_at = now() where id = 'C108';

update public.content_items set script = $s$Este es el prompt que uso para sacar ideas de contenido para un club.
Pero sin una cosa, no sirve.
[El prompt real del pack]
Le das tres datos: deporte, tamaño del club y recursos.
Y lo que falta es tu criterio.
La IA da la idea. Tú decides si se publica.
Descarga el pack. Enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: pantalla con el prompt.$n$), updated_at = now() where id = 'C114';

update public.content_items set script = $s$Me equivoqué construyendo SCP.
Y me costó [lo que costó].
[Qué hice]
[Qué pasó]
[Qué he cambiado]
[Lo que haría distinto hoy]
Sígueme: aquí enseño también lo que sale mal.$s$, updated_at = now() where id = 'C126';

update public.content_items set script = $s$El jueves analizo cinco posts en directo.
Y uno puede ser el tuyo.
Vemos por qué funcionan y cómo adaptarlos a un club.
Un post analizado delante de otros se entiende mucho mejor.
[Día y hora confirmados]
Mándame tu post por mensaje y entra al directo.$s$, note = concat_ws(' · ', note, $n$Verificar: fecha, hora y plataforma del directo antes de grabar.$n$), updated_at = now() where id = 'C135';

update public.content_items set script = $s$Mismo partido. Dos clubs. Dos historias opuestas.
Y solo una ha funcionado.
[Post del club A y qué hizo]
[Post del club B y qué hizo]
[Por qué uno funcionó más]
[Qué se aprende]
¿Cuál habrías publicado tú? Sígueme.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del post A y del post B.$n$), updated_at = now() where id = 'C141';

update public.content_items set script = $s$Tu post ha funcionado.
Y probablemente no sabes por qué.
Primero, el dato: vistas, reacciones y la media de tu propio canal.
Después, la hipótesis: por qué crees que pasó.
El Short de la camiseta del Barça rindió unas nueve veces la media del canal, según vidIQ.
Eso es un dato.
Por qué fue así, es una hipótesis.
Si las mezclas, repetirás lo que no era.
Sígueme: separo datos de hipótesis en cada análisis.$s$, updated_at = now() where id = 'C149';

update public.content_items set script = $s$Cinco posts analizados en directo.
Y los cinco tenían algo en común.
[Los 5 posts, una línea cada uno]
[El patrón]
[Una idea para tu club]
Reserva una demo.$s$, updated_at = now() where id = 'C156';

update public.content_items set script = $s$Este Black Friday, tu club no necesita un banner.
Necesita 15 segundos.
Un clip del producto en uso, con tu patrocinador.
Una sola oferta. Limitada.
Y preparada antes, no el mismo día.
Una oferta clara en un buen clip vale más que cinco banners.
Más fechas como esta en el calendario gratuito. Enlace en la bio.$s$, note = concat_ws(' · ', note, $n$Visuals: maqueta de un clip de 15 s (nuestra, no de un club real).$n$), updated_at = now() where id = 'C168';

update public.content_items set script = $s$Este mes hay [número] novedades en Sports Content Playbook.
Y la última es mi favorita.
[Novedad 1, solo si ya está disponible]
[Novedad 2]
[Novedad 3]
[Para quién sirve cada una]
Entra y pruébalo.$s$, note = concat_ws(' · ', note, $n$Visuals: grabación de pantalla de cada novedad. Verificar: registro de cambios de la semana del 16/11; solo funciones ya disponibles.$n$), updated_at = now() where id = 'C177';

update public.content_items set script = $s$Un mes publicando cada día.
Esto es lo que ha funcionado. Y lo que no.
[Cifras reales de noviembre, solo las demostrables]
[El formato que más ha funcionado]
[Qué cambiamos]
Sígueme.$s$, updated_at = now() where id = 'C183';

update public.content_items set script = $s$El mejor contenido patrocinado no parece un anuncio.
Y hay una razón.
[Lección del artículo de patrocinio]
[Cómo aplicarlo a un club]
¿Tu patrocinador sale en tu contenido o solo en un banner? Sígueme.$s$, note = concat_ws(' · ', note, $n$Visuals: captura del artículo. Si no se publica el artículo de patrocinio antes, este clip se sustituye por el de la NBA.$n$), updated_at = now() where id = 'C191';

update public.content_items set script = $s$En diciembre vamos a probar tres cosas.
La tercera es la más arriesgada.
[Prueba 1 y por qué]
[Prueba 2 y por qué]
[Prueba 3 y por qué]
Probar poco, medir y decidir.
Sígueme y te cuento los resultados.$s$, updated_at = now() where id = 'C197';

update public.content_items set script = $s$Treinta días de contenido diario.
Tres lecciones. Y una cosa que dejamos de hacer.
[Lección 1, con dato real]
[Lección 2, con dato real]
[Lección 3, con dato real]
[Qué mantenemos y qué dejamos]
Sígueme: en diciembre seguimos.$s$, updated_at = now() where id = 'C209';
commit;

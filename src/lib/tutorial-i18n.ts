import { type Locale } from "./i18n";

export interface TutorialT {
  badge: string;
  libraryBadge: string;
  stepLabel: (n: number, total: number) => string;
  prev: string;
  next: string;
  exploreNow: string;
  exploreLibrary: string;
  follow: string;
  // Dashboard steps
  dash: {
    s1: { title: string; desc: string };
    s2: { title: string; desc: string };
    s3: { title: string; desc: string };
    s4: { title: string; desc: string };
    s5: { title: string; desc: string };
    s6: { title: string; desc: string };
  };
  // Library steps
  lib: {
    s1:  { title: string; desc: string };
    s2:  { title: string; desc: string };
    s3:  { title: string; desc: string };
    s4:  { title: string; desc: string };
    s5:  { title: string; desc: string };
    s6:  { title: string; desc: string };
    s7:  { title: string; desc: string };
    s8:  { title: string; desc: string };
    s9:  { title: string; desc: string };
    s10: { title: string; desc: string };
    s11: { title: string; desc: string };
    s12: { title: string; desc: string };
    s13: { title: string; desc: string };
    s14: { title: string; desc: string };
    s15: { title: string; desc: string };
  };
}

const ca: TutorialT = {
  badge: "Tutorial",
  libraryBadge: "Tutorial Biblioteca",
  stepLabel: (n, t) => `Pas ${n} de ${t}`,
  prev: "← Anterior",
  next: "Següent →",
  exploreNow: "Explorar ara 🚀",
  exploreLibrary: "Explorar la biblioteca 🚀",
  follow: "Seguir",
  dash: {
    s1: { title: "Content Library", desc: "Aquí trobaràs totes les publicacions indexades de referència del món del contingut esportiu. Filtra per plataforma, esport, format o compte." },
    s2: { title: "Guardats", desc: "Desa les publicacions que t'inspiren en carpetes organitzades. Crea carpetes per projectes, campanyes o clients." },
    s3: { title: "Notícies", desc: "Segueix les últimes tendències del màrqueting esportiu i la comunicació digital. Articles seleccionats de les millors fonts del sector." },
    s4: { title: "Mètriques", desc: "Veu d'un cop d'ull quantes publicacions hi ha indexades, quant contingut has guardat i quina és la plataforma dominant. El tauler evoluciona amb tu." },
    s5: { title: "Comunitat WhatsApp", desc: "Uneix-te al grup de WhatsApp de SCP per connectar amb altres professionals del contingut esportiu, compartir estratègies i col·laborar en temps real." },
    s6: { title: "El teu perfil", desc: "Gestiona la teva informació personal, el pla de subscripció i les teves preferències de contingut. Accedeix des del menú lateral." },
  },
  lib: {
    s1:  { title: "Filtres laterals", desc: "El panell lateral esquerre conté tots els filtres disponibles per explorar la biblioteca. Pots combinar-los lliurement per trobar exactament el contingut que busques." },
    s2:  { title: "Cercador global", desc: "El cercador global et permet buscar per compte, tema o idea directament dins de tots els filtres. A mesura que escrius, apareixen suggeriments intel·ligents per aplicar el filtre correcte al moment." },
    s3:  { title: "Classificació", desc: "Els chips de classificació marquen publicacions destacades per la nostra cura editorial: Top Picks (millors peces), Replicable Ideas (idees adaptables) i Overperforming (contingut viral). Selecciona'n un per filtrar al moment." },
    s4:  { title: "Rang de dates", desc: "Filtra les publicacions per període de temps. Pots triar presets ràpids (última setmana, últim mes) o definir un rang personalitzat amb data d'inici i data de fi." },
    s5:  { title: "Esport", desc: "Selecciona un o més esports per veure únicament el contingut de la teva disciplina: futbol, bàsquet, pàdel, tennis, ciclisme i molts més. Busca per nom si la llista és llarga." },
    s6:  { title: "Tipus de publicador", desc: "Filtra per la categoria del compte: Club, Brand, Competition, Athlete, Creator o Media. Ideal per estudiar l'estratègia específica d'un tipus d'actor del sector." },
    s7:  { title: "Compte", desc: "Cerca publicacions d'un compte concret: un club, una marca, un atleta o un creador. El filtre es contextualitza automàticament segons l'esport i el tipus de publicador seleccionats." },
    s8:  { title: "Format", desc: "Selecciona el tipus de peça: Vídeo, Carrusel, Imatge, Reel o Story. Perfecte per analitzar quin format funciona millor en cada plataforma i esport." },
    s9:  { title: "Plataforma", desc: "Tria la xarxa social: Instagram, TikTok, YouTube, Twitter/X, LinkedIn o Facebook. Cadascuna té dinàmiques i formats propis; filtrar per plataforma t'ajuda a fer benchmarking real." },
    s10: { title: "Desa publicacions", desc: "Fes clic a la icona de marca de qualsevol publicació per desar-la. Des de la secció Guardats podràs organitzar-les en carpetes per projecte, client o campanya." },
    s11: { title: "Càrrega infinita", desc: "La biblioteca carrega automàticament més contingut en fer scroll cap avall. No hi ha paginació — el contingut flueix de manera contínua mentre explores la col·lecció." },
    s12: { title: "Benvinguts a SCP!", desc: "Ja coneixes tota la biblioteca. Segueix-nos a les nostres xarxes per estar al dia de les últimes actualitzacions, continguts exclusius i novetats de la comunitat." },
    s13: { title: "Collabs & Partnerships", desc: "Continguts creats en col·laboració amb marques, patrocinadors, clubs, esportistes o creadors. Ideal per aprendre com es gestionen les col·laboracions en el món del contingut esportiu." },
    s14: { title: "Merchandising", desc: "Continguts relacionats amb equipacions, productes oficials, col·leccions i promocions de venda. Descobreix com les entitats esportives comuniquen les seves línies de producte." },
    s15: { title: "Transfers", desc: "Continguts sobre fitxatges, renovacions, cessions, presentacions i sortides de jugadors. Analitza com es comuniquen els moviments de plantilla a les xarxes socials." },
  },
};

const es: TutorialT = {
  badge: "Tutorial",
  libraryBadge: "Tutorial Biblioteca",
  stepLabel: (n, t) => `Paso ${n} de ${t}`,
  prev: "← Anterior",
  next: "Siguiente →",
  exploreNow: "Explorar ahora 🚀",
  exploreLibrary: "Explorar la biblioteca 🚀",
  follow: "Seguir",
  dash: {
    s1: { title: "Content Library", desc: "Aquí encontrarás todas las publicaciones indexadas de referencia del mundo del contenido deportivo. Filtra por plataforma, deporte, formato o cuenta." },
    s2: { title: "Guardados", desc: "Guarda las publicaciones que te inspiran en carpetas organizadas. Crea carpetas por proyectos, campañas o clientes." },
    s3: { title: "Noticias", desc: "Sigue las últimas tendencias del marketing deportivo y la comunicación digital. Artículos seleccionados de las mejores fuentes del sector." },
    s4: { title: "Métricas", desc: "Ve de un vistazo cuántas publicaciones hay indexadas, cuánto contenido has guardado y cuál es la plataforma dominante. El panel evoluciona contigo." },
    s5: { title: "Comunidad WhatsApp", desc: "Únete al grupo de WhatsApp de SCP para conectar con otros profesionales del contenido deportivo, compartir estrategias y colaborar en tiempo real." },
    s6: { title: "Tu perfil", desc: "Gestiona tu información personal, el plan de suscripción y tus preferencias de contenido. Accede desde el menú lateral." },
  },
  lib: {
    s1:  { title: "Filtros laterales", desc: "El panel lateral izquierdo contiene todos los filtros disponibles para explorar la biblioteca. Puedes combinarlos libremente para encontrar exactamente el contenido que buscas." },
    s2:  { title: "Buscador global", desc: "El buscador global te permite buscar por cuenta, tema o idea directamente dentro de todos los filtros. A medida que escribes, aparecen sugerencias inteligentes para aplicar el filtro correcto al instante." },
    s3:  { title: "Clasificación", desc: "Los chips de clasificación marcan publicaciones destacadas por nuestra curación editorial: Top Picks (mejores piezas), Replicable Ideas (ideas adaptables) y Overperforming (contenido viral). Selecciona uno para filtrar al instante." },
    s4:  { title: "Rango de fechas", desc: "Filtra las publicaciones por período de tiempo. Puedes elegir presets rápidos (última semana, último mes) o definir un rango personalizado con fecha de inicio y fecha de fin." },
    s5:  { title: "Deporte", desc: "Selecciona uno o más deportes para ver únicamente el contenido de tu disciplina: fútbol, baloncesto, pádel, tenis, ciclismo y muchos más. Busca por nombre si la lista es larga." },
    s6:  { title: "Tipo de publicador", desc: "Filtra por la categoría de la cuenta: Club, Brand, Competition, Athlete, Creator o Media. Ideal para estudiar la estrategia específica de un tipo de actor del sector." },
    s7:  { title: "Cuenta", desc: "Busca publicaciones de una cuenta concreta: un club, una marca, un atleta o un creador. El filtro se contextualiza automáticamente según el deporte y el tipo de publicador seleccionados." },
    s8:  { title: "Formato", desc: "Selecciona el tipo de pieza: Vídeo, Carrusel, Imagen, Reel o Story. Perfecto para analizar qué formato funciona mejor en cada plataforma y deporte." },
    s9:  { title: "Plataforma", desc: "Elige la red social: Instagram, TikTok, YouTube, Twitter/X, LinkedIn o Facebook. Cada una tiene dinámicas y formatos propios; filtrar por plataforma te ayuda a hacer benchmarking real." },
    s10: { title: "Guardar publicaciones", desc: "Haz clic en el icono de marcador de cualquier publicación para guardarla. Desde la sección Guardados podrás organizarlas en carpetas por proyecto, cliente o campaña." },
    s11: { title: "Carga infinita", desc: "La biblioteca carga automáticamente más contenido al hacer scroll hacia abajo. No hay paginación — el contenido fluye de forma continua mientras exploras la colección." },
    s12: { title: "¡Bienvenidos a SCP!", desc: "Ya conoces toda la biblioteca. Síguenos en nuestras redes para estar al día de las últimas actualizaciones, contenidos exclusivos y novedades de la comunidad." },
    s13: { title: "Collabs & Partnerships", desc: "Contenidos creados en colaboración con marcas, patrocinadores, clubes, deportistas o creadores. Ideal para aprender cómo se gestionan las colaboraciones en el mundo del contenido deportivo." },
    s14: { title: "Merchandising", desc: "Contenidos relacionados con equipaciones, productos oficiales, colecciones y promociones de venta. Descubre cómo las entidades deportivas comunican sus líneas de producto." },
    s15: { title: "Transfers", desc: "Contenidos sobre fichajes, renovaciones, cesiones, presentaciones y salidas de jugadores. Analiza cómo se comunican los movimientos de plantilla en las redes sociales." },
  },
};

const en: TutorialT = {
  badge: "Tutorial",
  libraryBadge: "Library Tutorial",
  stepLabel: (n, t) => `Step ${n} of ${t}`,
  prev: "← Previous",
  next: "Next →",
  exploreNow: "Explore now 🚀",
  exploreLibrary: "Explore the library 🚀",
  follow: "Follow",
  dash: {
    s1: { title: "Content Library", desc: "Here you'll find all indexed reference publications from the world of sports content. Filter by platform, sport, format or account." },
    s2: { title: "Saved", desc: "Save the publications that inspire you in organized folders. Create folders for projects, campaigns or clients." },
    s3: { title: "News", desc: "Follow the latest trends in sports marketing and digital communication. Articles selected from the best sources in the industry." },
    s4: { title: "Metrics", desc: "See at a glance how many publications are indexed, how much content you've saved and which is the dominant platform. The dashboard evolves with you." },
    s5: { title: "WhatsApp Community", desc: "Join the SCP WhatsApp group to connect with other sports content professionals, share strategies and collaborate in real time." },
    s6: { title: "Your profile", desc: "Manage your personal information, subscription plan and content preferences. Access from the side menu." },
  },
  lib: {
    s1:  { title: "Side filters", desc: "The left sidebar contains all available filters to explore the library. You can freely combine them to find exactly the content you're looking for." },
    s2:  { title: "Global search", desc: "The global search lets you search by account, topic or idea directly within all filters. As you type, smart suggestions appear to apply the correct filter instantly." },
    s3:  { title: "Classification", desc: "Classification chips mark publications highlighted by our editorial curation: Top Picks (best pieces), Replicable Ideas (adaptable ideas) and Overperforming (viral content). Select one to filter instantly." },
    s4:  { title: "Date range", desc: "Filter publications by time period. You can choose quick presets (last week, last month) or define a custom range with start and end dates." },
    s5:  { title: "Sport", desc: "Select one or more sports to see only content from your discipline: football, basketball, padel, tennis, cycling and many more. Search by name if the list is long." },
    s6:  { title: "Publisher type", desc: "Filter by account category: Club, Brand, Competition, Athlete, Creator or Media. Ideal for studying the specific strategy of a type of sector player." },
    s7:  { title: "Account", desc: "Search for publications from a specific account: a club, a brand, an athlete or a creator. The filter automatically contextualizes based on the selected sport and publisher type." },
    s8:  { title: "Format", desc: "Select the type of piece: Video, Carousel, Image, Reel or Story. Perfect for analyzing which format works best for each platform and sport." },
    s9:  { title: "Platform", desc: "Choose the social network: Instagram, TikTok, YouTube, Twitter/X, LinkedIn or Facebook. Each has its own dynamics and formats; filtering by platform helps you do real benchmarking." },
    s10: { title: "Save publications", desc: "Click the bookmark icon on any publication to save it. From the Saved section you can organize them in folders by project, client or campaign." },
    s11: { title: "Infinite scroll", desc: "The library automatically loads more content as you scroll down. There's no pagination — content flows continuously as you explore the collection." },
    s12: { title: "Welcome to SCP!", desc: "You now know the whole library. Follow us on our networks to stay up to date with the latest updates, exclusive content and community news." },
    s13: { title: "Collabs & Partnerships", desc: "Content created in collaboration with brands, sponsors, clubs, athletes or creators. Learn how collaborations are managed in the world of sports content." },
    s14: { title: "Merchandising", desc: "Content related to kits, official products, collections and sales promotions. Discover how sports entities communicate their product lines." },
    s15: { title: "Transfers", desc: "Content about signings, renewals, loans, presentations and player departures. Analyse how squad movements are communicated on social media." },
  },
};

const it: TutorialT = {
  badge: "Tutorial",
  libraryBadge: "Tutorial Biblioteca",
  stepLabel: (n, t) => `Passo ${n} di ${t}`,
  prev: "← Precedente",
  next: "Avanti →",
  exploreNow: "Esplora ora 🚀",
  exploreLibrary: "Esplora la biblioteca 🚀",
  follow: "Segui",
  dash: {
    s1: { title: "Content Library", desc: "Qui troverai tutte le pubblicazioni di riferimento indicizzate del mondo dei contenuti sportivi. Filtra per piattaforma, sport, formato o account." },
    s2: { title: "Salvati", desc: "Salva le pubblicazioni che ti ispirano in cartelle organizzate. Crea cartelle per progetti, campagne o clienti." },
    s3: { title: "Notizie", desc: "Segui le ultime tendenze nel marketing sportivo e nella comunicazione digitale. Articoli selezionati dalle migliori fonti del settore." },
    s4: { title: "Metriche", desc: "Vedi a colpo d'occhio quante pubblicazioni sono indicizzate, quanto contenuto hai salvato e quale piattaforma domina. La dashboard evolve con te." },
    s5: { title: "Community WhatsApp", desc: "Unisciti al gruppo WhatsApp di SCP per connetterti con altri professionisti del contenuto sportivo, condividere strategie e collaborare in tempo reale." },
    s6: { title: "Il tuo profilo", desc: "Gestisci le tue informazioni personali, il piano di abbonamento e le tue preferenze di contenuto. Accedi dal menu laterale." },
  },
  lib: {
    s1:  { title: "Filtri laterali", desc: "Il pannello laterale sinistro contiene tutti i filtri disponibili per esplorare la biblioteca. Puoi combinarli liberamente per trovare esattamente il contenuto che cerchi." },
    s2:  { title: "Ricerca globale", desc: "La ricerca globale ti permette di cercare per account, argomento o idea direttamente in tutti i filtri. Man mano che digiti, appaiono suggerimenti intelligenti per applicare il filtro corretto all'istante." },
    s3:  { title: "Classificazione", desc: "I chip di classificazione evidenziano le pubblicazioni selezionate dalla nostra cura editoriale: Top Picks (i migliori), Replicable Ideas (idee adattabili) e Overperforming (contenuto virale). Selezionane uno per filtrare istantaneamente." },
    s4:  { title: "Intervallo di date", desc: "Filtra le pubblicazioni per periodo di tempo. Puoi scegliere preset rapidi (ultima settimana, ultimo mese) o definire un intervallo personalizzato con data di inizio e fine." },
    s5:  { title: "Sport", desc: "Seleziona uno o più sport per vedere solo il contenuto della tua disciplina: calcio, basket, padel, tennis, ciclismo e molti altri. Cerca per nome se la lista è lunga." },
    s6:  { title: "Tipo di editore", desc: "Filtra per categoria dell'account: Club, Brand, Competition, Athlete, Creator o Media. Ideale per studiare la strategia specifica di un tipo di attore del settore." },
    s7:  { title: "Account", desc: "Cerca pubblicazioni di un account specifico: un club, un brand, un atleta o un creator. Il filtro si contestualizza automaticamente in base allo sport e al tipo di editore selezionati." },
    s8:  { title: "Formato", desc: "Seleziona il tipo di contenuto: Video, Carosello, Immagine, Reel o Story. Perfetto per analizzare quale formato funziona meglio in ogni piattaforma e sport." },
    s9:  { title: "Piattaforma", desc: "Scegli il social network: Instagram, TikTok, YouTube, Twitter/X, LinkedIn o Facebook. Ognuno ha le proprie dinamiche e formati; filtrare per piattaforma ti aiuta a fare un benchmarking reale." },
    s10: { title: "Salva pubblicazioni", desc: "Fai clic sull'icona segnalibro di qualsiasi pubblicazione per salvarla. Dalla sezione Salvati potrai organizzarle in cartelle per progetto, cliente o campagna." },
    s11: { title: "Caricamento infinito", desc: "La biblioteca carica automaticamente altri contenuti mentre scorri verso il basso. Non c'è paginazione — il contenuto scorre continuamente mentre esplori la raccolta." },
    s12: { title: "Benvenuti a SCP!", desc: "Ora conosci tutta la biblioteca. Seguici sui nostri social per restare aggiornato sugli ultimi aggiornamenti, contenuti esclusivi e novità della community." },
    s13: { title: "Collabs & Partnerships", desc: "Contenuti creati in collaborazione con brand, sponsor, club, atleti o creator. Scopri come vengono gestite le collaborazioni nel mondo dei contenuti sportivi." },
    s14: { title: "Merchandising", desc: "Contenuti relativi a kit, prodotti ufficiali, collezioni e promozioni di vendita. Scopri come le entità sportive comunicano le proprie linee di prodotto." },
    s15: { title: "Transfers", desc: "Contenuti su acquisti, rinnovi, prestiti, presentazioni e cessioni di giocatori. Analizza come i movimenti di mercato vengono comunicati sui social media." },
  },
};

const zh: TutorialT = {
  badge: "教程",
  libraryBadge: "图书馆教程",
  stepLabel: (n, t) => `步骤 ${n} / ${t}`,
  prev: "← 上一步",
  next: "下一步 →",
  exploreNow: "立即探索 🚀",
  exploreLibrary: "探索图书馆 🚀",
  follow: "关注",
  dash: {
    s1: { title: "内容库", desc: "在这里你可以找到所有体育内容领域的参考索引出版物。按平台、运动、格式或账号筛选。" },
    s2: { title: "已保存", desc: "将激励你的出版物保存到有组织的文件夹中。为项目、活动或客户创建文件夹。" },
    s3: { title: "新闻", desc: "关注体育营销和数字传播的最新趋势。精选自行业最佳来源的文章。" },
    s4: { title: "数据指标", desc: "一目了然地查看有多少出版物被索引、你保存了多少内容以及哪个平台占主导地位。仪表板随你一起进化。" },
    s5: { title: "WhatsApp 社区", desc: "加入SCP WhatsApp群组，与其他体育内容专业人士联系，分享策略并实时协作。" },
    s6: { title: "您的个人资料", desc: "管理您的个人信息、订阅计划和内容偏好。从侧边菜单访问。" },
  },
  lib: {
    s1:  { title: "侧边过滤器", desc: "左侧面板包含浏览图书馆的所有可用过滤器。您可以自由组合它们，精确找到您正在寻找的内容。" },
    s2:  { title: "全局搜索", desc: "全局搜索允许您直接在所有过滤器中按账号、主题或想法进行搜索。当您输入时，会出现智能建议，即时应用正确的过滤器。" },
    s3:  { title: "分类标签", desc: "分类标签标记了我们编辑精选的出版物：Top Picks（最佳内容）、Replicable Ideas（可复制创意）和Overperforming（病毒内容）。选择一个即时过滤。" },
    s4:  { title: "日期范围", desc: "按时间段过滤出版物。您可以选择快速预设（上周、上月）或自定义起止日期范围。" },
    s5:  { title: "运动", desc: "选择一项或多项运动，只查看您所在领域的内容：足球、篮球、桨球、网球、自行车等更多运动。如果列表较长，可按名称搜索。" },
    s6:  { title: "发布者类型", desc: "按账号类别过滤：俱乐部、品牌、赛事、运动员、创作者或媒体。非常适合研究行业某类参与者的具体策略。" },
    s7:  { title: "账号", desc: "搜索特定账号的出版物：俱乐部、品牌、运动员或创作者。过滤器根据所选运动和发布者类型自动进行情境化调整。" },
    s8:  { title: "格式", desc: "选择内容类型：视频、轮播、图片、Reel或Story。非常适合分析哪种格式在每个平台和运动中效果最佳。" },
    s9:  { title: "平台", desc: "选择社交网络：Instagram、TikTok、YouTube、Twitter/X、LinkedIn或Facebook。每个平台都有其独特的动态和格式；按平台过滤有助于您进行真实的基准测试。" },
    s10: { title: "保存出版物", desc: "单击任何出版物的书签图标将其保存。在已保存区域，您可以按项目、客户或活动将其整理到文件夹中。" },
    s11: { title: "无限滚动", desc: "向下滚动时，图书馆会自动加载更多内容。没有分页——当您浏览收藏时，内容会持续流动。" },
    s12: { title: "欢迎来到SCP！", desc: "您现在了解了整个图书馆。在我们的社交网络上关注我们，以了解最新更新、专属内容和社区新闻。" },
    s13: { title: "Collabs & Partnerships", desc: "与品牌、赞助商、俱乐部、运动员或创作者合作创作的内容。了解体育内容世界中合作关系的管理方式。" },
    s14: { title: "Merchandising", desc: "与球衣、官方产品、系列和促销活动相关的内容。发现体育机构如何推广其产品线。" },
    s15: { title: "Transfers", desc: "关于签约、续约、租借、发布会和球员离队的内容。分析球队变动如何在社交媒体上进行传播。" },
  },
};

const fr: TutorialT = {
  badge: "Tutoriel",
  libraryBadge: "Tutoriel Bibliothèque",
  stepLabel: (n, t) => `Étape ${n} sur ${t}`,
  prev: "← Précédent",
  next: "Suivant →",
  exploreNow: "Explorer maintenant 🚀",
  exploreLibrary: "Explorer la bibliothèque 🚀",
  follow: "Suivre",
  dash: {
    s1: { title: "Content Library", desc: "Ici vous trouverez toutes les publications de référence indexées du monde du contenu sportif. Filtrez par plateforme, sport, format ou compte." },
    s2: { title: "Sauvegardés", desc: "Sauvegardez les publications qui vous inspirent dans des dossiers organisés. Créez des dossiers par projets, campagnes ou clients." },
    s3: { title: "Actualités", desc: "Suivez les dernières tendances du marketing sportif et de la communication digitale. Articles sélectionnés parmi les meilleures sources du secteur." },
    s4: { title: "Métriques", desc: "Voyez en un coup d'œil combien de publications sont indexées, combien de contenu vous avez sauvegardé et quelle est la plateforme dominante. Le tableau de bord évolue avec vous." },
    s5: { title: "Communauté WhatsApp", desc: "Rejoignez le groupe WhatsApp SCP pour vous connecter avec d'autres professionnels du contenu sportif, partager des stratégies et collaborer en temps réel." },
    s6: { title: "Votre profil", desc: "Gérez vos informations personnelles, votre plan d'abonnement et vos préférences de contenu. Accédez depuis le menu latéral." },
  },
  lib: {
    s1:  { title: "Filtres latéraux", desc: "Le panneau latéral gauche contient tous les filtres disponibles pour explorer la bibliothèque. Vous pouvez les combiner librement pour trouver exactement le contenu que vous cherchez." },
    s2:  { title: "Recherche globale", desc: "La recherche globale vous permet de chercher par compte, sujet ou idée directement dans tous les filtres. Au fur et à mesure que vous tapez, des suggestions intelligentes apparaissent pour appliquer le bon filtre instantanément." },
    s3:  { title: "Classification", desc: "Les chips de classification marquent les publications mises en avant par notre curation éditoriale : Top Picks (meilleures pièces), Replicable Ideas (idées adaptables) et Overperforming (contenu viral). Sélectionnez-en un pour filtrer instantanément." },
    s4:  { title: "Plage de dates", desc: "Filtrez les publications par période de temps. Vous pouvez choisir des préréglages rapides (dernière semaine, dernier mois) ou définir une plage personnalisée avec date de début et de fin." },
    s5:  { title: "Sport", desc: "Sélectionnez un ou plusieurs sports pour voir uniquement le contenu de votre discipline : football, basketball, padel, tennis, cyclisme et bien d'autres. Recherchez par nom si la liste est longue." },
    s6:  { title: "Type de publieur", desc: "Filtrez par catégorie de compte : Club, Brand, Competition, Athlete, Creator ou Media. Idéal pour étudier la stratégie spécifique d'un type d'acteur du secteur." },
    s7:  { title: "Compte", desc: "Recherchez des publications d'un compte spécifique : un club, une marque, un athlète ou un créateur. Le filtre se contextualise automatiquement selon le sport et le type de publieur sélectionnés." },
    s8:  { title: "Format", desc: "Sélectionnez le type de contenu : Vidéo, Carrousel, Image, Reel ou Story. Parfait pour analyser quel format fonctionne le mieux sur chaque plateforme et sport." },
    s9:  { title: "Plateforme", desc: "Choisissez le réseau social : Instagram, TikTok, YouTube, Twitter/X, LinkedIn ou Facebook. Chacun a ses propres dynamiques et formats ; filtrer par plateforme vous aide à faire un vrai benchmarking." },
    s10: { title: "Sauvegarder des publications", desc: "Cliquez sur l'icône marque-page de n'importe quelle publication pour la sauvegarder. Depuis la section Sauvegardés, vous pourrez les organiser en dossiers par projet, client ou campagne." },
    s11: { title: "Défilement infini", desc: "La bibliothèque charge automatiquement plus de contenu en défilant vers le bas. Il n'y a pas de pagination — le contenu s'écoule continuellement pendant que vous explorez la collection." },
    s12: { title: "Bienvenue chez SCP !", desc: "Vous connaissez maintenant toute la bibliothèque. Suivez-nous sur nos réseaux pour rester à jour des dernières mises à jour, contenus exclusifs et nouveautés de la communauté." },
    s13: { title: "Collabs & Partnerships", desc: "Contenus créés en collaboration avec des marques, sponsors, clubs, sportifs ou créateurs. Découvrez comment les collaborations sont gérées dans le monde du contenu sportif." },
    s14: { title: "Merchandising", desc: "Contenus liés aux équipements, produits officiels, collections et promotions de vente. Découvrez comment les entités sportives communiquent leurs lignes de produits." },
    s15: { title: "Transfers", desc: "Contenus sur les transferts, prolongations, prêts, présentations et départs de joueurs. Analysez comment les mouvements d'effectif sont communiqués sur les réseaux sociaux." },
  },
};

export const tutorialTranslations: Record<Locale, TutorialT> = { ca, es, en, it, zh, fr };

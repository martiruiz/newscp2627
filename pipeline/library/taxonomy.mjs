// Smart filters for the Content Library: new categories derived from each post (caption, hashtags, emojis, date and the
// tags it already has). Used by smart-filters.mjs (rules + AI). Each value has keyword rules in several languages
// (EN, ES, CA, FR, IT, PT, DE); the AI fills in what the rules don't catch.
// Rule syntax: an array of regular expressions (case-insensitive); `months` limits a value to some months (1–12).

export const CATEGORIES = [
  // what the post is about
  { key: "moment", label: "Campaign moment" },
  { key: "matchday_graphic", label: "Matchday graphics" },
  { key: "kit", label: "New kit" },
  { key: "transfer", label: "Transfers" },
  { key: "outcome", label: "Match outcome" },
  { key: "season_moment", label: "Season moment" },
  { key: "opponent", label: "Opponent", free: true },
  { key: "city", label: "City", free: true },
  // who it's for / how it's told
  { key: "goal", label: "Business goal" },
  { key: "comms", label: "Comms type" },
  { key: "crisis", label: "Sensitive comms" },
  { key: "team", label: "Team / audience" },
  { key: "angle", label: "Storytelling angle" },
  { key: "collab", label: "Collabs & creators" },
  { key: "cta", label: "Call to action" },
  // brands
  { key: "sponsor", label: "Sponsor", free: true },
  { key: "sponsor_sector", label: "Sponsor sector" },
  { key: "sponsor_integration", label: "Sponsor integration" },
  { key: "language", label: "Language", single: true },
  // from Instagram's own data (no AI)
  { key: "aspect_ratio", label: "Aspect ratio", meta: true },
  { key: "duration", label: "Duration", meta: true },
];
export const AI_CATEGORIES = CATEGORIES.filter((c) => !c.meta);

// Allowed values for the AI (free categories: any name, normalised afterwards)
export const AI_VALUES = {
  moment: ["Matchday preview", "Match coverage", "Milestone / record", "Award", "Tribute", "Birthday", "Throwback", "Training", "Preseason / tour",
    "Season tickets / membership",
    "Christmas", "Halloween", "Black Friday", "Valentine's Day", "New Year", "Pride", "International Women's Day", "Ramadan / Eid", "Lunar New Year"],
  matchday_graphic: ["Matchday poster", "Countdown", "Squad list", "Starting XI", "Half-time", "Goal", "Full-time", "MOTM vote", "Fixture / schedule", "Weekly recap",
    "Standings", "Stats card", "Quote card", "Birthday graphic", "Signing graphic"],
  kit: ["Home kit", "Away kit", "Third kit", "Goalkeeper kit", "Special edition kit", "Training wear", "Retro / heritage"],
  transfer: ["Signing", "Renewal", "Loan", "Departure"],
  outcome: ["Win", "Draw", "Loss"],
  season_moment: ["Opening day", "Derby", "Cup final", "Title celebration", "Promotion", "Relegation", "European qualification", "Last game of the season", "Pre-season"],
  aspect_ratio: ["1:1", "4:5", "3:4", "9:16", "16:9", "1.91:1", "2:3", "4:3"],
  duration: ["Under 15s", "15–30s", "30–60s", "Over 60s"],
  goal: ["Ticket sales", "Merchandise sales", "Memberships", "Sponsor value", "App / digital product", "Community / CSR", "Recruitment / grassroots"],
  comms: ["Official announcement", "Press conference", "Statement", "Injury / medical update", "Ticket info"],
  crisis: ["Apology", "Racism / abuse", "Sanction / disciplinary", "Serious injury", "Security / incident", "Condolences"],
  team: ["First team", "Women's team", "Academy / youth", "Legends", "Esports", "Staff / coaches"],
  angle: ["Player-focused", "Humour / meme", "Emotional", "Data & stats", "Behind the scenes", "Skills / tutorial", "Celebration"],
  collab: ["Player collab", "Athlete takeover", "Fan content (UGC)", "Influencer / creator", "Club collab", "Brand collab"],
  cta: ["Link in bio", "Buy tickets", "Shop now", "Vote / poll", "Comment", "Tag a friend", "Giveaway / contest", "Watch / stream", "Download app"],
  sponsor_sector: ["Apparel / sportswear", "Airline / travel", "Bank / finance", "Telecom / tech", "Beverage", "Food", "Automotive", "Energy", "Betting", "Crypto / fintech", "Media / streaming", "Health", "Retail", "Gaming"],
  sponsor_integration: ["Logo on graphic", "Presented-by segment", "Brand collab post", "Product placement", "Sponsor activation / event", "Sponsor giveaway"],
  language: ["English", "Spanish", "Catalan", "French", "Italian", "Portuguese", "German", "Dutch", "Turkish", "Arabic", "Polish", "Greek", "Japanese", "Korean", "Chinese",
    "Indonesian", "Russian", "Ukrainian", "Swedish", "Danish", "Norwegian", "Croatian", "Serbian", "Czech", "Romanian", "Hebrew", "Hindi", "Thai", "Vietnamese", "Emoji only", "Other"],
};

const W = (s) => new RegExp(s, "iu");

export const RULES = {
  moment: {
    "Matchday preview": [W("#?match ?day|#?gameday|#?jornada|dia de partit|día de partido|jour de match|matchday|game day|preview|previa|avant-match|pre-?match|kick-?off|ko \\d|this (?:afternoon|evening|tonight)'s game|tonight we|hoy jugamos|avui juguem|ce soir|stasera|hoje jogamos")],
    "_Live match": [W("\\bht\\b|half-?time|\\bft\\b(?!\\w)|descanso|mitja part|mi-temps|intervallo|\\d+'\\s|goo+a+l|gol+a+z+o|⚽️?\\s*\\d|live now|en directo|en directe|en direct|in diretta|ao vivo")],
    "Match coverage": [W("full-?time|final score|resultado final|resultat final|score final|risultato finale|we win|victory|victoria|victòria|victoire|vittoria|vitória|\\b3 points\\b|tres puntos|3 punts|derrota|defeat|\\b\\d+\\s?[-–]\\s?\\d+\\b")],
    "_Signing": [W("welcome to|bienvenid[oa]|benvingut|bienvenue|benvenut[oa]|bem-vind[oa]|herzlich willkommen|new signing|nuevo fichaje|nou fitxatge|officially joins|signs (?:for|with)|ha firmado|ha fitxat|#?herewego|it'?s official|es oficial|és oficial")],
    "_Contract renewal": [W("renew|renueva|renova|renouvelle|rinnova|extends (?:his|her) contract|contract extension|until 20\\d\\d|hasta 20\\d\\d|fins al 20\\d\\d|jusqu'en 20\\d\\d")],
    "_Farewell": [W("farewell|goodbye|thank you for everything|gracias por todo|gràcies per tot|merci pour tout|grazie di tutto|obrigado por tudo|adiós|adéu|leaves the club|deja el club")],
    "_Kit launch": [W("new kit|home kit|away kit|third kit|nueva camiseta|nova samarreta|nouveau maillot|nuova maglia|nova camisa|trikot|#?newkit|equipación|equipació|jersey reveal|kit reveal")],
    "_Ticketing": [W("🎟|tickets?|entradas|entrades|billets|biglietti|ingressos|bilhetes|sold out|agotad[oa]s|exhaurides|box office|taquilla")],
    "Season tickets / membership": [W("season tickets?|abonament|abono|socios?|socis|membership|members|abbonament|sócio|carnet")],
    "Birthday": [W("happy birthday|feliz cumpleaños|feliç aniversari|joyeux anniversaire|buon compleanno|feliz aniversário|alles gute zum geburtstag|🎂|🎉 .*birthday|#hbd")],
    "Milestone / record": [W("record|récord|rècord|milestone|\\b\\d{2,4}(?:th|º|è|e)? (?:game|appearance|partido|partit|goal|gol)s?\\b|historic|histórico|històric|historique|storico|first ever|por primera vez|per primera vegada")],
    "Award": [W("player of the (?:month|match|year|season)|potm|motm|mvp|award|premio|premi|trophée|premio|prêmio|best (?:player|goal)|goal of the (?:month|season)|golden boot|ballon d'or")],
    "Tribute": [W("rest in peace|\\brip\\b|d\\.e\\.p|descanse en paz|descansi en pau|in memoriam|minute'?s silence|minuto de silencio|minut de silenci|homenaje|homenatge|hommage|omaggio|tribute")],
    "Throwback": [W("#?tbt|throwback|#?onthisday|on this day|un dia com avui|tal día como hoy|il y a \\d+ ans|accadde oggi|#?flashback|years ago today")],
    "Training": [W("training|entrenamiento|entrenament|entraînement|allenamento|treino|training session|sesión|session")],
    "Preseason / tour": [W("pre-?season|pretemporada|pretemporada|pré-saison|precampionato|pré-temporada|summer tour|gira|tour 20\\d\\d")],
    "_Travel": [W("✈|travel|on our way|rumbo a|cap a|en route|in viaggio|a caminho|arrived in|hemos llegado|ja som a")],
    "Christmas": [W("christmas|xmas|navidad|nadal|noël|natale|natal|weihnacht|🎄|🎅"), { months: [11, 12, 1] }],
    "Halloween": [W("halloween|🎃|👻|spooky"), { months: [10, 11] }],
    "Black Friday": [W("black ?friday|cyber monday"), { months: [11, 12] }],
    "Valentine's Day": [W("valentine|san valent[ií]n|sant valent[ií]|saint-valentin|san valentino|dia dos namorados|💘"), { months: [2] }],
    "New Year": [W("happy new year|feliz año nuevo|bon any nou|bonne année|felice anno nuovo|feliz ano novo|frohes neues|#?ny20\\d\\d|🎆"), { months: [12, 1] }],
    "Pride": [W("#?pride|orgullo|orgull|fierté|🏳️‍🌈|lgbt")],
    "International Women's Day": [W("#?iwd|women'?s day|día de la mujer|dia de la dona|journée (?:internationale )?des femmes|giornata della donna|dia da mulher|8m\\b"), { months: [3] }],
    "_Fan engagement": [W("caption this|who wins|guess|adivina|endevina|devinez|indovina|poll|encuesta|enquesta|sondage|sondaggio|comment below|comenta|tag (?:a|your)|vote|vota|quiz|challenge|reto|repte|défi|sfida|which one")],
    "_Community / CSR": [W("foundation|fundación|fundació|fondation|fondazione|fundação|charity|solidar|community|comunidad|comunitat|hospital|donat|volunteer|voluntari|inclusion|inclusión|inclusió|sustainab|sostenib|durable")],
    "_Partnership announcement": [W("partner(?:ship)?|patrocinador|patrocinador oficial|official (?:partner|sponsor|supplier)|sponsor officiel|sponsor ufficiale|parceiro oficial|proud to announce|new partner|nou partner|nuevo partner")],
    "_Merchandise drop": [W("🛍|shop|tienda|botiga|boutique|negozio|loja|store|merch|collection|colección|col·lecció|available now|ya disponible|ja disponible|disponible maintenant|now available|pre-?order|reserva ya")],
  },
  goal: {
    "Ticket sales": [W("🎟|tickets?|entradas|entrades|billets|biglietti|ingressos|bilhetes|sold out|agotad|box office|taquilla|buy now")],
    "Merchandise sales": [W("🛍|shop|tienda|botiga|boutique|store|merch|collection|available now|ya disponible|pre-?order|discount|descuento|descompte|% off|black friday")],
    "Memberships": [W("season tickets?|abonament|abono|socios?|socis|membership|members|sócio|abbonament")],
    "Sponsor value": [W("presented by|powered by|in partnership with|en colaboración con|amb la col·laboració|official (?:partner|sponsor)|patrocinador|thanks to our partner|#ad\\b|@\\w+ (?:partner|sponsor)")],
    "App / digital product": [W("download (?:the|our) app|descarga la app|descarrega l'app|app store|google play|our app|nuestra app|la nostra app|fantasy|newsletter|subscribe|suscríbete|subscriu-te|stream|streaming|youtube|twitch|link in bio")],
    "Community / CSR": [W("foundation|fundación|fundació|charity|solidar|community|hospital|donat|volunteer|inclusion|sustainab")],
    "Recruitment / grassroots": [W("academy|cantera|pedrera|trials|pruebas|proves|camp|campus|escuela|escola|school|join (?:our|the) (?:team|academy)|inscripciones|inscripcions")],
  },
  comms: {
    "Official announcement": [W("official|oficial|officiel|ufficiale|it'?s official|comunicado oficial|comunicat oficial|announcement|anuncio|anunci|annonce")],
    "Line-up": [W("starting (?:xi|11|five|lineup)|line-?up|alineación|alineació|onze titulaire|formazione|escalação|once inicial|\\bxi\\b|starting five|quinteto")],
    "Result / score": [W("full-?time|final score|resultado final|resultat final|score final|risultato finale|\\bft\\b|\\b\\d+\\s?[-–]\\s?\\d+\\b")],
    "Fixture / schedule": [W("fixture|calendario|calendari|calendrier|schedule|next (?:game|match)|próximo partido|proper partit|prochain match|prossima partita|próximo jogo|📅|🗓")],
    "Injury / medical update": [W("injury|lesión|lesió|blessure|infortunio|lesão|medical (?:report|update)|parte médico|part mèdic|recovery|recuperación")],
    "Press conference": [W("press conference|rueda de prensa|roda de premsa|conférence de presse|conferenza stampa|coletiva|🎙")],
    "Statement": [W("statement|comunicado|comunicat|communiqué|comunicato|nota oficial|declaración|declaració")],
    "Transfer news": [W("transfer|traspaso|traspàs|transfert|trasferimento|transferência|loan|cesión|cessió|prêt|prestito|empréstimo|#?herewego|signs (?:for|with)|joins")],
  },
  team: {
    "Women's team": [W("women|femenino|femení|féminine|femminile|feminino|frauen|#?wsl\\b|liga f\\b|nwsl|wnba|uwcl|d1 arkema|serie a femminile|she ?believes|#?womensfootball|\\bfem\\b")],
    "Academy / youth": [W("academy|cantera|pedrera|juvenil|u-?1[5-9]|u-?2[0-3]|sub-?1[5-9]|sub-?2[0-3]|youth|primavera|la masia|reserves?|b team|filial|équipe réserve")],
    "Legends": [W("legend|leyenda|llegenda|légende|leggenda|lenda|veterans?|veteranos")],
    "Esports": [W("esports?|e-?sports|ea ?fc|fifa\\b|efootball|gaming|gamer|twitch")],
    "Fans": [W("fans|aficionados|afició|afición|supporters|tifosi|torcida|hinchas|socios|culers|you'?ll never walk alone|ultras|grada")],
    "Staff / coaches": [W("coach|entrenador|míster|mister|manager|técnico|cuerpo técnico|staff|board|president|presidente|director deportivo")],
  },
  angle: {
    "Humour / meme": [W("😂|🤣|😅|lol\\b|lmao|meme|jaja|haha|mdr\\b|ahah|kkkk")],
    "Emotional": [W("❤️|🥹|😢|🥲|emotional|emoción|emoció|émotion|emozione|emoção|goosebumps|piel de gallina|pell de gallina|chills|tears|lágrimas|llàgrimes")],
    "Data & stats": [W("\\bstats?\\b|estadísticas|estadístiques|statistiques|statistiche|estatísticas|📊|📈|\\bxg\\b|\\d+% |numbers|datos|dades|données")],
    "Behind the scenes": [W("behind the scenes|#?bts\\b|backstage|entre bastidores|entre bastidors|coulisses|dietro le quinte|bastidores|inside\\b|dressing room|vestuario|vestidor|vestiaire|spogliatoio|access all areas|all access")],
    "Skills / tutorial": [W("skills?|tutorial|how to|cómo|com fer|comment|come fare|drill|técnica|tècnica|technique|tecnica|freestyle|tips")],
    "Hype / cinematic": [W("🔥|💥|⚡|🚀|let'?s go|vamos|som-hi|allez|forza|bora|it'?s time|ready|preparados|preparats|prêts|pronti|prontos")],
    "Celebration": [W("🏆|🥇|🎉|🥳|champions|campeones|campions|champions|campioni|campeões|celebrat|celebra|fête|festa")],
    "Fan-focused": [W("fans|aficionados|afició|supporters|tifosi|torcida|hinchas|thank you fans|gracias afición|gràcies afició|merci aux supporters")],
  },
  cta: {
    "Link in bio": [W("link in (?:bio|our bio)|enlace en (?:la )?bio|enllaç a la bio|lien en bio|link in bio|link na bio")],
    "Buy tickets": [W("get your tickets|buy (?:your )?tickets|compra (?:tus |les )?entradas|compra les entrades|achetez vos billets|acquista i biglietti|garanta seu ingresso|🎟")],
    "Shop now": [W("shop now|compra ya|compra ara|achetez|acquista|compre já|available (?:now|in store)|disponible (?:ya|ara)|🛍")],
    "Vote / poll": [W("vote|vota|votez|votate|poll|encuesta|enquesta|sondage|sondaggio")],
    "Comment": [W("comment|comenta|commentez|commenta|drop (?:a|your)|let us know|dinos|digues|dites-nous|👇")],
    "Tag a friend": [W("tag (?:a|your)|etiqueta a|menciona a|identifie|tagga|marque")],
    "Giveaway / contest": [W("giveaway|sorteo|sorteig|concours|concorso|sorteio|win (?:a|signed)|gana|guanya|to enter")],
    "Watch / stream": [W("watch|mira|mireu|regardez|guarda|assista|live on|en directo en|en directe a|stream|📺")],
    "Download app": [W("download (?:the|our) app|descarga (?:la|nuestra) app|descarrega l'app|téléchargez|scarica l'app|baixe o app")],
  },
};

// Brands → sector (sponsors). Names as they appear in captions / handles.
export const SPONSORS = {
  "Nike": "Apparel / sportswear", "Adidas": "Apparel / sportswear", "Puma": "Apparel / sportswear", "Under Armour": "Apparel / sportswear",
  "New Balance": "Apparel / sportswear", "Kappa": "Apparel / sportswear", "Joma": "Apparel / sportswear", "Macron": "Apparel / sportswear",
  "Hummel": "Apparel / sportswear", "Umbro": "Apparel / sportswear", "Castore": "Apparel / sportswear", "Jordan": "Apparel / sportswear",
  "Emirates": "Airline / travel", "Qatar Airways": "Airline / travel", "Etihad": "Airline / travel", "Turkish Airlines": "Airline / travel", "Iberia": "Airline / travel", "Vueling": "Airline / travel", "Booking.com": "Airline / travel", "Expedia": "Airline / travel",
  "Spotify": "Media / streaming", "DAZN": "Media / streaming", "Amazon Prime": "Media / streaming", "Netflix": "Media / streaming", "Movistar": "Telecom / tech", "Vodafone": "Telecom / tech", "Orange": "Telecom / tech", "Rakuten": "Telecom / tech", "Samsung": "Telecom / tech", "Apple": "Telecom / tech", "Google": "Telecom / tech", "Microsoft": "Telecom / tech", "Oppo": "Telecom / tech", "Xiaomi": "Telecom / tech", "Lenovo": "Telecom / tech", "Sony": "Telecom / tech", "EA Sports": "Telecom / tech", "Konami": "Telecom / tech",
  "Coca-Cola": "Beverage", "Pepsi": "Beverage", "Red Bull": "Beverage", "Heineken": "Beverage", "Estrella Damm": "Beverage", "Mahou": "Beverage", "Budweiser": "Beverage", "Carlsberg": "Beverage", "Gatorade": "Beverage", "Powerade": "Beverage", "Monster": "Beverage", "Aquarius": "Beverage",
  "Santander": "Bank / finance", "BBVA": "Bank / finance", "CaixaBank": "Bank / finance", "Mastercard": "Bank / finance", "Visa": "Bank / finance", "Barclays": "Bank / finance", "Allianz": "Bank / finance", "AXA": "Bank / finance", "Revolut": "Bank / finance", "Standard Chartered": "Bank / finance",
  "Bet365": "Betting", "Betway": "Betting", "Codere": "Betting", "Bwin": "Betting", "William Hill": "Betting", "Stake": "Betting", "1xBet": "Betting", "DraftKings": "Betting", "FanDuel": "Betting",
  "Crypto.com": "Crypto / fintech", "Binance": "Crypto / fintech", "Socios": "Crypto / fintech", "Coinbase": "Crypto / fintech",
  "Audi": "Automotive", "BMW": "Automotive", "Mercedes": "Automotive", "Toyota": "Automotive", "Cupra": "Automotive", "Seat": "Automotive", "Kia": "Automotive", "Hyundai": "Automotive", "Jeep": "Automotive", "Chevrolet": "Automotive", "Volkswagen": "Automotive",
  "Repsol": "Energy", "Cepsa": "Energy", "Iberdrola": "Energy", "Endesa": "Energy", "Gazprom": "Energy", "Aramco": "Energy",
  "McDonald's": "Food", "KFC": "Food", "Burger King": "Food", "Domino's": "Food", "Cadbury": "Food", "Lay's": "Food",
  "Sanitas": "Health", "Quirónsalud": "Health", "Herbalife": "Health",
  "Amazon": "Retail", "Decathlon": "Retail", "El Corte Inglés": "Retail", "Lidl": "Retail", "Carrefour": "Retail",
  "Rolex": "Other", "Hublot": "Other", "Tag Heuer": "Other", "Oakley": "Other", "EA FC": "Telecom / tech", "Uber": "Other", "Airbnb": "Airline / travel", "Cazoo": "Automotive", "Unibet": "Betting",
};
export const SPONSOR_SECTORS = ["Apparel / sportswear", "Airline / travel", "Bank / finance", "Telecom / tech", "Beverage", "Food", "Automotive", "Energy", "Betting", "Crypto / fintech", "Media / streaming", "Health", "Retail", "Other"];

export const LANGUAGES = ["English", "Spanish", "Catalan", "French", "Italian", "Portuguese", "German", "Dutch", "Arabic", "Turkish", "Other"];
const LANG_WORDS = {
  English: /\b(the|and|with|our|this|we|you|for|to)\b/gi,
  Spanish: /\b(el|los|las|con|para|nuestro|nuestra|hoy|del|una|que)\b/gi,
  Catalan: /\b(els|amb|per|aquest|avui|del|una|que|som|nostre|també|perquè)\b/gi,
  French: /\b(le|les|des|avec|pour|notre|aujourd'hui|une|est|nous)\b/gi,
  Italian: /\b(il|gli|della|con|per|nostro|oggi|una|che|siamo)\b/gi,
  Portuguese: /\b(os|as|com|para|nosso|hoje|uma|que|não|vamos)\b/gi,
  German: /\b(der|die|das|und|mit|für|heute|wir|ist|nicht)\b/gi,
  Dutch: /\b(de|het|een|met|voor|vandaag|wij|niet|onze)\b/gi,
};
const ARABIC = /[؀-ۿ]/;

// Rules → { category: Set(values) }
export function applyRules(post) {
  const text = `${post.title || ""}`;
  const month = post.published_at ? new Date(post.published_at).getUTCMonth() + 1 : null;
  const out = Object.fromEntries(CATEGORIES.map((c) => [c.key, new Set()]));
  out.hashtags = new Set((text.match(/#[\p{L}\p{N}_]{2,40}/gu) || []).map((h) => h.toLowerCase()));
  for (const [cat, values] of Object.entries(RULES)) {
    for (const [value, rule] of Object.entries(values)) {
      if (value.startsWith("_") || !out[cat]) continue;
      const [re, opts] = rule;
      if (opts?.months && month && !opts.months.includes(month)) continue;
      if (re.test(text)) out[cat].add(value);
    }
  }
  for (const [brand, sector] of Object.entries(SPONSORS)) {
    const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s?");
    if (new RegExp(`(?:^|[^\\p{L}\\d])@?${esc}(?:[^\\p{L}\\d]|$)`, "iu").test(text)) { out.sponsor.add(brand); out.sponsor_sector.add(sector); }
  }
  if (out.sponsor.size) out.goal.add("Sponsor value");
  // Language: most frequent function words (min 2 hits), Arabic script
  if (ARABIC.test(text)) out.language.add("Arabic");
  else {
    let best = null, hits = 1;
    for (const [lang, re] of Object.entries(LANG_WORDS)) { const n = (text.match(re) || []).length; if (n > hits) { best = lang; hits = n; } }
    if (best) out.language.add(best);
  }
  // Team default: first team when it's a club post and no other team matched
  if (!out.team.size && (post.tags?.club?.length)) out.team.add("First team");
  return out;
}

export const VALUES = AI_VALUES;

// Brand names as one canonical spelling ("EA SPORTS FC" → "EA Sports FC"); unknown brands keep the AI's spelling
const CANON = new Map(Object.keys(SPONSORS).map((b) => [b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""), b]));
CANON.set("easportsfc", "EA Sports FC"); CANON.set("eafc", "EA Sports FC"); CANON.set("easports", "EA Sports"); CANON.set("cocacola", "Coca-Cola");
export function canonicalBrand(name) {
  const raw = String(name || "").replace(/^@/, "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return CANON.get(key) || raw.replace(/_/g, " ");
}

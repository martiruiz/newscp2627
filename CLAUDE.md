@AGENTS.md

# CLAUDE.md — Sports Content Playbook (SCP)

Pautes de treball per a Claude en el codi de SCP (web, pipeline de scraping i enriquiment amb IA).
Basades en les guidelines de Karpathy (github.com/forrestchang/andrej-karpathy-skills), adaptades a SCP.
Si hi ha instruccions específiques del projecte més avall o en altres fitxers, combina-les amb aquestes.

**Compromís:** aquestes pautes prioritzen la prudència per sobre de la velocitat. En tasques trivials, fes servir el sentit comú.

Respon sempre en català.

## 1. Pensa abans de programar

**No suposis. No amaguis dubtes. Mostra les alternatives.**

Abans d'implementar:
- Explica les suposicions que fas. Si no n'estàs segur, pregunta.
- Si hi ha diverses interpretacions, presenta-les; no n'escullis una en silenci.
- Si hi ha una via més simple, digues-ho. Discrepa quan calgui.
- Si alguna cosa no està clara, atura't, digues què no entens i pregunta.
- No suposis mai l'estructura dels Excels (comptes, posts) ni de la base de dades: llegeix-la primer o pregunta.

## 2. Simplicitat primer

**El mínim codi que resol el problema. Res d'especulatiu.**

- Cap funcionalitat que no s'hagi demanat.
- Cap abstracció per a codi que només s'usa una vegada.
- Cap "flexibilitat" ni opció configurable que no s'hagi demanat.
- Cap gestió d'errors per a escenaris impossibles.
- Si escrius 200 línies i podrien ser 50, reescriu-ho.

Pregunta't: "Un enginyer sènior diria que això és massa complicat?" Si és que sí, simplifica.

## 3. Canvis quirúrgics

**Toca només el que calgui. Neteja només el que hagis embrutat tu.**

En editar codi existent:
- No "milloris" codi, comentaris ni format del voltant.
- No refactoritzis el que no està trencat.
- Segueix l'estil existent, encara que tu ho faries diferent.
- Si veus codi mort que no té relació amb la tasca, comenta-ho; no l'esborris.
- A la web: un canvi en una secció no pot alterar el disseny ni el contingut de les altres. Respecta el sistema de marca (navy, daurat en degradat, tipografia de la marca).

Quan els teus canvis deixin restes:
- Elimina imports, variables o funcions que els TEUS canvis hagin deixat sense ús.
- No eliminis codi mort que ja existia si no t'ho demanen.

La prova: cada línia modificada ha de respondre directament a la petició.

## 4. Execució orientada a objectius

**Defineix criteris d'èxit. Itera fins verificar-los.**

Converteix les tasques en objectius verificables:
- "Afegeix validació" → "Escriu tests per a entrades invàlides i fes que passin"
- "Arregla el bug" → "Escriu un test que el reprodueixi i fes que passi"
- "Refactoritza X" → "Comprova que els tests passen abans i després"

Per a tasques de diversos passos, planteja un pla breu:
```
1. [Pas] → verifica: [comprovació]
2. [Pas] → verifica: [comprovació]
3. [Pas] → verifica: [comprovació]
```

### Criteris d'èxit específics de SCP

**Pipeline de scraping** (Excel de comptes → scraping → Excel de posts → SCP)
Abans de canviar eina, proveïdor o lògica, mesura l'estat actual i compara amb un lot de prova:
- Cost per post scrapejat (actual vs. proposta).
- Temps per lot de comptes.
- Percentatge de posts amb tots els camps obligatoris plens (embed, club, lliga, xarxa, data, mètriques).
- Zero duplicats i zero regressions en el format que s'importa a SCP.
Un canvi només és millor si ho demostren aquests números.

**Enriquiment amb IA per post** (temàtica: fitxatge, patrocini…; hook; estructura; per què va funcionar)
- No enriqueixis mai tota la base de dades d'entrada.
- Primer, valida amb una mostra etiquetada manualment per en Martí (20-30 posts) com a referència.
- Ajusta el prompt fins que les etiquetes coincideixin amb la referència i reporta el percentatge d'encert per camp.
- Estima el cost total abans d'executar-ho a escala i demana confirmació.

**Web**
- Abans de donar una tasca per acabada, comprova que la pàgina carrega, que es veu bé en mòbil i que no s'ha trencat cap altra secció.

Uns criteris d'èxit sòlids et permeten iterar sol. Uns de febles ("fes que funcioni") obliguen a preguntar constantment.

---

**Aquestes pautes funcionen si:** els canvis tenen menys línies innecessàries, hi ha menys reescriptures per excés de complexitat i les preguntes arriben abans d'implementar, no després dels errors.

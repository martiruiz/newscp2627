#!/bin/bash
# Import diari automàtic — SCP NOVA
# Llegeix els CSV del scraper (SCRAP SCP 2026) i els envia a l'API d'import.
# La carpeta font conté subcarpetes per plataforma; busquem recursivament.

DATE=$(date +%Y-%m-%d)
SERVER="${SCP_SERVER:-http://localhost:3000}"
# Carpeta font: on el scraper deixa els CSV (subcarpetes per plataforma)
SOURCE_DIR="${SCP_CSV_DIR:-/Users/martiruiz/Desktop/SPORTS CONTENT PLAYBOOK/SCRAP SCP 2026}"
LOG_DIR="$(dirname "$0")/../logs"

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/import-$DATE.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== Import diari $DATE ==="
log "Servidor: $SERVER"
log "Font CSV: $SOURCE_DIR"

# Comprova que el servidor està actiu
if ! curl -sf "$SERVER/api/import/history" > /dev/null 2>&1; then
  log "ERROR: El servidor $SERVER no respon. Cancel·lant import."
  exit 1
fi

IMPORTED=0
ERRORS=0
CREATED_TOTAL=0
UPDATED_TOTAL=0
SKIPPED_TOTAL=0

# Itera pels CSV a la carpeta font (fins 2 nivells de profunditat per cobrir subcarpetes de plataforma)
while IFS= read -r -d '' CSV; do
  BASENAME=$(basename "$CSV")

  # Salta duplicats tipus "SCRAPEIG DIARI X (1).csv"
  if [[ "$BASENAME" =~ \( ]]; then
    log "SALT: $BASENAME (duplicat)"
    continue
  fi

  # Salta fitxers de backup amb "backup" al nom
  if [[ "$BASENAME" =~ [Bb]ackup ]]; then
    log "SALT: $BASENAME (backup)"
    continue
  fi

  # Construeix nom amb data: "SCRAPEIG DIARI X.csv" → "SCRAPEIG DIARI X 2026-08-18.csv"
  NAME_WITHOUT_EXT="${BASENAME%.csv}"
  NEW_NAME="${NAME_WITHOUT_EXT} ${DATE}.csv"

  log "Important: $NEW_NAME"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER/api/import" \
    -F "action=import" \
    -F "file=@${CSV};filename=${NEW_NAME}" \
    --max-time 600 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" == "200" ]]; then
    # Parse counts from the streaming NDJSON response — last "done" line has the totals
    DONE_LINE=$(echo "$BODY" | grep '"type":"done"' | tail -1)
    CREATED=$(echo "$DONE_LINE" | grep -o '"imported":[0-9]*' | grep -o '[0-9]*' || echo 0)
    UPDATED=$(echo "$DONE_LINE" | grep -o '"updated":[0-9]*' | grep -o '[0-9]*' || echo 0)
    SKIPPED=$(echo "$DONE_LINE" | grep -o '"skipped":[0-9]*' | grep -o '[0-9]*' || echo 0)
    CREATED=${CREATED:-0}; UPDATED=${UPDATED:-0}; SKIPPED=${SKIPPED:-0}
    log "OK: $NEW_NAME → ${CREATED} creats, ${UPDATED} actualitzats, ${SKIPPED} saltats"
    IMPORTED=$((IMPORTED + 1))
    CREATED_TOTAL=$((CREATED_TOTAL + CREATED))
    UPDATED_TOTAL=$((UPDATED_TOTAL + UPDATED))
    SKIPPED_TOTAL=$((SKIPPED_TOTAL + SKIPPED))
  else
    log "ERROR: $NEW_NAME → HTTP $HTTP_CODE — $BODY"
    ERRORS=$((ERRORS + 1))
  fi

done < <(find "$SOURCE_DIR" -maxdepth 2 -name "SCRAPEIG DIARI *.csv" -print0 | sort -z)

log "=== Finalitzat: $IMPORTED fitxers OK, $ERRORS errors | ${CREATED_TOTAL} creats, ${UPDATED_TOTAL} actualitzats, ${SKIPPED_TOTAL} saltats ==="

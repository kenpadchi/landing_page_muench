#!/usr/bin/env bash
# Lädt nur die für den Betrieb nötigen Dateien der Website per SFTP zu ALL-INKL hoch.
#
#   ./deploy.sh            Upload (bei assets/ werden nur neuere Dateien übertragen)
#   ./deploy.sh --dry-run  zeigt nur, was übertragen würde
#
# Zugangsdaten kommen aus der Datei .env (siehe .env.example), die per .gitignore
# vom Repository ausgeschlossen ist. Auf dem Server wird nichts gelöscht.
#
# Werkzeug: lftp (bevorzugt, nutzt das Passwort aus .env).
# Fallbacks: rsync über SSH (Passwort nur mit sshpass automatisierbar) oder
#            OpenSSH-sftp (fragt das Passwort interaktiv ab, sofern kein SSH-Key).
#   Windows: lftp gibt es unter WSL (sudo apt install lftp) oder MSYS2 (pacman -S lftp).

set -euo pipefail

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# Konfiguration laden
# ---------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  echo "Fehler: .env fehlt. Bitte .env.example nach .env kopieren und ausfüllen." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

DEPLOY_HOST="${DEPLOY_HOST:-w022514b.kasserver.com}"
DEPLOY_USER="${DEPLOY_USER:-w022514b}"
DEPLOY_PATH="${DEPLOY_PATH:-/www/htdocs/w022514b/alltagsengel-muench.de/}"
DEPLOY_PROTOCOL="${DEPLOY_PROTOCOL:-sftp}"
DEPLOY_PATH="${DEPLOY_PATH%/}/"   # genau ein abschließender Slash

if [[ -z "${DEPLOY_PASS:-}" ]]; then
  echo "Fehler: DEPLOY_PASS ist in .env nicht gesetzt." >&2
  exit 1
fi

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN=1
fi

# ---------------------------------------------------------------------------
# Was hochgeladen wird. Alles andere bleibt lokal: CLAUDE.md, team.md, design/,
# deploy.sh, .env, .env.example, .gitignore, .git …
# ---------------------------------------------------------------------------
FILES=(
  index.html
  impressum.html
  datenschutz.html
  kontakt.php
  styles.css
  script.js
  sitemap.xml
  robots.txt
)
DIRS=(
  assets
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Fehler: Datei fehlt: $f" >&2
    exit 1
  fi
done
for d in "${DIRS[@]}"; do
  if [[ ! -d "$d" ]]; then
    echo "Fehler: Ordner fehlt: $d" >&2
    exit 1
  fi
done

echo "Ziel: ${DEPLOY_PROTOCOL}://${DEPLOY_USER}@${DEPLOY_HOST}${DEPLOY_PATH}"
if (( DRY_RUN )); then
  echo "(Testlauf – es wird nichts übertragen)"
fi

# ---------------------------------------------------------------------------
# Variante 1: lftp
# ---------------------------------------------------------------------------
deploy_lftp() {
  local url opts script mirror_flags f d
  if [[ "$DEPLOY_PROTOCOL" == "ftps" ]]; then
    url="ftp://${DEPLOY_HOST}"
    opts="set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate yes;"
  else
    url="sftp://${DEPLOY_HOST}"
    # Host-Key beim ersten Verbinden automatisch akzeptieren
    opts="set sftp:auto-confirm yes;"
  fi

  mirror_flags="--reverse --only-newer --no-perms --verbose --exclude-glob .DS_Store --exclude-glob Thumbs.db"
  if (( DRY_RUN )); then
    mirror_flags="$mirror_flags --dry-run"
  fi

  script="$opts set net:max-retries 2; set net:timeout 30;"
  script="$script open -u \"${DEPLOY_USER}\",\"${DEPLOY_PASS}\" ${url};"
  script="$script cd \"${DEPLOY_PATH}\";"
  for f in "${FILES[@]}"; do
    if (( DRY_RUN )); then
      script="$script echo \"[dry-run] put $f\";"
    else
      script="$script put -O . \"$f\";"
    fi
  done
  for d in "${DIRS[@]}"; do
    script="$script mirror $mirror_flags \"$d\" \"$d\";"
  done
  script="$script bye"

  lftp -c "$script"
}

# ---------------------------------------------------------------------------
# Variante 2: rsync über SSH (Passwort via sshpass, sonst interaktiv)
# ---------------------------------------------------------------------------
deploy_rsync() {
  local rsh="ssh -o StrictHostKeyChecking=accept-new"
  local -a cmd=(rsync -rtvz --no-perms --no-owner --no-group --exclude .DS_Store --exclude Thumbs.db)
  if (( DRY_RUN )); then
    cmd+=(--dry-run)
  fi
  if command -v sshpass >/dev/null 2>&1; then
    cmd=(sshpass -p "$DEPLOY_PASS" "${cmd[@]}")
  else
    echo "Hinweis: sshpass fehlt – rsync fragt das Passwort ggf. interaktiv ab." >&2
  fi
  "${cmd[@]}" -e "$rsh" "${FILES[@]}" "${DIRS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
}

# ---------------------------------------------------------------------------
# Variante 3: OpenSSH sftp im Batch-Modus (Passwort interaktiv oder SSH-Key)
# ---------------------------------------------------------------------------
deploy_sftp() {
  local batch f d sub file
  batch="$(mktemp)"
  {
    echo "cd \"${DEPLOY_PATH}\""
    for f in "${FILES[@]}"; do
      echo "put \"$f\""
    done
    for d in "${DIRS[@]}"; do
      echo "-mkdir \"$d\""
      # Unterordner anlegen und Dateien rekursiv hochladen
      find "$d" -mindepth 1 -type d | sort | while read -r sub; do
        echo "-mkdir \"$sub\""
      done
      find "$d" -type f ! -name .DS_Store ! -name Thumbs.db | sort | while read -r file; do
        echo "put \"$file\" \"$file\""
      done
    done
    echo "bye"
  } > "$batch"

  if (( DRY_RUN )); then
    echo "[dry-run] sftp-Batch:"
    sed "s/^/  /" "$batch"
    rm -f "$batch"
    return 0
  fi
  echo "Hinweis: OpenSSH-sftp kann das Passwort nicht aus .env übernehmen – bitte eingeben." >&2
  sftp -o StrictHostKeyChecking=accept-new -b "$batch" "${DEPLOY_USER}@${DEPLOY_HOST}"
  local rc=$?
  rm -f "$batch"
  return $rc
}

# ---------------------------------------------------------------------------
# Werkzeug wählen
# ---------------------------------------------------------------------------
if command -v lftp >/dev/null 2>&1; then
  echo "Werkzeug: lftp"
  deploy_lftp
elif [[ "$DEPLOY_PROTOCOL" == "sftp" ]] && command -v rsync >/dev/null 2>&1; then
  echo "Werkzeug: rsync über SSH"
  deploy_rsync
elif [[ "$DEPLOY_PROTOCOL" == "sftp" ]] && command -v sftp >/dev/null 2>&1; then
  echo "Werkzeug: OpenSSH sftp"
  deploy_sftp
else
  echo "Fehler: Weder lftp, rsync noch sftp gefunden. Bitte lftp installieren (WSL: sudo apt install lftp)." >&2
  exit 1
fi

echo "Fertig."

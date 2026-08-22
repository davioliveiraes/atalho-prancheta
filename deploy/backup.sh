#!/usr/bin/env bash
#
# Backup do Atalho Prancheta: o banco e os QR Codes.
#
# Feito para rodar pelo cron da VPS, uma vez por dia. A instalação da linha do
# cron está em DEPLOY.md.
#
#   ./deploy/backup.sh
#
# Ajustes por variável de ambiente, todos com padrão razoável:
#
#   BACKUP_DIR    onde guardar          (padrão /var/backups/atalho-prancheta)
#   KEEP_DAYS     dias de retenção      (padrão 14)
#   COMPOSE_FILE  pilha a consultar     (padrão docker-compose.prod.yml)
#   MEDIA_VOLUME  volume dos QR Codes   (padrão atalho-prancheta_media_volume)
#   BACKUP_REMOTE destino do rclone     (vazio = só cópia local)

set -euo pipefail

# `pipefail` acima segura a armadilha mais desagradável deste script: sem ele,
# um `pg_dump` que falha no meio ainda produz um .gz válido — vazio — e o
# backup reportaria sucesso até o dia em que fosse preciso restaurar.

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/atalho-prancheta}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
MEDIA_VOLUME="${MEDIA_VOLUME:-atalho-prancheta_media_volume}"

# Tamanho abaixo do qual o arquivo não é backup nenhum: um dump de um banco com
# as tabelas do Django, mesmo sem um único link, passa folgado disto.
MIN_DUMP_BYTES=2000

log() {
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

falhar() {
    log "ERRO: $*"
    exit 1
}

cd "$PROJECT_DIR"

[ -f .env ] || falhar "não achei o .env em $PROJECT_DIR"

# Lê uma variável do .env sem executar o arquivo.
#
# `. ./.env` seria mais curto e está errado: o SECRET_KEY gerado costuma ter
# parênteses, `&` e `$`, que o shell tentaria interpretar — o arquivo quebra a
# leitura ou, pior, executa o que estiver ali. Do lado do Django, o decouple lê
# isto como texto puro, que é o que fazemos aqui.
env_valor() {
    sed -n "s/^[[:space:]]*$1[[:space:]]*=//p" .env |
        tail -n 1 |
        sed -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/'
}

# Mesmos padrões do settings.py, para o caso de o .env não declarar.
DB_USER="$(env_valor DB_USER)"
DB_NAME="$(env_valor DB_NAME)"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-atalho_prancheta}"

mkdir -p "$BACKUP_DIR"

# Duas execuções ao mesmo tempo brigariam pelo mesmo arquivo. Se a de ontem
# ainda estiver rodando, esta desiste — o cron chama de novo amanhã.
#
# A trava é um diretório porque `mkdir` é atômico em qualquer sistema de
# arquivos POSIX, sem depender do `flock` estar instalado. O preço é a trava
# sobreviver a um desligamento no meio do backup, e é o que a checagem de idade
# logo abaixo resolve.
LOCK_DIR="$BACKUP_DIR/.trava"

if [ -d "$LOCK_DIR" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +360)" ]; then
    log "trava com mais de 6 horas; tratando como abandonada"
    rmdir "$LOCK_DIR" 2>/dev/null || true
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "outro backup ainda está rodando; saindo"
    exit 0
fi

trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

stamp=$(date +%Y-%m-%d-%H%M)
dump="$BACKUP_DIR/banco-$stamp.sql.gz"
media="$BACKUP_DIR/media-$stamp.tar.gz"

# ---------------------------------------------------------------- Banco
#
# Escreve num arquivo temporário e só renomeia no fim: um backup interrompido
# pela metade não pode ficar com o nome de um backup inteiro.
log "banco: gerando $dump"
if ! docker compose -f "$COMPOSE_FILE" exec -T db \
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip >"$dump.parcial"; then
    rm -f "$dump.parcial"
    falhar "pg_dump falhou"
fi

if ! gzip -t "$dump.parcial" 2>/dev/null; then
    rm -f "$dump.parcial"
    falhar "o dump saiu corrompido"
fi

tamanho=$(wc -c <"$dump.parcial")
if [ "$tamanho" -lt "$MIN_DUMP_BYTES" ]; then
    rm -f "$dump.parcial"
    falhar "o dump tem $tamanho bytes — pequeno demais para ser este banco"
fi

mv "$dump.parcial" "$dump"
log "banco: pronto ($(du -h "$dump" | cut -f1))"

# ------------------------------------------------------------- QR Codes
#
# O volume é lido por um container à parte, montado só para leitura: não
# depende de o backend estar de pé.
log "media: gerando $media"
if ! docker run --rm \
    -v "$MEDIA_VOLUME:/media:ro" \
    -v "$BACKUP_DIR:/destino" \
    alpine tar czf "/destino/media-$stamp.tar.gz.parcial" -C /media .; then
    rm -f "$media.parcial"
    falhar "não consegui empacotar o volume $MEDIA_VOLUME"
fi

mv "$media.parcial" "$media"
log "media: pronto ($(du -h "$media" | cut -f1))"

# ------------------------------------------------------------- Retenção
#
# `-mtime +N` remove o que passou de N dias inteiros. Os `.parcial` entram na
# conta de propósito: sobraram de alguma execução interrompida.
apagados=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'banco-*.sql.gz' -o -name 'media-*.tar.gz' -o -name '*.parcial' \) \
    -mtime "+$KEEP_DAYS" -print -delete | wc -l)
log "retenção: $apagados arquivo(s) com mais de $KEEP_DAYS dias removido(s)"

# ------------------------------------------------------------ Fora daqui
#
# Backup que mora no mesmo disco do banco não é backup: o disco é justamente a
# coisa que pode morrer. Com BACKUP_REMOTE apontando para um destino de rclone
# (`b2:atalho-backups`, `drive:backups`…), a cópia sai da VPS aqui.
if [ -n "${BACKUP_REMOTE:-}" ]; then
    command -v rclone >/dev/null ||
        falhar "BACKUP_REMOTE está definido mas o rclone não está instalado"

    log "enviando para $BACKUP_REMOTE"
    rclone copy "$dump" "$BACKUP_REMOTE" --quiet
    rclone copy "$media" "$BACKUP_REMOTE" --quiet
    log "envio concluído"
else
    log "BACKUP_REMOTE não definido — a cópia ficou só nesta máquina"
fi

log "backup concluído"

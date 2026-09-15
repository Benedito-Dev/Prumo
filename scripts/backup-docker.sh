#!/usr/bin/env bash
# Backup do banco local, pelo container do Postgres.
#
# O pg_dump vem com o PostgreSQL e NÃO existe no container da API
# (node:22-alpine). O container `db` tem, então é ele quem gera o dump —
# a saída vem pelo stdout e é gravada aqui na máquina.
#
# Uso:
#   bash scripts/backup-docker.sh              # para ./backups
#   bash scripts/backup-docker.sh D:/copias    # para outra pasta
#
# Para o Neon ou outro banco remoto, use `npm run backup --prefix BackEnd`
# com a DATABASE_URL apontando para lá (exige o client do Postgres na
# máquina).
set -euo pipefail

PASTA="${1:-backups}"
MANTER="${BACKUP_MANTER:-7}"

mkdir -p "$PASTA"
ARQUIVO="$PASTA/prumo-$(date +%Y-%m-%d_%H-%M-%S).sql"

echo "💾 Copiando o banco para $ARQUIVO"

# --clean --if-exists: o arquivo apaga as tabelas antes de recriá-las, que
# é o que faz a restauração substituir o conteúdo em vez de duplicá-lo.
# -T não aloca TTY, senão o Windows insere \r no meio do SQL.
if ! docker compose exec -T db \
  pg_dump -U prumo -d prumo --no-owner --no-privileges --clean --if-exists \
  > "$ARQUIVO"; then
  echo "❌ pg_dump falhou. O container 'db' está de pé? (docker compose ps)"
  # Arquivo pela metade é pior que arquivo nenhum: alguém confiaria nele.
  rm -f "$ARQUIVO"
  exit 1
fi

TAMANHO=$(wc -c < "$ARQUIVO")
if [ "$TAMANHO" -lt 1000 ]; then
  echo "❌ O arquivo saiu com $TAMANHO bytes — pequeno demais para ser um banco."
  rm -f "$ARQUIVO"
  exit 1
fi

echo "✅ Backup pronto: $(( TAMANHO / 1024 )) KB"

# Mantém só os mais recentes. Sete dias cobrem o caso real: alguém percebe
# o estrago no dia seguinte, não em três meses.
EXCEDENTES=$(ls -1t "$PASTA"/prumo-*.sql 2>/dev/null | tail -n +$((MANTER + 1)) || true)
if [ -n "$EXCEDENTES" ]; then
  echo "$EXCEDENTES" | while read -r velho; do
    rm -f "$velho"
    echo "   removido (antigo): $(basename "$velho")"
  done
  echo "   (mantendo os $MANTER mais recentes)"
fi

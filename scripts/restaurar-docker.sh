#!/usr/bin/env bash
# Restaura o banco local a partir de um backup, pelo container do Postgres.
#
# O par obrigatório do backup-docker.sh: backup que nunca foi restaurado é
# esperança, não cópia de segurança. Teste ANTES de precisar.
#
# Uso:
#   bash scripts/restaurar-docker.sh                        # lista
#   bash scripts/restaurar-docker.sh backups/prumo-….sql --sim
#
# ATENÇÃO: substitui o conteúdo atual do banco.
set -euo pipefail

ARQUIVO="${1:-}"

if [ -z "$ARQUIVO" ] || [ "${ARQUIVO:0:2}" = "--" ]; then
  echo "Backups em ./backups (mais recente primeiro):"
  echo
  ls -1t backups/prumo-*.sql 2>/dev/null | head -20 || echo "  (nenhum)"
  echo
  echo "Para restaurar:"
  echo "  bash scripts/restaurar-docker.sh <arquivo> --sim"
  exit 0
fi

if [ ! -f "$ARQUIVO" ]; then
  echo "❌ Arquivo não encontrado: $ARQUIVO"
  exit 1
fi

# Confirmação explícita: este comando apaga dados, e um engano aqui custa
# o histórico de vendas.
if [ "${2:-}" != "--sim" ]; then
  echo "⚠️  Isto APAGA o conteúdo atual do banco e põe o do backup no lugar."
  echo "   Arquivo: $ARQUIVO"
  echo
  echo "   Se é isso mesmo, repita com --sim no fim."
  exit 1
fi

echo "♻️  Restaurando de $(basename "$ARQUIVO")…"

# ON_ERROR_STOP=1: sem isso o psql segue depois de um erro e o banco fica
# meio restaurado — o pior desfecho possível.
if ! docker compose exec -T db \
  psql -U prumo -d prumo -v ON_ERROR_STOP=1 -q < "$ARQUIVO"; then
  echo "❌ Restauração falhou. O banco pode estar num estado parcial —"
  echo "   restaure de novo a partir de um backup íntegro."
  exit 1
fi

echo "✅ Banco restaurado."
echo "   Reiniciando a API para ela reconectar…"
docker compose restart api > /dev/null
echo "   Pronto."

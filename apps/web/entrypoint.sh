#!/bin/sh
set -e
echo "→ Rodando migrations do Prisma..."
node /app/migrate.js
echo "→ Iniciando app..."
exec node apps/web/server.js

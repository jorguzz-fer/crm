# ─── Stage 1: deps ───────────────────────────────────────────────────────────
# NODE_ENV=development necessário para instalar devDependencies (prisma CLI, typescript)
# NÃO use NODE_ENV=development no builder — causa erro <Html> no prerender (Auth.js + React SSR)
FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10

# Copia manifests de todos os workspaces para layer caching
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/validators/package.json ./packages/validators/
COPY packages/ai/package.json ./packages/ai/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --no-frozen-lockfile

# Copia source dos packages workspace DEPOIS do install
# Docker dereferenceia symlinks pnpm durante COPY --from, então o source
# precisa estar presente na stage deps para node_modules/@crm/* ter src/
COPY packages/db/src ./packages/db/src
COPY packages/validators/src ./packages/validators/src
COPY packages/ai/src ./packages/ai/src
COPY packages/ui/src ./packages/ui/src

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Recria symlinks dos workspace packages após COPY . .
# Docker preserva symlinks do COPY --from mas o target precisa existir;
# ln -sf garante resolução correta independente do comportamento do runtime pnpm
RUN mkdir -p node_modules/@crm && \
    rm -rf node_modules/@crm/db node_modules/@crm/validators node_modules/@crm/ai node_modules/@crm/ui && \
    ln -sf /app/packages/db         node_modules/@crm/db && \
    ln -sf /app/packages/validators node_modules/@crm/validators && \
    ln -sf /app/packages/ai         node_modules/@crm/ai && \
    ln -sf /app/packages/ui         node_modules/@crm/ui

# usa binary local — NÃO usa npx (baixaria Prisma v7 quebrando o schema v6)
RUN node_modules/.bin/prisma generate --schema=packages/db/prisma/schema.prisma

# Build apenas o app web
RUN pnpm --filter @crm/web run build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Migrations para o migrate.js
COPY --from=builder /app/packages/db/prisma/migrations ./prisma/migrations
COPY --from=builder /app/apps/web/migrate.js ./migrate.js

# NÃO copia o Prisma CLI (.bin/prisma) — symlink quebra WASM + 30+ deps ausentes
# Copia apenas @prisma/ para o PrismaClient funcionar no migrate.js
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# bcryptjs necessário para scripts de seed/admin
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

COPY --from=builder /app/apps/web/create-superadmin.js ./create-superadmin.js
COPY --from=builder /app/packages/db/prisma/seed.js ./prisma/seed.js
COPY --chown=nextjs:nodejs apps/web/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["./entrypoint.sh"]

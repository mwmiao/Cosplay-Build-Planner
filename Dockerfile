# syntax=docker/dockerfile:1
# Cosplay Build Planner — production image (linux/amd64 for UGREEN DXP2800 / Intel N100).

FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---- build -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate \
 && npm run build \
 && npx esbuild scripts/admin/claim-projects.ts scripts/admin/reset-password.ts scripts/admin/set-admin.ts \
      --bundle --platform=node --format=cjs --external:@prisma/client --outdir=dist/admin

# ---- runtime ---------------------------------------------------------------
FROM base AS runner
# Set by CI (package.json version, commit SHA, build time); shown in Settings.
ARG APP_VERSION=dev
ARG APP_COMMIT=
ARG BUILD_DATE=
LABEL org.opencontainers.image.source="https://github.com/mwmiao/Cosplay-Build-Planner" \
      org.opencontainers.image.title="Cosplay Build Planner" \
      org.opencontainers.image.version=$APP_VERSION
ENV APP_VERSION=$APP_VERSION \
    APP_COMMIT=$APP_COMMIT \
    BUILD_DATE=$BUILD_DATE \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=1337 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/cosplay.db \
    UPLOAD_DIR=/app/data/uploads \
    PUID=1000 \
    PGID=1000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/backup.mjs ./scripts/backup.mjs
# Admin commands: docker exec cosplay-planner node scripts/claim-projects.js --email …
COPY --from=builder /app/dist/admin/ ./scripts/
# Prisma CLI (for migrations) and native modules the standalone trace can miss
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||1337)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

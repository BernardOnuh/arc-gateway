# Stableflowr API. Build from the repo root:  docker build -t arc-gateway-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/gateway-sdk/package.json packages/gateway-sdk/
COPY packages/arc-widget/package.json packages/arc-widget/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter arc-gateway...

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
# Production dependencies only.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/gateway-sdk/package.json packages/gateway-sdk/
COPY packages/arc-widget/package.json packages/arc-widget/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter arc-gateway... && pnpm store prune
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
# Migrations run as a separate one-off step (see docker-compose.prod.yml), not on every boot.
CMD ["node", "dist/server.js"]

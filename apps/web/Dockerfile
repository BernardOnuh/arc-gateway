# ARC Gateway web app (marketing, dashboard, hosted checkout). Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_GATEWAY_URL=https://api.example.com -t arc-gateway-web .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG VITE_GATEWAY_URL
RUN test -n "$VITE_GATEWAY_URL" || (echo "VITE_GATEWAY_URL build arg is required" && exit 1)
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/gateway-sdk/package.json packages/gateway-sdk/
COPY packages/arc-widget/package.json packages/arc-widget/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @arc/web...
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @arc/gateway-sdk build && pnpm --filter @arc/widget build && pnpm --filter @arc/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# The standalone widget for partners' script tags: /widget/arc-widget.js
COPY --from=build /app/packages/arc-widget/dist/standalone /usr/share/nginx/html/widget
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

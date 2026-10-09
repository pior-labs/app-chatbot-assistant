FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/web/package.json packages/web/package.json
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token)" \
    pnpm install --filter @assistant/web... --frozen-lockfile

COPY packages/web packages/web
RUN pnpm --filter @assistant/web build

FROM caddy:2-alpine AS runtime
COPY packages/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web/dist /srv
EXPOSE 80

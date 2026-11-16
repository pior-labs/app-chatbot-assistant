FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/web/package.json packages/web/package.json
# pnpm only expands credentials from user-level config, so the registry auth
# line lives in a temporary user config. It holds the literal ${GITHUB_TOKEN};
# the token itself comes from the build secret and is never written to a layer.
RUN --mount=type=secret,id=github_token \
    printf '%s\n' '//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}' > /tmp/registry-auth.npmrc && \
    GITHUB_TOKEN="$(cat /run/secrets/github_token)" \
    NPM_CONFIG_USERCONFIG=/tmp/registry-auth.npmrc \
    pnpm install --filter @assistant/web... --frozen-lockfile && \
    rm /tmp/registry-auth.npmrc

COPY packages/web packages/web
RUN pnpm --filter @assistant/web build

FROM caddy:2-alpine AS runtime
COPY packages/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web/dist /srv
EXPOSE 80

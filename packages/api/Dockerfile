FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --filter @assistant/api... --frozen-lockfile

COPY packages/api packages/api
RUN pnpm --filter @assistant/api build

FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --filter @assistant/api... --prod --frozen-lockfile
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/drizzle packages/api/drizzle

CMD ["node", "packages/api/dist/index.js"]

# Szarans Assistant

Stage one implements application SSO through existing Pior Labs service-auth.
React/Vite provides sign-in/current-user/sign-out; Hono verifies app-owned
PostgreSQL sessions through Better Auth. Chat and assistant features remain planned.

Identity: display **Szarans Assistant**, hostname `chat.szarans.ca`, app/client/database
slug `assistant`, cookie prefix `szarans-assistant`.

## Local setup

Use Node 22, pnpm 10.8.1 (`corepack enable`), an existing local PostgreSQL server,
and package-read access to `@pior-labs/design-system` on GitHub Packages. Run one
Pior Labs app at a time at **http://localhost:5173**. Use the hosted issuer
`https://auth.szarans.ca/api/auth`; normal development needs no local service-auth.

1. Set `GITHUB_TOKEN` with package-read access. Run `pnpm install --frozen-lockfile`.
2. Like Cookbook, connect to the existing local PostgreSQL server over its Unix
   socket using peer authentication as your OS user (`pior` on Piotr's machine).
   No local database password or separate app role is needed. Create the app's
   own database, owned by that user:

   ```bash
   createdb assistant_dev
   ```

   If `assistant_dev` already exists but is owned by `postgres`, fix ownership
   instead of recreating it:

   ```bash
   sudo -u postgres psql -c 'ALTER DATABASE assistant_dev OWNER TO pior;'
   ```

3. Copy `.env.example` to `.env.local`. Use
   `DATABASE_URL=postgresql://pior@localhost:5432/assistant_dev?host=/var/run/postgresql`,
   substituting your OS/PostgreSQL username if needed. Generate
   an independent app secret with `openssl rand -base64 32` and set
   `BETTER_AUTH_SECRET`. Obtain the registered Assistant client secret and set
   `CENTRAL_AUTH_CLIENT_SECRET` on the API only.
4. Confirm service-auth registered client `assistant` with exact callback
   `http://localhost:5173/api/auth/oauth2/callback/auth-pior`. Keep
   `BETTER_AUTH_URL=http://localhost:5173` and the hosted issuer.
5. Run `pnpm db:migrate`, then `pnpm dev`. Visit localhost:5173. Vite proxies
   `/api/*` to the API on 3000; both packages read root `.env.local`.

Local API startup, migrations and Drizzle commands prefer root `.env.local`, with
`.env` as a fallback. Exported shell/container variables take priority. Vite also
supports root `.env.local` and its standard mode-specific files. With
`NODE_ENV=production`, the API and database commands ignore `.env.local`; deploy
using injected variables and the server-managed database URL file. Both env files
are ignored by Git. `DATABASE_URL` is used by `pnpm dev` and migrations;
`DOCKER_DATABASE_URL` is only for the API running in Docker.
The socket URL is for host-run development only; containers need a TCP URL with
appropriate credentials. Production continues using its dedicated app role and
platform-managed connection file.

This app never seeds real household users. First successful login creates a local
user/account linked to the stable central subject; service-auth owns both identities.

## Environment

| Variable                           | Purpose                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                     | Local app database URL, server only.                             |
| `DATABASE_URL_FILE`                | Runtime connection file, takes precedence over `DATABASE_URL`.   |
| `CENTRAL_AUTH_ISSUER`              | Hosted `https://auth.szarans.ca/api/auth`; discovery is derived. |
| `CENTRAL_AUTH_CLIENT_ID`           | Dedicated registered `assistant` client.                         |
| `CENTRAL_AUTH_CLIENT_SECRET`       | Matching plaintext service-auth client secret; API only.         |
| `BETTER_AUTH_SECRET`               | Separate random app secret, at least 32 characters; API only.    |
| `BETTER_AUTH_URL`                  | Localhost:5173 locally; `https://chat.szarans.ca` in production. |
| `API_PORT`, `WEB_PORT`             | Default 3000/5173; local callback is registered at 5173.         |
| `APP_SLUG`, `COMPOSE_PROJECT_NAME` | `assistant`, unique container namespace.                         |
| `DOCKER_DATABASE_URL`              | Optional local container URL to existing local Postgres.         |
| `PLATFORM_DATABASE_URL_FILE`       | Production host file mounted at `/run/secrets/database_url`.     |
| `GITHUB_TOKEN`                     | Registry install/build access, never a frontend variable.        |

Production requires HTTPS. Only the configured app origin is trusted. No OAuth or
session secret belongs in `VITE_*`, Git or the web container.

## Sessions and auth contract

Better Auth is pinned to the platform's 1.6.20 version. Its generic OAuth callback
is `/api/auth/oauth2/callback/auth-pior`, matching Cookbook and the actual trusted
client registry. [Newer online documentation](https://better-auth.com/docs/plugins/generic-oauth)
describes a different callback; upgrade only after reconciling the platform contract.
PKCE/client-secret POST exchange, one-time state and required issuer validation
protect the flow. Identity comes from authenticated central UserInfo (`sub`,
`email`, `name`), rather than this pinned library's unsigned ID-token decoding.
Automatic email-based account linking is disabled.

`GET /api/me` returns only current verified user ID/name/email. New `/api/*` routes
require auth by default, except health and Better Auth's own protocol endpoints.
Absent, forged, expired, revoked and foreign-app sessions return 401. Protected
requests query Postgres; cookie session caching is disabled. Auth/user responses
use `Cache-Control: no-store`.

App sessions last seven days and renew at most daily on eligible session checks.
Reload/API restart preserves a valid DB session. Sign-out revokes only this app's
session and clears its cookie. **Central SSO and other apps stay signed in.**
Signing in again may immediately reuse the central user; this is not an account
switch or household-wide logout. Central logout does not retroactively revoke
app sessions. Central token lifetimes and app session lifetimes are independent;
no central refresh is needed to verify an existing app session.

All cookies use `szarans-assistant`, including emitted `szarans-assistant.state`
and `szarans-assistant.session_token`. HTTPS adds `__Secure-` and Secure. Cookies
are HttpOnly, SameSite=Lax and host scoped; no shared parent-domain cookie.

## Verification

```bash
pnpm exec playwright install --with-deps chromium
pnpm verify
```

`verify` runs format, lint, typechecks (including tests), production builds,
DB-backed auth integration tests and desktop/mobile Chromium smoke. Individual
commands: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`,
`pnpm test`, `pnpm test:browser`. CI uses the same command with frozen installs.
Browser failures retain traces in `test-results/`.

Tests run real Hono/Better Auth/Drizzle and the committed migration. Only external
SSO is scripted: two fixture identities, real HTTP discovery/authorization/PKCE/
UserInfo and negative cases. Root `.env`/`.env.local` credentials are ignored. Docker creates
and removes a disposable loopback-only PostgreSQL 17 container for tests.
Alternatively set `TEST_DATABASE_URL` to a disposable test server permitting
CREATE/DROP DATABASE. Tests only create/drop fresh `assistant_test_<random>`
databases; never supply production credentials. Ports 3000/5173 must be free for
browser smoke. Fixture passes do not prove real household SSO.

## Provisioning and live acceptance

See [stage-one setup/evidence](docs/implementation/stage-one-evidence.md).
Separate companion PRs register the OAuth client and prepare database/Caddy routes.
Piotr owns merge and production deployment. Wildcard DNS covers `chat.szarans.ca`.
The web container serves the SPA only; platform Caddy routes API directly.

Keep deployment manual. Set `DEPLOY_DIR`, `APP_ENV`, package access, canonical URL
and independent secrets. Mount only the platform-generated app file at
`/opt/docker/pior-labs/secrets/app-chatbot-assistant/database-url` through production
Compose; app deployment runs migrations. No production changes have been applied.
Live SSO must separately verify both household users, localhost callback, reload,
protected API, sign-out and central-session behavior. Assistant-model evals do not
apply to stage one.

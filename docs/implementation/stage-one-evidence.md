# Stage-one review and setup evidence

Piotr selected **Szarans Assistant**, hostname `chat.szarans.ca`, cookie prefix
`szarans-assistant`, slug/client/database `assistant`. Scope is application SSO;
chat UI/assistant capabilities remain later stages.

## Review handoff

Inspect app/companion diffs against each `origin/main`, real source, migrations,
fixtures, negative assertions, browser journeys and CI. Acceptance: both users
identify correctly, distinct app sessions persist, missing/invalid/expired sessions
reject, app logout revokes, cookies avoid collisions, local setup reproduces.
Fixture verification and live acceptance are separate. Fix undisputed in-scope
defects; Piotr resolves disputed architecture/scope and owns merge/deployment.

Final tested revision, results and fresh-context review findings are recorded
below before PR handoff. No live assistant-model evals apply.

## Setup dependencies

1. Approve/merge service-auth companion change. Generate fresh
   `ASSISTANT_CLIENT_SECRET` there, and provide the same plaintext as app API
   `CENTRAL_AUTH_CLIENT_SECRET`. Restart service-auth to reload trusted-client cache,
   then run the existing `pnpm db:seed`. It skips existing users and upserts all
   configured OAuth clients; keep the existing seed variables and client secrets
   configured as before. Callbacks are exactly
   `https://chat.szarans.ca/api/auth/oauth2/callback/auth-pior` and
   `http://localhost:5173/api/auth/oauth2/callback/auth-pior`.
2. Supply local app secrets (independent `BETTER_AUTH_SECRET`), dedicated local
   database and package-read credential. Follow README and exercise both household
   users separately through the hosted issuer.
3. Approve/merge platform-deploy companion change; run its provisioning workflow
   to create `assistant`, restricted role `assistant_app` and server connection
   file. Set `ASSISTANT_SITE=https://chat.szarans.ca` and reload Caddy. No per-app
   DNS record or Docker HTTPS alias is needed.
4. Configure app manual deployment (`DEPLOY_DIR`, `APP_ENV`, package access,
   canonical URL and file mount). App migrations precede startup.

No trusted client registration, secret provisioning, production database changes,
merge or deployment have been performed. Real user/token-exchange SSO is blocked
until registration and matching app credentials are supplied. Hosted discovery
was reached and advertises expected issuer/endpoints and issuer parameter support;
this alone does not prove real login. Never put household passwords in fixtures.

## Live checklist (pending)

- Both users sign in locally through hosted SSO. Check correct name/email in
  `/api/me`, distinct local IDs and stable central subjects.
- Reload/restart preserves session; sign-out revokes the old cookie.
- Central login/other app sessions remain active. New sign-in may reuse central login.
- Check callback and cookie namespace; repeat at canonical HTTPS origin after
  production deployment, including Secure cookies.

## Verification and review results

SSO code revision `39fd82cd89b96449bbb64e1d6bef4a6a630c8bfc` passed the suite below.
The later seed-workflow update changes app documentation only; its content, links
and formatting are checked separately.
Deterministic verification: `pnpm verify` passes formatting, ESLint, typechecks,
production API/SPA builds, eight database-backed auth tests and four desktop/mobile
browser cases. `pnpm install --frozen-lockfile --offline` passes using the existing
package cache. An online registry metadata request using the available GitHub CLI
token returned 403; a clean machine needs a credential with GitHub Packages read
access, and the app repository must have package access for CI. Cached local
installation is not evidence of that registry permission.

Companions: service-auth `pnpm typecheck`, `pnpm build` and
`pnpm --filter @auth/api test:assistant-client` pass. The registration test uses
a disposable PostgreSQL container and asserts hashed secret/rotation, callbacks,
PKCE, and preserved existing household fixtures and unrelated clients. Platform Caddy validation
passes using a dummy Cloudflare token and the compiled Caddy image; shell syntax,
registry rows and diff whitespace are checked. The full platform validation
script initially hit ENOSPC after building Caddy; validation was rerun directly
after removing only that build's compiler cache. No production credentials or
resources were used.

Fresh-context reviewer inspected all three diffs, requirements, real source,
negative tests and evidence. Resolved findings:

- Protected API session lookup renewed the DB row but omitted the browser renewal
  cookie. The route now forwards Better Auth's Set-Cookie headers; a DB-backed
  regression asserts both renewal effects. Reviewer independently reproduced the
  defect and verified the repair.
- UserInfo transport or malformed JSON failures could produce a dead-end 500 at
  the callback. The lookup now returns null on those failures, allowing Better
  Auth's retryable error redirect; malformed JSON regression and independent
  transport-failure verification pass.
- Browser server teardown needed graceful SIGTERM and a direct Node loader to
  remove disposable DB containers. Smoke passes and container cleanup is checked.

Real SSO with both household accounts is **pending**, not passing. Hosted discovery
alone passed. Registration, matching credentials, local real-login verification,
production provisioning/deployment and human merge approval remain outstanding.

## Seed workflow simplification

Piotr requested using the existing service-auth `pnpm db:seed` workflow. The
Assistant-specific seed command and extracted helper were removed; the original
seed implementation remains unchanged and registers Assistant alongside the other
configured clients. The isolated registration regression exercises that command.

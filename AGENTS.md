# Pior Labs Application Agent Instructions

This repository is intended to become a Pior Labs user-facing application.

## Assistant planning and development contract

This application is `pior-labs/app-chatbot-assistant`, generated from the Pior Labs webapp template. Read [the planning index](docs/planning/pior-labs-assistant-notes.md) before starting a task, then read the relevant owning documents:

- [Product decisions](docs/planning/pior-labs-assistant-product.md)
- [Architecture and integrations](docs/planning/pior-labs-assistant-architecture.md)
- [Development workflow](docs/planning/pior-labs-assistant-development-workflow.md)
- [Required verification](docs/planning/pior-labs-assistant-verification.md)

Accepted decisions are requirements. Recommendations, proposed layouts and outstanding decisions remain open; do not silently promote them to requirements. These versioned repository documents are the planning source of truth. Update the owning document when Piotr agrees to change a decision, and preserve the distinction between planned and implemented behavior. Current platform/service contracts remain authoritative for shared infrastructure and integration details; raise any conflict with an accepted product requirement before deviating.

Follow the accepted development order: working app SSO, then a reviewable UI, then incremental assistant capabilities. Establish the reproducible development environment and applicable tests/CI alongside the SSO stage, and expand verification as capabilities are implemented. The initial repository does not yet provide the planned test/eval/verification commands; add real checks incrementally and do not represent unimplemented tooling as passing.

Codex CLI is the primary development tool. For meaningful implementation changes, use fresh-context review of the actual diff, source, acceptance criteria, test quality and verification evidence. Automatically repair clear, undisputed defects within the agreed scope and re-verify the revised code. Escalate disputed findings, scope changes and significant architectural decisions to Piotr. Final merge approval always belongs to Piotr; do not merge or enable automatic merge based on agent approval alone.

Run the applicable checks defined in the verification policy. During repairs, use focused checks for feedback and run the complete required deterministic suite on the final revision. Run live evals when the policy requires them; documentation-only changes need content/link review and relevant documentation checks. Do not weaken criteria, remove assertions, skip failing tests or lower thresholds merely to obtain a passing result. Report the verified revision, results, resolved findings and any blockers honestly.

## Before making architectural changes

Read the current public platform documentation in `pior-labs/platform` and, when starting a new application, use `platform/prompts/new-webapp-bootstrap.md` as bootstrap context.

When implementation details conflict with this template, current platform/service documentation wins.

## Default architecture

Prefer the established Pior Labs paved road:

- TypeScript
- React + Vite
- Hono
- PostgreSQL + Drizzle
- pnpm
- Docker Compose
- GitHub Actions
- `@pior-labs/design-system`
- `service-auth` for OAuth/OIDC
- platform Caddy for production routing and TLS
- a minimal Caddy runtime inside the web container for static SPA serving only

`platform-deploy` owns production reverse-proxy behavior. The app web container must not proxy `/api/*`; platform Caddy routes API traffic directly to the app API container and all other traffic to the app web container.

Choose one canonical `<app>.szarans.ca` hostname. The platform's Cloudflare and Tailscale wildcard DNS rules cover it automatically, so do not add per-application CNAME records, dnsmasq host records, or restricted nameservers. Caddy routing remains explicit. Add a Docker DNS alias only when canonical service-to-service HTTPS requires one.

Do not add a second authentication system, app-level reverse proxy, database server, or shared design system without a concrete requirement.

## Local authentication convention

- Run one user-facing application at a time on `http://localhost:5173`.
- Use the hosted issuer `https://auth.szarans.ca/api/auth`; normal application
  development does not require a local `service-auth`.
- Register the exact callback
  `http://localhost:5173/api/auth/oauth2/callback/auth-pior`.
- Give every application a unique Better Auth `cookiePrefix`. Localhost cookies
  are not isolated by port and persist when switching applications.
- Keep the OAuth client secret and application session secret server-only.

## Repository ownership

This repository owns:

- product code
- app-specific database schema and migrations
- app-specific containers
- the static web-server configuration used only to serve the compiled SPA
- CI and app deployment workflow
- application documentation

`platform-deploy` owns production infrastructure, Caddy reverse-proxy routing, shared Docker networks, database/role provisioning, and server-managed database credentials.

`service-auth` owns user authentication and trusted OAuth client registration.

## Security

- Never commit secrets.
- Prefer `DATABASE_URL_FILE` in production so database passwords remain server-managed.
- Never expose OAuth client secrets through `VITE_*` variables.
- Keep public ports closed unless there is a documented reason to publish them.
- Use health checks for long-running services.

## Template cleanup

When this template becomes a real app:

1. replace generic names and descriptions;
2. define the real domain schema;
3. generate and commit the first Drizzle migration;
4. choose an app-specific cookie prefix and register the OAuth client with the
   canonical and shared `localhost:5173` callbacks;
5. provision the database and Caddy routes in `platform-deploy`; wildcard DNS requires no per-app record;
6. configure deployment variables/secrets;
7. update this file only where the application genuinely deviates from platform conventions.

# Pior Labs assistant — architecture and integrations

Updated: October 8, 2026

[Planning index](pior-labs-assistant-notes.md). Accepted decisions are distinguished from recommendations and open implementation details.

## Accepted starting point

On October 8, 2026, Piotr chose [pior-labs/template-webapp](https://github.com/pior-labs/template-webapp) as the application starting point. Reuse its platform conventions and extend the generated app with assistant-specific capabilities. The accepted stage order is working SSO, then UI design, then incremental feature implementation. Piotr created [pior-labs/app-chatbot-assistant](https://github.com/pior-labs/app-chatbot-assistant) from this template. Repository and identity are settled: Szarans Assistant, slug/client/database `assistant`, cookie prefix `szarans-assistant`, hostname `chat.szarans.ca`. Initial release scope and detailed later milestones remain open.

## Accepted first stage: working application SSO

On October 8, 2026, Piotr specified SSO setup as step one for the new application. Implement the application-side integration with existing service-auth in the generated app. A shared-template change is not a prerequisite, and this does not mean creating another identity provider. The template intentionally supplies auth documentation/configuration rather than a complete app auth implementation.

Proposed stage-one completion criteria: both household users can sign in through central SSO, the app identifies the correct user and maintains its own properly namespaced session, protected API access rejects unauthenticated requests, and sign-out/session-expiry behavior works. Add the agreed development environment and relevant auth/access regression checks alongside this work. Register the dedicated client and use the current platform contract; no production auth configuration has been changed by this planning.

[The planning index](pior-labs-assistant-notes.md) owns the three-stage order. UI design follows working SSO; incremental assistant features follow the UI stage. Detailed stage boundaries and first-release scope remain to be defined.

## Inspected template baseline

Source inspection on October 8, 2026 used template commit `bb15eb46d89d3ec129fde76c25199979cdaada59`. The new application's initial commit `98d4cf3790cf0d1133e8ce5ab4c2d04823c158a6` has the same template tree. This is a source review, not an installation, build, deployment, or end-to-end verification.

| Area           | Observed baseline                                                                                | Assistant-specific work still needed                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace      | pnpm 10.8.1, TypeScript, `packages/web` and `packages/api`                                       | App metadata, domain modules, reproducible dependencies and lockfile.                                                                                              |
| Web            | React 19, Vite, Tailwind v4, shared design-system dependency                                     | Chat UI, streaming interaction, history, attachments, confirmation and memory views.                                                                               |
| API            | Hono on Node; health and hello routes                                                            | Authentication/session integration, assistant execution, history, memory, tools and authorization.                                                                 |
| Database       | Postgres client, Drizzle config, migration runner, example schema                                | Actual assistant schema and migrations; isolated dev/test databases and seeded data.                                                                               |
| Auth           | Configuration and documented central SSO convention                                              | No implemented auth/session route or Better Auth dependency in the inspected template. Register a dedicated service-auth client and implement the app integration. |
| CI             | Typecheck and build; Node 22; install with `--no-frozen-lockfile`                                | Formatting/lint, software tests, browser tests, agreed verification command and evidence reporting.                                                                |
| Containers     | API/web Compose scaffolding, health checks, shared external networks; manual deployment scaffold | App-specific provisioning/configuration and a disposable test environment that does not require production data or secrets.                                        |
| Agent guidance | Platform-focused `AGENTS.md`                                                                     | App-specific acceptance criteria, review/repair policy, test/eval commands and reviewer handoff.                                                                   |

The complete inspected tree has no committed lockfile, automated test files, or test/lint scripts. These are baseline gaps to address in the generated application; this planning does not authorize editing the shared template itself.

Sources for the inspected baseline:

- [README](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/README.md)
- [AGENTS.md](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/AGENTS.md)
- [Root package manifest](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/package.json)
- [API manifest](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/packages/api/package.json)
- [Web manifest](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/packages/web/package.json)
- [API entrypoint](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/packages/api/src/index.ts)
- [CI](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/.github/workflows/ci.yml)
- [Compose](https://github.com/pior-labs/template-webapp/blob/bb15eb46d89d3ec129fde76c25199979cdaada59/docker-compose.yml)

## Platform ownership and development conventions

Reviewed the current [platform README](https://github.com/pior-labs/platform/blob/main/README.md), [new-app bootstrap prompt](https://github.com/pior-labs/platform/blob/main/prompts/new-webapp-bootstrap.md), and [service-auth README](https://github.com/pior-labs/service-auth/blob/main/README.md).

- The application owns chat/assistant code, its schema/migrations, app containers, tests/evals, app CI and documentation.
- `platform-deploy` owns shared Caddy routing/TLS, database/role provisioning, production credentials and shared Docker networks.
- `service-auth` owns identity and OAuth/OIDC client registration. Use a dedicated app client, session secret and cookie prefix; do not create another identity system.
- `@pior-labs/design-system` supplies shared UI foundations; app-specific chat components can extend it.
- Current platform/bootstrap/template instructions specify one local app at a time on `http://localhost:5173`, with Vite proxying its API and normal development authenticating against hosted `https://auth.szarans.ca/api/auth`.
- The service-auth README includes older/local-client examples using port 3001. Verify the actual OAuth client registration and current integration implementation before coding; do not copy a conflicting example callback into the new app. Detailed production auth/deploy/design-system implementation was not audited here.
- Standard deployment uses a canonical `<app>.szarans.ca` hostname, explicit platform Caddy routes and wildcard DNS. Remote access without Tailscale needs a separately chosen messaging or ingress approach; selecting the template does not make the app public.

On October 10, 2026, Piotr requested root `.env.local` for local settings. API
startup, migrations and Drizzle commands now load it ahead of `.env`, without
overwriting exported variables. Production API/database commands skip `.env.local`.
Vite already supports root `.env.local`. These files stay ignored by Git.

On October 10, 2026, Piotr selected Cookbook's local database approach: use the
existing host PostgreSQL instance with Unix-socket peer authentication as the
OS/PostgreSQL user (`pior`), and a separate user-owned `assistant_dev` database.
API startup, migrations and Drizzle tools support the `?host=/var/run/postgresql` connection
parameter. This is host-run development only; production retains its dedicated
app role and platform-managed credentials, and containers use TCP credentials.

## Proposed application structure

Keep one application repository with the template's web and API packages. Within the API, organize conversations/context, model access, memory/recall, approvals/action execution, and app-owned MCP clients as distinct modules. This is a recommendation pending architecture discussion, not a finalized implementation layout.

The same assistant backend can serve web chat and a future messaging adapter. Keep Cookbook and Finance business rules in those applications rather than reading or mutating their databases directly. Use narrow app-owned MCP capabilities with current-user permissions. The current Cookbook write/import contract must be inspected before implementation; older platform documentation describes read-only MCP and may lag the user's completed work.

Open implementation choices: direct model API versus an orchestration library; streaming transport; attachment storage and lifecycle; retrieval/indexing; action approval records and retry reconciliation; observability; background job tooling; provider adapter authentication. Do not add separate services merely to represent logical modules.

## Background behavior

- Always available: the service waits for messages and runs the assistant on demand, even when the website is closed. No continuous LLM loop is required.
- Proactive work: scheduled or event-triggered jobs use a background worker, persisted job state, and a notification channel.
- Start with one assistant and multiple tools; specialized agents are optional later.
- Suggested order, not a finalized implementation plan: web chat plus Cookbook; calendar and finance; messaging; proactive tasks.

## Messaging considerations to revisit

WhatsApp is a desired option, not a finalized integration choice. Its official help documents a third-party agent feature with limited country/account availability. Verify account access and developer integration before committing. The Business Platform excludes personal use. Third-party agent chats are not end-to-end encrypted, so consider how much finance data to return through this interface.

Sources checked October 8, 2026:

- https://faq.whatsapp.com/1050934623978152
- https://www.whatsapp.com/legal/third-party-agents-terms
- https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-Platform

Link messaging identities to Pior Labs users and preserve each user's app permissions. Proposed default: share durable user preferences across channels, keep conversation threads separate unless explicitly continued.

## Related plans

- [Product decisions and calendar scope](pior-labs-assistant-product.md)
- [Codex development workflow](pior-labs-assistant-development-workflow.md)
- [Required verification policy](pior-labs-assistant-verification.md)

## Stage-one implementation status

Stage-one branch now supplies application Better Auth OAuth/PKCE, authenticated
central UserInfo identity mapping, app-owned Postgres sessions and Drizzle migration,
protected `/api/me`, and minimal sign-in/user/sign-out. `pnpm verify` runs format,
lint, typechecks, builds, isolated DB-backed auth tests and desktop/mobile smoke;
CI runs the same command with frozen dependencies. These tests use HTTP SSO
fixtures; real household login remains a separate pending provider gate.

See [implementation plan](../implementation/stage-one-plan.md) and
[revision, review, verification and setup evidence](../implementation/stage-one-evidence.md).
Earlier template observations remain historical baseline evidence. Companion PRs
are unmerged/unprovisioned; Piotr retains merge/deployment approval. Chat UI,
assistant capabilities and their live-model evals remain later stages. Application
sign-out ends only this app session; central SSO remains active.

Piotr selected the existing service-auth `pnpm db:seed` command for client
registration. No Assistant-specific registration command is needed.

Piotr selected the existing Finance/Cookbook client configuration pattern for
Assistant: a `requiredEnv` secret with a development placeholder and an
unconditional client-registry entry. Configure the real secret before seeding.

# Stage one: application SSO

Branch: `feat/stage-one-sso`. Scope: application auth only; no assistant features.

1. Reconcile template, platform, service-auth and Cookbook contracts. Confirm identity before client registration.
2. Add pinned platform Better Auth integration, app-owned users/accounts/sessions/verifications and a committed Drizzle migration. Keep OAuth and session secrets in the API.
3. Add deny-by-default API authorization and a minimal sign-in/current-user/sign-out interface using shared design tokens.
4. Establish frozen installs, format/lint/type/build checks, isolated PostgreSQL OAuth fixtures, browser smoke, and CI using the same verification command.
5. Prepare separate service-auth/platform-deploy changes, document setup and live-verification dependencies, and update planning status.
6. Obtain fresh-context review of actual changes and evidence; repair clear defects, rerun checks, and open reviewable PRs. Piotr owns merge/deployment.

Contract evidence: service-auth's actual client registry uses localhost:5173 (README's 3001 examples lag); seed hashes secrets and requires PKCE/client_secret_post. Cookbook pins Better Auth 1.6.20 with generic OAuth callback `/oauth2/callback/auth-pior`. Current online Better Auth docs describe a newer callback contract: inspect the pinned implementation rather than change the platform callback blindly.

# Deployment operations

This repository owns its release images and database migrations. Shared ingress,
networks and database provisioning remain in `platform-deploy`. The workflow is
manual by choice. These procedures apply after this revision is merged; source
configuration alone does not provision a runner or establish a live deployment.

## Configure before first deployment

- Register the dedicated repository runner with the labels in `deploy.yml`.
  Runner provisioning remains a separate host operation.
- Keep `DEPLOY_DIR` a dedicated absolute application directory with write access
  for that runner. Python 3, curl with `--retry-all-errors`, Docker Compose with
  `up --wait`, and GHCR access are required. Registry credentials use the
  workflow's temporary `GITHUB_TOKEN`; production installs no Node dependencies.
- Set the separate Actions secret `COMPOSE_PROJECT_NAME` to the **existing**
  production Compose project identity. Inspect an existing container's
  `com.docker.compose.project` label before migrating; a different name can
  create a second project or collide with named containers. For a new app,
  choose its unique project name before initial deployment.
- Keep the existing `APP_ENV` Actions secret for the remaining runtime settings.
  Legacy project-name declarations are replaced in the staged `.env` with the
  separate secret. Further environment splitting can happen independently.
- Confirm this repository can create/read its GHCR packages. Existing packages
  need Actions access for this repository. Keep visibility private unless a
  public release is deliberately agreed.
- Provision shared database credentials, networks, OAuth client and Caddy routes
  before deployment. The application cannot establish those dependencies itself.

## Release and deployment

PR CI performs the repository's application checks, release-tool tests and Docker
builds without publishing. Successful pushes to main publish all configured
service images to `ghcr.io/pior-labs/app-chatbot-assistant-<service>` and save a
`release-<attempt>` manifest containing their digests and source commit.

1. Merge the reviewed application change and wait for the **whole CI run on main**
   to succeed, including Build release images.
2. Open Deploy and select branch `main`. Supply the full numeric CI run ID from
   `/actions/runs/<ID>` in the successful run's URL, **not** its displayed #number.
3. Leave `ci_run_attempt` blank for the latest successful attempt, or supply the
   exact recorded attempt when redeploying an older release.
4. The hosted resolve job verifies run/workflow identity, main ancestry, successful
   conclusion and artifact contents before the production runner is used.
5. Production pulls verified images, runs migrations, waits for container health,
   and probes `https://chat.szarans.ca` through platform ingress. It neither rebuilds images nor
   fetches a moving production branch.

All workflow-managed production operations share this repository's production
concurrency group and do not cancel a running deployment. GitHub may replace a
pending request; this is not a FIFO queue. New maintenance workflows must use the
same group. Do not run manual host maintenance concurrently with deployment.

## Records and recovery

Runtime configuration is private beneath `$DEPLOY_DIR/releases/`. The successful
runtime is linked as `$DEPLOY_DIR/current`. For host diagnostics:

```sh
cd "$DEPLOY_DIR/current"
export COMPOSE_FILE="$PWD/compose.json"
docker compose ps
```

The resolved Compose file contains secrets, has no build definitions and pins
images by digest. Do not commit or upload it. The legacy root checkout is no
longer the active runtime configuration. Keep persistent application data outside
release directories.

`$DEPLOY_DIR/.deployments/current.json` records the last healthy release;
`previous.json` preserves the preceding healthy release; `attempt.json` records
the latest operation, including failure. Failed attempts preserve successful
records but may have changed the database or running containers. Inspect the
attempt's `runtime_dir` for diagnosis. There is no recorded predecessor for the
first deployment migrated from source builds.

To roll application images back, dispatch Deploy with the previous record's
`run_id` **and** `run_attempt`. The current secrets are used. Migrations are
forward-only; an older application must remain compatible with the current
schema. Use additive schema changes across rollout/rollback windows. Database
restoration requires a separate application-owned recovery procedure, never an
automatic downgrade after an unhealthy deployment.

Manifests are retained for 90 days. Keep their GHCR images for at least that long,
and never remove images used by the current or previous deployment. Expired
manifests cannot be selected. Private host runtime directories retain historical
secrets; clean them deliberately while preserving current/previous/attempted
runtimes and all persistent data.

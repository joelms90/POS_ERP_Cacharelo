# Staging Environment Plan (`014-staging-environment`)

## Goal

Introduce an isolated **staging** environment so day-to-day changes never touch
production, while keeping the current production environment exactly as it is.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Isolation | Separate GCP project (`cacharelo-staging`) |
| Environments | `staging` only (plus existing `prod`) |
| Staging APK distribution | GCS download page (like prod) |
| Production in Terraform | Not yet — staging only for now |

## Current state

- Single project `fresh-sensor-497515-d3` (`us-central1`) hosts **all** prod resources:
  Cloud Run `pos-sync-api`, Cloud SQL `pos-db-instance`, Firebase sites
  `cacharelo-pos` / `cacharelo-central`, GCS `cacharelo-pos-releases`.
- Terraform exists at `apps/sync_api/infra` (local state, drifted from reality) and
  `apps/landing_page/infra`.
- Deploys use `gcloud run deploy --source` / `flutter build` / `firebase deploy`
  with hardcoded prod values.
- Secrets (DB/admin password) are hardcoded in the Makefile and `terraform.tfvars`.

## Target layout

```
cacharelo prod  (fresh-sensor-497515-d3)      ← untouched
cacharelo-staging (NEW project)               ← managed by Terraform
  Cloud Run pos-sync-api · Cloud SQL pos-db-instance · Secret Manager
  Firebase Hosting cacharelo-pos-staging / cacharelo-central-staging
  GCS cacharelo-pos-releases-staging
```

### Repository layout

```
apps/sync_api/infra/
  bootstrap/                 # tfstate bucket (run once, separate state)
  modules/sync-api/          # reusable, parameterized infra module
  envs/staging/
    main.tf backend.tf variables.tf terraform.tfvars
  main.tf variables.tf outputs.tf   # LEGACY prod config (parked, not applied)
env/
  prod.env                   # prod values used by Makefile
  staging.env                # staging values used by Makefile
```

## Terraform design

- `modules/sync-api` is parameterized by `project_id`, `environment`, service/DB
  names, sizes, and secret configuration.
- Remote state in `gs://cacharelo-tfstate` with `prefix = "sync-api/staging"`.
- **Secret Manager** holds `pos-db-password`, `pos-database-url`, `pos-jwt-secret`,
  and `pos-admin-password`. Cloud Run references them with `value_source.secret_key_ref`;
  no secrets in git or the Makefile.
- Cloud Run (`google_cloud_run_v2_service`) is created with a placeholder image and
  `ignore_changes` on the image. Day-to-day deploys only replace the image, so
  Terraform keeps owning env/scaling/DB/secret wiring while the app image is
  delivered by `gcloud run deploy`.
- Staging Cloud SQL is `db-f1-micro`, `deletion_protection = false`.

## Makefile / configuration abstraction

- `env/prod.env` and `env/staging.env` hold per-environment values.
- Existing **prod targets stay unchanged**.
- New staging targets:
  - `make deploy-staging` — backend + admin + POS web (current working tree)
  - `make backend-deploy-staging`
  - `make backend-migrate-staging`
  - `make admin-deploy-staging`
  - `make flutter-web-deploy-staging`
  - `make flutter-apk-build-staging` / `make flutter-apk-upload-staging`
  - `make infra-init ENV=staging` / `infra-plan ENV=staging` / `infra-apply ENV=staging`

## Flutter APK targeting

- API URL injected at build time: `--dart-define=API_URL=<staging>/api`.
- Staging artifact name `pos_flutter_android_staging.apk` uploaded to the staging
  bucket; a staging `descargas.html` is served from the staging POS site.
- Phase 2 (optional): Android flavors (`staging`/`prod`, distinct `applicationId`)
  for side-by-side installs.

## Data

Staging DB is schema-only: run `scripts/idempotent-deploy-migrations.ts`, then seed
synthetic data. Never load raw production data (customer PII).

## Manual prerequisites

1. Create GCP project (e.g. `cacharelo-staging-XXXXXX`) and link billing.
2. Grant the deploying account Owner/Editor on it.
3. Enable Firebase on the project; create Hosting sites
   `cacharelo-pos-staging` and `cacharelo-central-staging`.
4. Create the tfstate bucket (via `bootstrap/`) or manually:
   `gs://cacharelo-tfstate` (versioned).
5. Fill `env/staging.env` with the real project id and Cloud Run URL.

## Phased rollout

1. Bootstrap tfstate bucket; create project/secrets.
2. `modules/sync-api` + `envs/staging`; `terraform apply`.
3. `env/*.env` + Makefile staging targets; run migrations + deploy backend.
4. Firebase staging sites; deploy admin + POS web.
5. Flutter APK staging build + upload + staging download page.

## Cost / risks

- ~$10–15/mo (one Cloud SQL micro; Cloud Run scales to zero; Firebase/GCS free tier).
- Project-id uniqueness; first Cloud SQL apply takes ~5–10 min.
- The legacy prod Terraform root and its local `terraform.tfstate` are left in place
  (parked). Do not run `terraform apply` from `apps/sync_api/infra/` anymore.
- `apps/sync_api/infra/terraform.tfvars` is currently tracked in git and may contain
  the prod DB password; rotate it and move secrets to Secret Manager.

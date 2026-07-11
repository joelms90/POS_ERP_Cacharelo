<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read:
specs/010-multi-role-users/plan.md
<!-- SPECKIT END -->

# UI Responsiveness Guidelines
- **Avoid Fixed Page Heights on Mobile**: Never apply fixed height classes like `h-screen` or `h-full` to page panel container wrappers on mobile. Use `lg:h-full min-h-full` and set `overflow-y-auto lg:overflow-hidden` so page content expands and scrolls vertically on mobile viewports.
- **Responsive Heading Sizes**: For long section headers, use responsive text size classes (e.g., `!text-lg sm:!text-2xl`) to avoid text clipping on narrow mobile screens.
- **Adaptive Split Layouts**: Double-panel views (e.g., table list on the left, creation form on the right) must stack vertically on mobile using `flex flex-col lg:flex-row gap-6` and `w-full lg:w-96` on the form to avoid content squishing.

# Production Deployment Quick Reference

Use the existing Makefile targets from the repository root. Prefer these commands over manually reconstructing `gcloud`, `firebase`, or Flutter build commands.

## Backend API (`apps/sync_api`)
- **Deploy Cloud Run**: `make backend-deploy-fast`
- **Check Cloud Run status/health**: `make backend-status`
- **View recent logs**: `make backend-logs`
- **Production service**: `pos-sync-api`
- **Project/region**: `fresh-sensor-497515-d3` / `us-central1`
- **Production API URL used by frontends**: `https://pos-sync-api-232144991863.us-central1.run.app/api`

## Production Database
- **Open Cloud SQL proxy for manual DB access**: `make db-proxy`
- **Run the general production migration target**: `make backend-migrate`
- **Important current caveat**: the full Drizzle migration runner can fail if production already has manually-created objects that are missing from Drizzle's migration journal, such as `admin_business_access`. For the multi-role users release, the safe production command was:
  `cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & PROXY_PID=$!; trap 'kill $PROXY_PID 2>/dev/null || true' EXIT; sleep 5; cd apps/sync_api && DATABASE_URL='postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db' npx tsx scripts/alter-users-roles.ts`
- The `alter-users-roles.ts` script is idempotent: it ensures `users.roles` exists and backfills empty arrays from legacy `users.role`.

## Business Control Admin (`apps/business_control_tauri`)
- **Build and deploy Firebase Hosting**: `make admin-deploy`
- **Production URL**: `https://cacharelo-central.web.app`
- **Configured API URL at build time**: `VITE_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api`
- After deployment, verify with: `curl -I https://cacharelo-central.web.app`

## Flutter POS Web (`apps/pos_flutter`)
- **Build and deploy Firebase Hosting**: `make flutter-web-deploy`
- **Production URL**: `https://cacharelo-pos.web.app`
- After deployment, verify with: `curl -I https://cacharelo-pos.web.app`
- Native Android, macOS, and Windows builds are separate release artifacts; `flutter-web-deploy` only updates the hosted web POS.

## Deployment Hygiene
- Commit functional changes before deployment.
- Firebase deploys update tracked `.firebase/hosting.*.cache` metadata files; commit those metadata changes after successful deploy.
- Do not include unrelated untracked files in deployment commits.
- If a deploy command fails due to sandbox access to `gcloud`, `firebase`, Cloud SQL Proxy, or local credential files, rerun the same command with escalated permissions.

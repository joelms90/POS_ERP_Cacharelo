# Cacharelo POS-ERP Deployment Agent

**Version**: 1.0
**Last Updated**: 2026-07-18
**Purpose**: Complete deployment knowledge base for the Cacharelo POS-ERP system

> **⚠️ Before deploying, read [`docs/pre-deployment-checklist.md`](../docs/pre-deployment-checklist.md)** for required migrations, one-time data backfills, and rebuild reminders.

---

## System Architecture Overview

The Cacharelo POS-ERP is a **monorepo** with three main deployment targets:

1. **Backend API** (`apps/sync_api/`) - NestJS on Google Cloud Run
2. **Admin Dashboard** (`apps/business_control_tauri/`) - React/Vite on Firebase Hosting
3. **POS Application** (`apps/pos_flutter/`) - Flutter on Firebase Hosting (Web) + Native builds

---

## Infrastructure

### Google Cloud Platform (GCP)
- **Project ID**: `fresh-sensor-497515-d3`
- **Region**: `us-central1`
- **Services Used**:
  - Cloud Run (Backend API)
  - Cloud SQL (PostgreSQL Database)
  - Cloud Storage (Backups/Assets)
  - Cloud Build (CI/CD)

### Firebase
- **Project**: `fresh-sensor-497515-d3`
- **Hosting Sites**:
  - `cacharelo-central` (Admin Dashboard)
  - `cacharelo-pos` (POS Web App)

### Database
- **Instance**: `pos-db-instance` (Cloud SQL PostgreSQL)
- **Database Name**: `pos_db`
- **User**: `pos_user`
- **Password**: `pos-secure-db-pass-2026!`
- **Proxy Port** (local): `5433`

---

## Production URLs

| Service | URL |
|---------|-----|
| Backend API | https://pos-sync-api-232144991863.us-central1.run.app/api |
| Admin Dashboard | https://cacharelo-central.web.app |
| POS Web App | https://cacharelo-pos.web.app |
| Health Check | https://pos-sync-api-232144991863.us-central1.run.app/api/health |

---

## Deployment Commands Reference

All deployment operations use **Makefile targets** from the repository root.

### Backend API Deployment

#### Quick Deploy (No Confirmation)
```bash
make backend-deploy-fast
```

**What it does**:
- Builds Docker image from `apps/sync_api/Dockerfile`
- Deploys to Cloud Run service `pos-sync-api`
- Configures Cloud SQL connection
- Sets environment variables
- No user confirmation required

**Configuration**:
- CPU: 2 cores
- Memory: 1Gi
- Min instances: 0 (scales to zero)
- Max instances: 10
- Timeout: 300 seconds
- Port: 8080

#### Deploy with Confirmation
```bash
make backend-deploy
```
Same as fast deploy but prompts for confirmation.

#### Check Deployment Status
```bash
make backend-status
```
Shows:
- Service URL
- Current revision
- Health check status

#### View Logs
```bash
make backend-logs
```
Shows last 20 log entries from Cloud Run.

#### Run Database Migrations
```bash
make backend-migrate
```

**What it does**:
- Starts Cloud SQL Proxy on port 5433
- Runs migration script: `apps/sync_api/scripts/manual-create-changelog.ts`
- Uses Drizzle ORM for schema changes
- Automatically stops proxy after completion

**Important**: The production database may have manually-created objects not in Drizzle's migration journal. Use idempotent migration scripts when necessary.

---

### Admin Dashboard Deployment

```bash
make admin-deploy
```

**Build Process**:
1. **Build**: `VITE_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api pnpm build`
   - Compiles TypeScript with Vite
   - Outputs to `apps/business_control_tauri/dist/`
2. **Deploy**: `firebase deploy --only hosting --project fresh-sensor-497515-d3`
   - Uploads to Firebase Hosting site `cacharelo-central`
   - Applies cache headers and SPA rewrites

**Environment Variables** (build-time):
- `VITE_API_URL`: Backend API URL (embedded in build)

**Firebase Configuration** (`apps/business_control_tauri/firebase.json`):
- **Public directory**: `dist`
- **SPA mode**: All routes redirect to `/index.html`
- **Cache headers**:
  - HTML: `no-cache` (always fresh)
  - Assets (JS/CSS/images): `public, max-age=31536000, immutable`

**Post-deployment**:
- Updates `.firebase/hosting.ZGlzdA.cache` (commit this file)
- Verify: `curl -I https://cacharelo-central.web.app`

---

### POS Web App & Download Portal Deployment

```bash
# Full release deployment (APK + Download Portal + Web POS + GCP Bucket Sync):
make flutter-portal-deploy

# Or web POS deployment only:
make flutter-web-deploy
```

**Build Process**:
1. **Version Update**: Update version string in `apps/pos_flutter/pubspec.yaml` (e.g. `version: 1.0.1+2` ➔ `version: 1.0.2+3`).
2. **Android APK Build**: `flutter build apk --release` (creates `build/app/outputs/flutter-apk/app-release.apk`).
3. **Web Build**: `flutter build web --release` (outputs to `apps/pos_flutter/build/web/`).
4. **Portal Assets Inclusion**: Copies `descargas.html` and `app-release.apk` into `build/web/`.
5. **GCP Storage Sync**: Uploads release APK to `gs://cacharelo-pos-releases/android/pos_flutter_android_latest.apk`.
6. **Deploy**: `firebase deploy --only hosting --project fresh-sensor-497515-d3`
   - Download Portal: `https://cacharelo-pos.web.app/descargas.html` (PIN `9876`)
   - POS Web App: `https://cacharelo-pos.web.app`
   - Uploads to Firebase Hosting site `cacharelo-pos`

**Firebase Configuration** (`apps/pos_flutter/firebase.json`):
- **Public directory**: `build/web`
- **SPA mode**: All routes redirect to `/index.html`
- **Same cache strategy** as admin dashboard

**Post-deployment**:
- Updates `.firebase/hosting.YnVpbGQvd2Vi.cache` (commit this file)
- Verify: `curl -I https://cacharelo-pos.web.app`

---

### Flutter Native Builds

#### Android APK (Direct Install)
```bash
make flutter-apk-build
```
Output: `apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk`

#### Android AAB (Play Store)
```bash
make flutter-android-build
```
Builds both APK and AAB:
- APK: `build/app/outputs/flutter-apk/app-release.apk`
- AAB: `build/app/outputs/bundle/release/app-release.aab`

#### macOS App Bundle
```bash
make flutter-macos-build
```
Output: `apps/pos_flutter/build/macos/Build/Products/Release/pos_flutter.app`

#### Windows Executable
```bash
make flutter-windows-build
```
Output: `apps/pos_flutter/build/windows/x64/runner/Release/`

**Note**: Must run on Windows host or use GitHub Actions workflow.

#### All Platform Builds
```bash
make flutter-all-releases
```
Sequentially builds: Web → Android → macOS → (Windows if available)

---

## Database Operations

### Local Development

#### Start Local PostgreSQL
```bash
make db-up
```
Starts Docker container with PostgreSQL.

#### Stop Local PostgreSQL
```bash
make db-down
```

#### Run Local Migrations
```bash
make db-migrate
```

#### Seed Local Database
```bash
make db-seed
```

#### Full Reset (Local)
```bash
make db-reset
```
Tears down, brings up, migrates, and seeds fresh database.

---

### Production Database Access

#### Connect via Cloud SQL Proxy
```bash
make db-proxy
```

**Connection Info** (for DBeaver/pgAdmin):
- Host: `127.0.0.1`
- Port: `5433`
- Database: `pos_db`
- Username: `pos_user`
- Password: `pos-secure-db-pass-2026!`

#### Clean Production Data (DESTRUCTIVE)

##### Delete All Transactional Data
```bash
make db-clean-prod
```
**Confirmation required**: Type `DELETE-PRODUCTION-DATA`

**Deletes**:
- All products, orders, inventory, payments

**Preserves**:
- Users, businesses, branches

##### Delete Today's Sales Only
```bash
make db-clean-today-prod
```
**Confirmation required**: Type `CLEAN-TODAY-SALES`

**Deletes**:
- Orders from today
- Payments from today
- Kitchen tickets from today
- Cash shifts from today
- Inventory movements from today

**Preserves**:
- Historical data (previous days)
- Users, products, branches

##### Delete Old Sales History (Keep Today)
```bash
make db-clean-old-history-prod
```
**Confirmation required**: Type `CLEAN-OLD-HISTORY`

Opposite of above - deletes everything except today.

##### Delete ALL Sales History
```bash
make db-clean-all-history-sales-prod
```
**Confirmation required**: Type `DELETE-ALL-SALES-HISTORY`

**EXTREME DANGER**: Deletes all sales data from all time. Cannot be undone.

---

## Deployment Workflows & Best Practices

### Pre-Deployment Checklist

Before deploying **any** component:

1. **Code Quality**:
   ```bash
   # Backend
   cd apps/sync_api && npm run lint

   # Flutter
   cd apps/pos_flutter && flutter analyze
   ```

2. **Tests**:
   ```bash
   # Backend
   cd apps/sync_api && npm test

   # Flutter
   cd apps/pos_flutter && flutter test
   ```

3. **Git Hygiene**:
   - Ensure you're on the correct branch
   - All changes committed
   - No uncommitted changes (except intentional untracked files)
   ```bash
   git status
   git log -1
   ```

4. **Database Migrations**:
   - If schema changed, run `make backend-migrate` FIRST
   - Verify migration success before deploying backend

5. **Environment Variables**:
   - Verify build-time env vars (VITE_API_URL for admin)
   - Verify runtime env vars (Cloud Run for backend)

---

### Deployment Order (Full System Update)

When deploying changes that affect multiple components:

1. **Database Migrations** (if needed)
   ```bash
   make backend-migrate
   ```

2. **Backend API**
   ```bash
   make backend-deploy-fast
   make backend-status  # Verify deployment
   ```

3. **Admin Dashboard** (if backend changes affect it)
   ```bash
   make admin-deploy
   ```

4. **POS Web App** (if backend changes affect it)
   ```bash
   make flutter-web-deploy
   ```

**Rationale**:
- Database changes must happen first (schema changes)
- Backend deploys next (API contract changes)
- Frontends deploy last (consume new API)

---

### Post-Deployment Verification

After each deployment:

1. **Backend API**:
   ```bash
   # Health check
   curl https://pos-sync-api-232144991863.us-central1.run.app/api/health

   # Check status
   make backend-status

   # Monitor logs for errors
   make backend-logs
   ```

2. **Admin Dashboard**:
   ```bash
   # Check HTTP status
   curl -I https://cacharelo-central.web.app

   # Manual testing:
   # - Open in browser
   # - Login
   # - Test critical flows
   ```

3. **POS Web App**:
   ```bash
   # Check HTTP status
   curl -I https://cacharelo-pos.web.app

   # Manual testing:
   # - Open in browser
   # - Login with multi-role user
   # - Test checkout flow
   # - Test kitchen view
   ```

---

### Deployment Metadata Commits

Firebase deployments update `.firebase/hosting.*.cache` files. These should be committed:

```bash
# After admin deploy
git add apps/business_control_tauri/.firebase/hosting.ZGlzdA.cache
git commit -m "chore: update admin hosting metadata"

# After POS deploy
git add apps/pos_flutter/.firebase/hosting.YnVpbGQvd2Vi.cache
git commit -m "chore: update pos hosting metadata"
```

**Do not** include unrelated untracked files in these commits.

---

## Rollback Procedures

### Backend API Rollback

Cloud Run keeps previous revisions. To rollback:

```bash
# List revisions
gcloud run revisions list \
  --service pos-sync-api \
  --region us-central1 \
  --project fresh-sensor-497515-d3

# Route traffic to previous revision
gcloud run services update-traffic pos-sync-api \
  --to-revisions=REVISION_NAME=100 \
  --region us-central1 \
  --project fresh-sensor-497515-d3
```

**Alternative**: Re-deploy from previous git commit:
```bash
git checkout PREVIOUS_COMMIT
cd apps/sync_api
make backend-deploy-fast
```

### Frontend Rollback

Firebase Hosting keeps deployment history:

```bash
# List releases
firebase hosting:releases:list \
  --project fresh-sensor-497515-d3 \
  --site cacharelo-central  # or cacharelo-pos

# Rollback to previous release
firebase hosting:rollback \
  --project fresh-sensor-497515-d3 \
  --site cacharelo-central
```

**Alternative**: Re-deploy from previous git commit:
```bash
git checkout PREVIOUS_COMMIT
make admin-deploy  # or flutter-web-deploy
```

### Database Rollback

**Database changes are NOT easily reversible**. Best practices:

1. **Backup before migrations**:
   ```bash
   # Export production database
   gcloud sql export sql pos-db-instance \
     gs://YOUR-BACKUP-BUCKET/backup-$(date +%Y%m%d-%H%M%S).sql \
     --database=pos_db \
     --project fresh-sensor-497515-d3
   ```

2. **Test migrations locally first**:
   ```bash
   # Run migration on local dev database
   make db-migrate
   # Verify schema changes
   # Verify application works
   ```

3. **Create down migrations**: For critical schema changes, write reverse migrations.

---

## CI/CD Integration

### GitHub Actions Workflows

**Location**: `.github/workflows/`

#### Flutter Windows Release
- **File**: `flutter-windows-release.yml`
- **Triggers**: Push to main/master/develop, manual dispatch
- **Outputs**: Windows ZIP artifact (30-day retention)
- **Runner**: `windows-latest`

**Future CI/CD Recommendations**:
1. Add backend deployment workflow (on push to main)
2. Add admin dashboard deployment workflow
3. Add Flutter web deployment workflow
4. Add automated testing before deployment
5. Add deployment notifications (Slack/Discord)

---

## Environment-Specific Configurations

### Backend API

**Environment Variables** (Cloud Run):
```bash
NODE_ENV=production
DATABASE_URL=postgresql://pos_user:pos-secure-db-pass-2026!@/pos_db?host=/cloudsql/fresh-sensor-497515-d3:us-central1:pos-db-instance
```

**Cloud SQL Connection**:
- Uses Unix socket: `/cloudsql/fresh-sensor-497515-d3:us-central1:pos-db-instance`
- Configured in Cloud Run deployment: `--add-cloudsql-instances`

### Admin Dashboard

**Build-time Environment**:
```bash
VITE_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api
```

Embedded in build artifacts - **cannot be changed** without rebuild.

### POS Flutter App

**No build-time environment variables** for web deployment.

API URLs are configured in Flutter app code:
- `apps/pos_flutter/lib/services/api.ts` (or similar service files)

---

## Troubleshooting Guide

### Backend Deployment Failures

**Issue**: `gcloud` command not found
**Solution**: Install Google Cloud SDK
```bash
brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project fresh-sensor-497515-d3
```

**Issue**: Cloud Build timeout
**Solution**: Increase timeout in Makefile or manually:
```bash
gcloud run deploy pos-sync-api --timeout 600 ...
```

**Issue**: Cloud SQL connection fails
**Solution**:
- Verify Cloud SQL instance is running
- Check Cloud SQL Admin API is enabled
- Verify service account permissions

### Frontend Deployment Failures

**Issue**: `firebase` command not found
**Solution**:
```bash
npm install -g firebase-tools
firebase login
```

**Issue**: Build fails with out-of-memory
**Solution**: Increase Node.js heap size
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

**Issue**: Firebase hosting site not found
**Solution**: Verify `.firebaserc` has correct site name:
```json
{
  "projects": {
    "default": "fresh-sensor-497515-d3"
  }
}
```

### Database Migration Failures

**Issue**: Migration journal mismatch
**Solution**: Use idempotent migration scripts instead of Drizzle's automatic migrations.

Example: `apps/sync_api/scripts/alter-users-roles.ts`
```bash
cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 &
PROXY_PID=$!
sleep 5
cd apps/sync_api
DATABASE_URL='postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db' \
  npx tsx scripts/alter-users-roles.ts
kill $PROXY_PID
```

**Issue**: Cloud SQL Proxy connection refused
**Solution**:
- Ensure Cloud SQL Admin API is enabled
- Verify IAM permissions for service account
- Check firewall rules
- Install/update cloud-sql-proxy: `brew install cloud-sql-proxy`

---

## Security Considerations

### Secrets Management

**DO NOT commit**:
- Database passwords (use environment variables)
- API keys (use GCP Secret Manager)
- Service account keys (use Workload Identity)

**Current password exposure**: `pos-secure-db-pass-2026!` is hardcoded in Makefile.

**Recommendation**: Move to GCP Secret Manager:
```bash
# Store secret
gcloud secrets create db-password \
  --data-file=- \
  --project fresh-sensor-497515-d3 <<< "pos-secure-db-pass-2026!"

# Grant Cloud Run service access
gcloud secrets add-iam-policy-binding db-password \
  --member=serviceAccount:YOUR-SERVICE-ACCOUNT@fresh-sensor-497515-d3.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project fresh-sensor-497515-d3

# Use in Cloud Run
--set-secrets="DB_PASSWORD=db-password:latest"
```

### HTTPS/TLS

- **All production endpoints use HTTPS** (Cloud Run + Firebase Hosting)
- Cloud Run provides automatic TLS certificates
- Firebase Hosting provides automatic TLS certificates
- Custom domains require DNS configuration

### Authentication

- Backend uses JWT tokens (`@nestjs/jwt`)
- Tokens stored in Flutter secure storage
- Multi-role user support with role-based access control (RBAC)
- Role guards: `apps/sync_api/src/modules/auth/decorators/roles.decorator.ts`

---

## Monitoring & Observability

### Cloud Run Metrics

**View in Console**:
```
https://console.cloud.google.com/run/detail/us-central1/pos-sync-api/metrics?project=fresh-sensor-497515-d3
```

**Key Metrics**:
- Request count
- Request latency (p50, p95, p99)
- Error rate
- Instance count
- CPU/Memory utilization

### Cloud Logging

**View logs**:
```bash
make backend-logs
```

**Or use gcloud**:
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=pos-sync-api" \
  --limit 50 \
  --project fresh-sensor-497515-d3 \
  --format="table(timestamp,textPayload)"
```

**Log Levels**: Configure in NestJS Logger.

### Firebase Hosting Analytics

**View in Console**:
```
https://console.firebase.google.com/project/fresh-sensor-497515-d3/hosting/sites
```

**Metrics**:
- Request count
- Bandwidth usage
- Cache hit rate

### Uptime Monitoring

**Recommendation**: Set up Cloud Monitoring uptime checks:
```bash
gcloud monitoring uptime-checks create \
  --display-name="POS API Health Check" \
  --resource-type="uptime-url" \
  --host="pos-sync-api-232144991863.us-central1.run.app" \
  --path="/api/health" \
  --period=60 \
  --timeout=10 \
  --project fresh-sensor-497515-d3
```

---

## Cost Optimization

### Cloud Run

**Current Configuration**:
- Min instances: 0 (scales to zero when idle)
- Max instances: 10
- CPU: 2 cores
- Memory: 1Gi

**Optimization Tips**:
- Reduce CPU to 1 core if performance allows
- Reduce memory to 512Mi if usage is low
- Consider min-instances=1 for production (faster cold starts, but always billed)

**Monitor costs**:
```bash
gcloud billing accounts list
# View billing reports in Console
```

### Firebase Hosting

**Free tier**: 10GB storage, 360MB/day bandwidth
**Current usage**: Monitor in Firebase Console

**Optimization**:
- Aggressive caching headers (already configured)
- Minify assets (already done by build tools)
- Use WebP images where possible

### Cloud SQL

**Current instance**: Varies by configuration
**Optimization**:
- Use smallest instance type that meets performance needs
- Enable automatic backups (daily, 7-day retention)
- Consider read replicas only if needed for high read load

---

## Quick Command Reference

```bash
# Backend
make backend-deploy-fast       # Deploy backend API
make backend-status           # Check deployment status
make backend-logs             # View recent logs
make backend-migrate          # Run production migrations

# Admin Dashboard
make admin-build              # Build admin dashboard
make admin-deploy             # Build and deploy admin dashboard

# POS Web App
make flutter-web-build        # Build Flutter web app
make flutter-web-deploy       # Build and deploy Flutter web app

# Database
make db-proxy                 # Start Cloud SQL proxy for local access
make db-clean-prod            # Clean production data (DESTRUCTIVE)
make db-clean-today-prod      # Clean today's production sales

# Flutter Native Builds
make flutter-apk-build        # Build Android APK
make flutter-android-build    # Build APK + AAB
make flutter-macos-build      # Build macOS app
make flutter-windows-build    # Build Windows app (Windows host only)
make flutter-all-releases     # Build all platforms

# Development
make db-up                    # Start local PostgreSQL
make db-down                  # Stop local PostgreSQL
make db-reset                 # Reset local database
make dev-backend              # Run backend dev server
make dev-frontend             # Run Flutter app locally
make lint                     # Run Flutter analyzer
make test                     # Run Flutter tests
```

---

## Emergency Contacts & Resources

### GCP Console
- **Project**: https://console.cloud.google.com/home/dashboard?project=fresh-sensor-497515-d3
- **Cloud Run**: https://console.cloud.google.com/run?project=fresh-sensor-497515-d3
- **Cloud SQL**: https://console.cloud.google.com/sql/instances?project=fresh-sensor-497515-d3

### Firebase Console
- **Project**: https://console.firebase.google.com/project/fresh-sensor-497515-d3
- **Hosting**: https://console.firebase.google.com/project/fresh-sensor-497515-d3/hosting

### Documentation
- **Project Root**: `/Users/joelmorales/web/POS-ERP`
- **HANDOFF.md**: Project session handoff documentation
- **AGENTS.md**: Agent guidelines and deployment quick reference
- **Makefile**: All deployment commands

### Support Escalation

1. Check logs: `make backend-logs`
2. Check status: `make backend-status`
3. Check GCP Console for alerts
4. Review recent commits: `git log -10`
5. Rollback if necessary (see Rollback Procedures above)

---

## Version History

**v1.0** (2026-07-18):
- Initial comprehensive deployment agent documentation
- Covers backend, admin, and POS deployments
- Includes rollback procedures and troubleshooting
- Documents current production infrastructure

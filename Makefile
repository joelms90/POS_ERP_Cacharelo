# Makefile for Empire POS-ERP project

.PHONY: help install db-up db-down db-status db-migrate db-seed db-rollback db-reset db-pull-prod db-sync-from-prod db-clean db-clean-prod db-clean-today db-clean-today-prod db-clean-old-history-prod db-clean-all-history-sales-prod db-proxy dev-backend dev-backend-local dev-backend-prod dev-frontend lint test active-orders infra-init infra-plan infra-apply provision-infra infra-destroy backend-migrate backend-deploy backend-deploy-fast backend-status backend-logs landing-install landing-build landing-deploy landing-infra admin-install admin-dev admin-dev-prod admin-dev-local admin-test-e2e admin-test-e2e-ui admin-build admin-deploy admin-deploy-gcs flutter-web-build flutter-web-dev flutter-web-dev-prod flutter-web-dev-local flutter-macos-dev flutter-macos-dev-prod flutter-macos-dev-local flutter-macos-build-debug flutter-macos-2x-local flutter-macos-2x-prod flutter-web-serve flutter-web-deploy flutter-portal-deploy flutter-apk-build flutter-clean flutter-macos-build flutter-windows-build flutter-android-build flutter-desktop-releases flutter-all-releases flutter-release-info flutter-bump-version

active-orders:
	@cd apps/sync_api && npx tsx scripts/get-active-orders.ts $(BRANCH_ID)

# Default target: show help
help:
	@echo "======================================================================="
	@echo "               EMPIRE POS-ERP DEVELOPMENT MANAGEMENT SYSTEM            "
	@echo "======================================================================="
	@echo "Usage: make [target]"
	@echo ""
	@echo "Setup Targets:"
	@echo "  install          Install all dependencies for backend & frontend"
	@echo ""
	@echo "Database Targets:"
	@echo "  db-up                 Start the local PostgreSQL container in the background"
	@echo "  db-down               Stop and remove the local PostgreSQL container"
	@echo "  db-status             Check the health status of the Postgres container"
	@echo "  db-migrate            Run Knex migrations to update the database schema"
	@echo "  db-seed               Populate database with default users and roles seed data"
	@echo "  db-rollback           Rollback the last batch of database migrations"
	@echo "  db-reset              Reset the database (tear down, bring up, migrate, and seed)"
	@echo "  db-pull-prod          Copy entire PRODUCTION database into LOCAL PostgreSQL (1:1 mirror)"
	@echo "  db-sync-from-prod     Alias to db-pull-prod"
	@echo "  db-clean                         Delete all LOCAL transactional data (keeps users and branches)"
	@echo "  db-clean-prod                    Delete all PRODUCTION transactional data (DANGER!)"
	@echo "  db-clean-today                   Delete today's LOCAL sales data only (keeps historical data)"
	@echo "  db-clean-today-prod              Delete today's PRODUCTION sales data (CAREFUL!)"
	@echo "  db-clean-old-history-prod        Delete old PRODUCTION history (keeps only today) (CAREFUL!)"
	@echo "  db-clean-all-history-sales-prod  Delete ALL PRODUCTION sales history from all time (EXTREME!)"
	@echo "  db-proxy                         Start Cloud SQL Auth Proxy locally for DBeaver access"
	@echo ""
	@echo "Run & Development Targets:"
	@echo "  dev-backend        Run NestJS backend on localhost:3000 (alias to dev-backend-local)"
	@echo "  dev-backend-local  Run NestJS backend on localhost:3000 connected to LOCAL Postgres (port 5432)"
	@echo "  dev-backend-prod   Run NestJS backend on localhost:3000 connected to PRODUCTION Cloud SQL (via proxy port 5433)"
	@echo "  dev-frontend       Start the Flutter application locally"
	@echo ""
	@echo "Quality Assurance Targets:"
	@echo "  lint             Analyze Flutter code quality and run linter"
	@echo "  test             Run client widget tests and unit tests"
	@echo ""
	@echo "Infrastructure & Deployment Targets:"
	@echo "  infra-init       Initialize Terraform configuration"
	@echo "  infra-plan       Generate and show a Terraform execution plan"
	@echo "  infra-apply      Build or change infrastructure via Terraform"
	@echo "  provision-infra  Provision all GCP resources (incl. Always Free VM) automatically"
	@echo "  infra-destroy    Destroy Terraform-managed infrastructure"
	@echo ""
	@echo "Backend Deployment Targets:"
	@echo "  backend-migrate      Run database migrations on production (via Cloud SQL Proxy)"
	@echo "  backend-deploy       Deploy backend API to Cloud Run (with confirmation)"
	@echo "  backend-deploy-fast  Deploy backend API without confirmation prompt"
	@echo "  backend-status       Check deployment status and show service URL"
	@echo "  backend-logs         Show recent backend logs from Cloud Run"
	@echo ""
	@echo "Landing Page Targets:"
	@echo "  landing-install  Install dependencies for landing page (frontend & backend)"
	@echo "  landing-build    Build static landing page frontend assets"
	@echo "  landing-deploy   Build and deploy landing page to Firebase Hosting"
	@echo "  landing-infra    Apply Terraform changes for landing page infrastructure"
	@echo ""
	@echo "Admin Dashboard Targets:"
	@echo "  admin-install     Install dependencies for admin dashboard (React/Vite)"
	@echo "  admin-dev         Start admin dashboard connected to LIVE Cloud Run API (port 1420)"
	@echo "  admin-dev-local   Start admin dashboard connected to LOCAL API on localhost:3000"
	@echo "  admin-dev-prod    Alias to admin-dev (connected to LIVE Cloud Run API)"
	@echo "  admin-test-e2e    Run Playwright end-to-end navigation tests"
	@echo "  admin-test-e2e-ui Run Playwright interactive UI test runner"
	@echo "  admin-build       Build static admin dashboard assets"
	@echo "  admin-deploy      Deploy admin dashboard to Firebase Hosting"
	@echo ""
	@echo "Flutter Build & Run Targets:"
	@echo "  flutter-macos-dev        Start Flutter POS in macOS desktop mode (connected to LIVE Cloud Run API)"
	@echo "  flutter-macos-dev-prod   Alias to flutter-macos-dev (connected to LIVE Cloud Run API)"
	@echo "  flutter-macos-dev-local  Start Flutter POS in macOS desktop mode connected to LOCAL backend (port 3000)"
	@echo "  flutter-macos-2x-prod    Build debug app & launch 2 macOS windows connected to LIVE Cloud Run API"
	@echo "  flutter-macos-2x-local   Build debug app & launch 2 macOS windows connected to LOCAL backend (port 3000)"
	@echo "  flutter-web-dev          Run Flutter web app in Chrome (connected to LIVE Cloud Run API)"
	@echo "  flutter-web-dev-prod     Alias to flutter-web-dev (connected to LIVE Cloud Run API)"
	@echo "  flutter-web-dev-local    Run Flutter web app in Chrome connected to LOCAL backend (port 3000)"
	@echo "  flutter-web-build        Build Flutter web app for production (output: build/web/)"
	@echo "  flutter-web-serve        Serve built web app locally for testing (port 8000)"
	@echo "  flutter-web-deploy       Build and deploy Flutter web app to Google Cloud Storage"
	@echo "  flutter-apk-build        Build Android APK for production"
	@echo "  flutter-clean            Clean Flutter build artifacts and caches"
	@echo ""
	@echo "Flutter Release Build Targets:"
	@echo "  flutter-macos-build      Build macOS release app bundle (.app)"
	@echo "  flutter-windows-build    Build Windows release executable (requires Windows host)"
	@echo "  flutter-android-build    Build Android APK + AAB for Play Store"
	@echo "  flutter-desktop-releases Build all desktop releases (macOS, Windows, Linux)"
	@echo "  flutter-all-releases     Build ALL platform releases (Web, Android, Desktop)"
	@echo "  flutter-release-info     Show information about release builds"
	@echo "======================================================================="

# Setup Targets
install:
	@echo "Installing backend dependencies..."
	cd apps/sync_api && npm install
	@echo "Installing frontend dependencies..."
	cd apps/pos_flutter && flutter pub get

# Database Targets
db-up:
	@echo "Starting PostgreSQL Docker container..."
	cd apps/sync_api && docker compose up -d

db-proxy:
	@echo "========================================="
	@echo "🔑 DBeaver Connection Information"
	@echo "========================================="
	@echo "  • Host:          127.0.0.1"
	@echo "  • Port:          5433"
	@echo "  • Database Name: pos_db"
	@echo "  • Username:      pos_user"
	@echo "  • Password:      pos-secure-db-pass-2026!"
	@echo "========================================="
	@echo "🚀 Starting Google Cloud SQL Auth Proxy..."
	@./cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433

db-down:
	@echo "Stopping PostgreSQL Docker container..."
	cd apps/sync_api && docker compose down

db-status:
	@echo "PostgreSQL Docker container status:"
	cd apps/sync_api && docker compose ps

db-migrate:
	@echo "Running database migrations..."
	cd apps/sync_api && npm run migrate:latest

db-seed:
	@echo "Running database seeds..."
	cd apps/sync_api && npm run seed:run

db-rollback:
	@echo "Rolling back database migrations..."
	cd apps/sync_api && npm run migrate:rollback

db-reset: db-down db-up
	@echo "Waiting for PostgreSQL database to be healthy..."
	@until cd apps/sync_api && docker compose exec -T db pg_isready -U pos_user -d pos_db > /dev/null 2>&1; do \
		echo "Waiting for database connection..."; \
		sleep 1; \
	done
	@echo "Applying migrations..."
	cd apps/sync_api && npm run migrate:latest
	@echo "Applying seeds..."
	cd apps/sync_api && npm run seed:run
	@echo "Database reset complete."

db-sync-from-prod: db-pull-prod

db-pull-prod:
	@./apps/sync_api/scripts/sync-db-from-prod.sh

db-clean:
	@echo "⚠️  WARNING: This will delete all LOCAL transactional data (products, orders, inventory)!"
	@echo "Users, businesses, and branches will be preserved."
	@read -p "Are you sure? (yes/NO): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	@echo "Cleaning local database transactional data..."
	cd apps/sync_api && pnpm run db:clean
	@echo "✅ Database cleaned successfully!"

db-clean-prod:
	@echo "🚨 DANGER: This will delete all PRODUCTION transactional data!"
	@echo "Target: Cloud SQL Database (pos-db-instance)"
	@echo "This will delete all products, orders, inventory from PRODUCTION."
	@echo "Users, businesses, and branches will be preserved."
	@read -p "Type 'DELETE-PRODUCTION-DATA' to confirm: " confirm && [ "$$confirm" = "DELETE-PRODUCTION-DATA" ] || (echo "Cancelled." && exit 1)
	@echo ""
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  brew install cloud-sql-proxy"; \
		echo ""; \
		echo "Or download from:"; \
		echo "  https://cloud.google.com/sql/docs/mysql/sql-proxy#install"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo ""
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running cleanup script..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" pnpm run db:clean ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		if [ $$EXIT_CODE -eq 0 ]; then \
			echo ""; \
			echo "✅ Production database cleaned successfully!"; \
		else \
			echo ""; \
			echo "❌ Cleanup failed!"; \
			exit $$EXIT_CODE; \
		fi

db-clean-today:
	@echo "⚠️  WARNING: This will delete today's LOCAL sales data!"
	@echo "This will delete:"
	@echo "  - All orders created today"
	@echo "  - All payments from today"
	@echo "  - All kitchen tickets from today"
	@echo "  - All cash shifts opened today"
	@echo "  - All inventory movements (sales) from today"
	@echo "  - Reset all tables to 'free' state"
	@echo ""
	@echo "This will preserve:"
	@echo "  - Users, businesses, branches"
	@echo "  - Products, categories, providers"
	@echo "  - Stock levels and inventory"
	@echo "  - Historical sales data (previous days)"
	@echo ""
	@read -p "Are you sure? (yes/NO): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	@echo "Cleaning today's local sales data..."
	cd apps/sync_api && pnpm run db:clean-today
	@echo "✅ Today's sales data cleaned successfully!"

db-clean-today-prod:
	@echo "⚠️  CAREFUL: This will delete today's PRODUCTION sales data!"
	@echo "Target: Cloud SQL Database (pos-db-instance)"
	@echo ""
	@echo "This will delete:"
	@echo "  - All orders created TODAY"
	@echo "  - All payments from TODAY"
	@echo "  - All kitchen tickets from TODAY"
	@echo "  - All cash shifts opened TODAY"
	@echo "  - All inventory movements (sales) from TODAY"
	@echo "  - Reset all tables to 'free' state"
	@echo ""
	@echo "This will preserve:"
	@echo "  - Users, businesses, branches"
	@echo "  - Products, categories, providers"
	@echo "  - Stock levels and inventory"
	@echo "  - Historical sales data (previous days)"
	@echo ""
	@read -p "Type 'CLEAN-TODAY-SALES' to confirm: " confirm && [ "$$confirm" = "CLEAN-TODAY-SALES" ] || (echo "Cancelled." && exit 1)
	@echo ""
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  brew install cloud-sql-proxy"; \
		echo ""; \
		echo "Or download from:"; \
		echo "  https://cloud.google.com/sql/docs/mysql/sql-proxy#install"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo ""
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running today's sales cleanup..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" pnpm run db:clean-today ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		if [ $$EXIT_CODE -eq 0 ]; then \
			echo ""; \
			echo "✅ Today's production sales data cleaned successfully!"; \
		else \
			echo ""; \
			echo "❌ Cleanup failed!"; \
			exit $$EXIT_CODE; \
		fi

db-clean-old-history-prod:
	@echo "⚠️  CAREFUL: This will delete old PRODUCTION sales history (keeps today)!"
	@echo "Target: Cloud SQL Database (pos-db-instance)"
	@echo ""
	@echo "This will delete:"
	@echo "  - All orders from the BEGINNING OF TIME until YESTERDAY"
	@echo "  - All old payments, kitchen tickets, cash shifts"
	@echo "  - All old inventory movements (sales)"
	@echo "  - Old 'Para Llevar' tables"
	@echo "  - Reset remaining tables to 'free' state"
	@echo ""
	@echo "This will preserve:"
	@echo "  - Users, businesses, branches"
	@echo "  - Products, categories, providers"
	@echo "  - Stock levels and inventory"
	@echo "  - TODAY'S sales data (orders from today)"
	@echo ""
	@read -p "Type 'CLEAN-OLD-HISTORY' to confirm: " confirm && [ "$$confirm" = "CLEAN-OLD-HISTORY" ] || (echo "Cancelled." && exit 1)
	@echo ""
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  brew install cloud-sql-proxy"; \
		echo ""; \
		echo "Or download from:"; \
		echo "  https://cloud.google.com/sql/docs/mysql/sql-proxy#install"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo ""
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running old history cleanup (keeping today)..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" pnpm run db:clean-old-history ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		if [ $$EXIT_CODE -eq 0 ]; then \
			echo ""; \
			echo "✅ Old production sales history cleaned successfully!"; \
		else \
			echo ""; \
			echo "❌ Cleanup failed!"; \
			exit $$EXIT_CODE; \
		fi

db-clean-all-history-sales-prod:
	@echo "🚨🚨🚨 EXTREME DANGER: This will delete ALL SALES HISTORY from PRODUCTION! 🚨🚨🚨"
	@echo "Target: Cloud SQL Database (pos-db-instance)"
	@echo ""
	@echo "This will delete:"
	@echo "  - ALL ORDERS FROM ALL TIME (not just today!)"
	@echo "  - ALL PAYMENTS FROM ALL TIME"
	@echo "  - ALL KITCHEN TICKETS FROM ALL TIME"
	@echo "  - ALL CASH SHIFTS FROM ALL TIME"
	@echo "  - ALL INVENTORY MOVEMENTS (SALES) FROM ALL TIME"
	@echo "  - ALL 'Para Llevar' tables"
	@echo "  - Reset all tables to 'free' state"
	@echo ""
	@echo "This will preserve:"
	@echo "  - Users, businesses, branches"
	@echo "  - Products, categories, providers"
	@echo "  - Stock levels and inventory"
	@echo ""
	@echo "⚠️  THIS CANNOT BE UNDONE! ALL SALES HISTORY WILL BE LOST FOREVER!"
	@echo ""
	@read -p "Type 'DELETE-ALL-SALES-HISTORY' to confirm: " confirm && [ "$$confirm" = "DELETE-ALL-SALES-HISTORY" ] || (echo "Cancelled." && exit 1)
	@echo ""
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  brew install cloud-sql-proxy"; \
		echo ""; \
		echo "Or download from:"; \
		echo "  https://cloud.google.com/sql/docs/mysql/sql-proxy#install"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo ""
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running ALL sales history cleanup..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" pnpm run db:clean-all-sales ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		if [ $$EXIT_CODE -eq 0 ]; then \
			echo ""; \
			echo "✅ ALL production sales history cleaned successfully!"; \
		else \
			echo ""; \
			echo "❌ Cleanup failed!"; \
			exit $$EXIT_CODE; \
		fi

# Query Targets
db-tickets-hoy:
	@echo "🔍 Querying tickets cobrados hoy (local dev DB)..."
	@mkdir -p apps/sync_api/data
	@cd apps/sync_api && \
		npx ts-node src/database/query-tickets-hoy.ts $(BRANCH) $(OUTPUT)

db-tickets-hoy-prod:
	@echo "🔍 Querying tickets cobrados hoy (production DB)..."
	@echo "Output files will be written to apps/sync_api/data/"
	@mkdir -p apps/sync_api/data
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo "Install it with: brew install cloud-sql-proxy"; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running query..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" \
		npx ts-node src/database/query-tickets-hoy.ts $(BRANCH) $(OUTPUT) ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		exit $$EXIT_CODE

# Run & Development Targets
dev-backend: dev-backend-local

dev-backend-local:
	@echo "======================================================================="
	@echo "🚀 Starting NestJS Backend on localhost:3000 (LOCAL Postgres: port 5432)"
	@echo "======================================================================="
	@cd apps/sync_api && \
		PORT=3000 \
		NODE_ENV=development \
		DATABASE_URL="postgres://pos_user:pos_password@localhost:5432/pos_dev" \
		npm run dev

dev-backend-prod:
	@echo "======================================================================="
	@echo "🚀 Starting NestJS Backend on localhost:3000 (PROD DB via Proxy: port 5433)"
	@echo "⚠️  Ensure 'make db-proxy' is running in a separate terminal!"
	@echo "======================================================================="
	@cd apps/sync_api && \
		PORT=3000 \
		NODE_ENV=development \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" \
		npm run dev

dev-frontend:
	@echo "Starting Flutter client app..."
	cd apps/pos_flutter && flutter run

# Quality Assurance Targets
lint:
	@echo "Running Flutter analyzer..."
	cd apps/pos_flutter && flutter analyze

test:
	@echo "Running Flutter tests..."
	cd apps/pos_flutter && flutter test

# Infrastructure & Deployment Targets
infra-init:
	@echo "Initializing Terraform..."
	cd apps/sync_api/infra && terraform init

infra-plan:
	@echo "Planning Terraform changes..."
	cd apps/sync_api/infra && terraform plan

infra-apply:
	@echo "Applying Terraform changes..."
	cd apps/sync_api/infra && terraform apply

provision-infra:
	@echo "Provisioning Google Cloud Infrastructure (Cloud SQL, Cloud Run, Always Free WebSocket VM)..."
	cd apps/sync_api/infra && terraform apply -auto-approve

infra-destroy:
	@echo "Destroying Terraform infrastructure..."
	cd apps/sync_api/infra && terraform destroy

# Backend Deployment Targets
backend-migrate:
	@echo "========================================="
	@echo "Running Production Database Migrations"
	@echo "========================================="
	@echo "Checking for cloud-sql-proxy..."
	@if ! command -v cloud-sql-proxy > /dev/null 2>&1; then \
		echo "❌ cloud-sql-proxy not found!"; \
		echo ""; \
		echo "Install it with:"; \
		echo "  brew install cloud-sql-proxy"; \
		echo ""; \
		echo "Or download from:"; \
		echo "  https://cloud.google.com/sql/docs/mysql/sql-proxy#install"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cloud-sql-proxy found"
	@echo ""
	@echo "Starting Cloud SQL Proxy..."
	@cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & \
		PROXY_PID=$$! && \
		sleep 5 && \
		echo "Running migrations..." && \
		cd apps/sync_api && \
		DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" \
		NODE_ENV=production \
		pnpm tsx scripts/idempotent-deploy-migrations.ts ; \
		EXIT_CODE=$$? ; \
		echo "Stopping proxy..." && \
		kill $$PROXY_PID 2>/dev/null || true ; \
		if [ $$EXIT_CODE -eq 0 ]; then \
			echo ""; \
			echo "✅ Migrations completed successfully!"; \
		else \
			echo ""; \
			echo "❌ Migrations failed!"; \
			exit $$EXIT_CODE; \
		fi

backend-deploy:
	@echo "========================================="
	@echo "Backend API Production Deployment"
	@echo "========================================="
	@echo "📋 Pre-deployment checklist:"
	@echo "  - Ensure you're on the correct branch"
	@echo "  - All changes committed to git"
	@echo "  - Tests passing"
	@echo ""
	@read -p "Continue with deployment? (yes/NO): " confirm && [ "$$confirm" = "yes" ] || (echo "Deployment cancelled." && exit 1)
	@echo ""
	@echo "🚀 Deploying backend API to Cloud Run..."
	@cd apps/sync_api && \
		gcloud run deploy pos-sync-api \
			--source . \
			--region us-central1 \
			--project fresh-sensor-497515-d3 \
			--platform managed \
			--timeout 300 \
			--cpu 2 \
			--memory 1Gi \
			--min-instances 0 \
			--max-instances 10 \
			--allow-unauthenticated \
			--add-cloudsql-instances fresh-sensor-497515-d3:us-central1:pos-db-instance \
			--set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://pos_user:pos-secure-db-pass-2026!@/pos_db?host=/cloudsql/fresh-sensor-497515-d3:us-central1:pos-db-instance,PG_POOL_MAX=5,PG_IDLE_TIMEOUT_MS=30000,PG_CONNECTION_TIMEOUT_MS=5000,TAKEAWAY_SELF_HEAL_INTERVAL_MS=60000"
	@echo ""
	@echo "✅ Deployment complete!"
	@echo ""
	@echo "🌐 Service URL:"
	@gcloud run services describe pos-sync-api \
		--region us-central1 \
		--project fresh-sensor-497515-d3 \
		--format="value(status.url)"
	@echo ""

backend-deploy-fast:
	@echo "🚀 Fast deploying backend API to Cloud Run (no confirmation)..."
	@cd apps/sync_api && \
		gcloud run deploy pos-sync-api \
			--source . \
			--region us-central1 \
			--project fresh-sensor-497515-d3 \
			--platform managed \
			--timeout 300 \
			--cpu 2 \
			--memory 1Gi \
			--min-instances 0 \
			--max-instances 10 \
			--allow-unauthenticated \
			--add-cloudsql-instances fresh-sensor-497515-d3:us-central1:pos-db-instance \
			--set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://pos_user:pos-secure-db-pass-2026!@/pos_db?host=/cloudsql/fresh-sensor-497515-d3:us-central1:pos-db-instance,PG_POOL_MAX=5,PG_IDLE_TIMEOUT_MS=30000,PG_CONNECTION_TIMEOUT_MS=5000,TAKEAWAY_SELF_HEAL_INTERVAL_MS=60000"
	@echo ""
	@echo "✅ Deployment complete!"
	@echo ""

backend-status:
	@echo "📊 Backend Service Status"
	@echo "========================================="
	@echo ""
	@echo "Service URL:"
	@gcloud run services describe pos-sync-api \
		--region us-central1 \
		--project fresh-sensor-497515-d3 \
		--format="value(status.url)"
	@echo ""
	@echo "Current Revision:"
	@gcloud run services describe pos-sync-api \
		--region us-central1 \
		--project fresh-sensor-497515-d3 \
		--format="value(status.latestReadyRevisionName)"
	@echo ""
	@echo "Health Check:"
	@curl -s "$$(gcloud run services describe pos-sync-api --region us-central1 --project fresh-sensor-497515-d3 --format='value(status.url)')/api/health" | grep -q "OK" && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo ""

backend-logs:
	@echo "📋 Recent Backend Logs (last 20 entries)"
	@echo "========================================="
	@gcloud logging read \
		"resource.type=cloud_run_revision AND resource.labels.service_name=pos-sync-api" \
		--limit 20 \
		--project fresh-sensor-497515-d3 \
		--format="table(timestamp,textPayload)" \
		2>/dev/null || echo "No recent logs found"
	@echo ""
	@echo "For more logs, visit:"
	@echo "https://console.cloud.google.com/run/detail/us-central1/pos-sync-api/logs?project=fresh-sensor-497515-d3"
	@echo ""

# Landing Page Targets
landing-install:
	@echo "Installing landing page dependencies..."
	cd apps/landing_page/frontend && pnpm install
	cd apps/landing_page/backend && npm install

landing-build:
	@echo "Building static landing page assets..."
	cd apps/landing_page/frontend && pnpm run build

landing-deploy: landing-build
	@echo "Deploying landing page to Firebase Hosting..."
	cd apps/landing_page/frontend && firebase deploy --only hosting --project fresh-sensor-497515-d3

landing-infra:
	@echo "Applying landing page Terraform changes..."
	cd apps/landing_page/infra && terraform apply -auto-approve -lock=false

# Admin Dashboard Targets
admin-install:
	@echo "Installing admin dashboard dependencies..."
	cd apps/business_control_tauri && pnpm install

admin-dev: admin-dev-prod

admin-dev-prod:
	@echo "======================================================================="
	@echo "🚀 Starting Admin Dashboard connected to LIVE Cloud Run API"
	@echo "   Frontend: http://localhost:1420 -> Backend: https://pos-sync-api-232144991863.us-central1.run.app/api"
	@echo "======================================================================="
	cd apps/business_control_tauri && pnpm dev:prod

admin-dev-local:
	@echo "======================================================================="
	@echo "🚀 Starting Admin Dashboard connected to LOCAL API (localhost:3000)"
	@echo "   Frontend: http://localhost:1420 -> Backend: http://localhost:3000/api"
	@echo "======================================================================="
	cd apps/business_control_tauri && pnpm dev:local

admin-test-e2e:
	@echo "Running Playwright E2E tests for Admin Dashboard..."
	cd apps/business_control_tauri && pnpm test:e2e

admin-test-e2e-ui:
	@echo "Opening Playwright interactive UI test runner..."
	cd apps/business_control_tauri && pnpm test:e2e:ui

admin-build:
	@echo "Building static admin dashboard assets..."
	cd apps/business_control_tauri && VITE_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api pnpm build


admin-deploy: admin-build
	@echo "Deploying admin dashboard to Firebase Hosting..."
	cd apps/business_control_tauri && firebase deploy --only hosting --project fresh-sensor-497515-d3
	@echo "✓ Deployment complete!"
	@echo ""
	@echo "  🌐 Admin dashboard is live at:"
	@echo "     https://cacharelo-central.web.app"
	@echo "     https://central.cacharelo.com (after DNS configuration)"
	@echo ""

admin-deploy-gcs: admin-build
	@echo "Deploying admin dashboard to Google Cloud Storage (GCS)..."
	gcloud storage rsync -r apps/business_control_tauri/dist gs://empire-pos-admin-dashboard-fresh-sensor-497515-d3
	@echo "✓ GCS Deployment complete!"
	@echo ""
	@echo "  🌐 Admin dashboard GCS website is live at:"
	@echo "     https://empire-pos-admin-dashboard-fresh-sensor-497515-d3.storage.googleapis.com/index.html"
	@echo ""

# Flutter Build Targets
flutter-web-build:
	@echo "Building Flutter web app for production..."
	cd apps/pos_flutter && flutter build web --release
	@cp apps/pos_flutter/web/descargas.html apps/pos_flutter/build/web/descargas.html 2>/dev/null || true
	@if [ -f apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk ]; then \
		cp apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk apps/pos_flutter/build/web/app-release.apk; \
	fi
	@echo "✓ Build complete! Output: apps/pos_flutter/build/web/"
	@echo "  To deploy, run: make flutter-web-deploy"

flutter-macos-dev: flutter-macos-dev-prod

flutter-macos-dev-prod:
	@echo "Starting Flutter POS in macOS desktop mode (connected to LIVE Cloud Run API)..."
	cd apps/pos_flutter && flutter run -d macos --dart-define=API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api

flutter-macos-dev-local:
	@echo "Starting Flutter POS in macOS desktop mode connected to LOCAL backend (http://localhost:3000/api)..."
	cd apps/pos_flutter && flutter run -d macos --dart-define=API_URL=http://localhost:3000/api

flutter-macos-build-debug:
	@echo "Building macOS debug application (Local Backend)..."
	cd apps/pos_flutter && flutter build macos --debug --dart-define=API_URL=http://localhost:3000/api

flutter-macos-build-debug-prod:
	@echo "Building macOS debug application (LIVE Cloud Run API)..."
	cd apps/pos_flutter && flutter build macos --debug --dart-define=API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api

flutter-macos-2x-local: flutter-macos-build-debug
	@echo "======================================================================="
	@echo "🚀 Launching 2 independent macOS Flutter POS instances (Local Backend)"
	@echo "======================================================================="
	@open -n apps/pos_flutter/build/macos/Build/Products/Debug/pos_flutter.app
	@sleep 1
	@open -n apps/pos_flutter/build/macos/Build/Products/Debug/pos_flutter.app
	@echo "✓ 2 macOS Flutter POS windows opened!"

flutter-macos-2x-prod: flutter-macos-build-debug-prod
	@echo "======================================================================="
	@echo "🚀 Launching 2 independent macOS Flutter POS instances (LIVE Cloud Run API)"
	@echo "======================================================================="
	@open -n apps/pos_flutter/build/macos/Build/Products/Debug/pos_flutter.app
	@sleep 1
	@open -n apps/pos_flutter/build/macos/Build/Products/Debug/pos_flutter.app
	@echo "✓ 2 macOS Flutter POS windows opened!"

flutter-web-dev: flutter-web-dev-prod

flutter-web-dev-prod:
	@echo "Starting Flutter web app in Chrome (connected to LIVE Cloud Run API)..."
	cd apps/pos_flutter && flutter run -d chrome --dart-define=API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api

flutter-web-dev-local:
	@echo "Starting Flutter POS in Chrome connected to LOCAL backend (http://localhost:3000/api)..."
	cd apps/pos_flutter && flutter run -d chrome --dart-define=API_URL=http://localhost:3000/api

flutter-web-serve:
	@echo "Serving built web app locally on http://localhost:8000"
	@echo "Make sure you've run 'make flutter-web-build' first!"
	cd apps/pos_flutter/build/web && python3 -m http.server 8000

flutter-web-deploy: flutter-web-build
	@echo "Deploying Flutter POS web app to Firebase Hosting..."
	cd apps/pos_flutter && firebase deploy --only hosting --project fresh-sensor-497515-d3
	@echo "✓ Deployment complete!"
	@echo ""
	@echo "  🌐 Your POS web app is live at:"
	@echo "     https://cacharelo-pos.web.app"
	@echo "     https://cafeteria.cacharelo.com (after DNS configuration)"
	@echo ""

flutter-portal-deploy: flutter-apk-build flutter-web-build
	@echo "Deploying Download Portal, Android APK & POS Web to Firebase Hosting..."
	@gsutil cp apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk gs://cacharelo-pos-releases/android/pos_flutter_android_latest.apk 2>/dev/null || true
	cd apps/pos_flutter && firebase deploy --only hosting --project fresh-sensor-497515-d3
	@echo "✓ Portal deployment complete!"
	@echo "  🌐 Download Portal live at: https://cacharelo-pos.web.app/descargas.html (PIN: 9876)"
	@echo ""

flutter-bump-version:
	@node apps/pos_flutter/scripts/bump-version.js

flutter-apk-build:
	@echo "Building Android APK for production..."
	cd apps/pos_flutter && flutter build apk --release
	@echo "✓ APK built successfully!"
	@echo "  Output: apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk"

flutter-clean:
	@echo "Cleaning Flutter build artifacts..."
	cd apps/pos_flutter && flutter clean
	@echo "✓ Clean complete!"

# Flutter Release Build Targets
flutter-macos-build:
	@echo "========================================="
	@echo "Building macOS Release (.app)"
	@echo "========================================="
	cd apps/pos_flutter && flutter build macos --release
	@echo ""
	@echo "✓ macOS build complete!"
	@echo "  Output: apps/pos_flutter/build/macos/Build/Products/Release/pos_flutter.app"
	@echo ""
	@echo "To distribute:"
	@echo "  1. Copy .app to Applications folder"
	@echo "  2. Or create DMG installer (see INSTALL-MACOS.md)"
	@echo "  3. Or ZIP for distribution"
	@echo ""

flutter-windows-build:
	@echo "========================================="
	@echo "Building Windows Release (.exe)"
	@echo "========================================="
	@if [ "$$(uname)" != "Linux" ] && [ "$$(uname)" != "Darwin" ]; then \
		cd apps/pos_flutter && flutter build windows --release; \
		echo ""; \
		echo "✓ Windows build complete!"; \
		echo "  Output: apps/pos_flutter/build/windows/x64/runner/Release/"; \
		echo ""; \
		echo "To distribute:"; \
		echo "  1. Run: windows/build-release.bat (on Windows)"; \
		echo "  2. Or ZIP the Release folder"; \
		echo "  3. Or create installer with Inno Setup (see INSTALL-WINDOWS.md)"; \
	else \
		echo "❌ ERROR: Windows builds must be created on Windows host"; \
		echo ""; \
		echo "To build for Windows:"; \
		echo "  1. Copy project to Windows machine"; \
		echo "  2. Run: make flutter-windows-build"; \
		echo "  3. Or run: windows/build-release.bat"; \
		exit 1; \
	fi
	@echo ""

flutter-android-build:
	@echo "========================================="
	@echo "Building Android Release (APK + AAB)"
	@echo "========================================="
	@echo "[1/3] Building APK (for direct installation)..."
	cd apps/pos_flutter && flutter build apk --release
	@echo ""
	@echo "[2/3] Building App Bundle (for Play Store)..."
	cd apps/pos_flutter && flutter build appbundle --release
	@echo ""
	@echo "[3/3] Generating file info..."
	@cd apps/pos_flutter && \
		APK_SIZE=$$(du -h build/app/outputs/flutter-apk/app-release.apk | cut -f1) && \
		AAB_SIZE=$$(du -h build/app/outputs/bundle/release/app-release.aab | cut -f1) && \
		echo "" && \
		echo "✓ Android builds complete!" && \
		echo "" && \
		echo "📱 APK (for direct installation):" && \
		echo "   File: apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk" && \
		echo "   Size: $$APK_SIZE" && \
		echo "" && \
		echo "📦 AAB (for Google Play Store):" && \
		echo "   File: apps/pos_flutter/build/app/outputs/bundle/release/app-release.aab" && \
		echo "   Size: $$AAB_SIZE" && \
		echo ""
	@echo "To distribute APK:"
	@echo "  - Send directly to users for installation"
	@echo "  - Users must enable 'Install from Unknown Sources'"
	@echo ""
	@echo "To distribute AAB:"
	@echo "  - Upload to Google Play Console"
	@echo "  - https://play.google.com/console"
	@echo ""

flutter-desktop-releases:
	@echo "========================================="
	@echo "Building All Desktop Releases"
	@echo "========================================="
	@echo ""
	@echo "[1/2] Building macOS release..."
	@$(MAKE) flutter-macos-build
	@echo ""
	@echo "[2/2] Checking Windows build capability..."
	@if [ "$$(uname)" = "Linux" ] || [ "$$(uname)" = "Darwin" ]; then \
		echo "⚠️  Skipping Windows build (requires Windows host)"; \
		echo "   To build Windows version, run this on a Windows machine."; \
	else \
		echo "[2/2] Building Windows release..."; \
		$(MAKE) flutter-windows-build; \
	fi
	@echo ""
	@echo "========================================="
	@echo "✓ Desktop builds complete!"
	@echo "========================================="
	@$(MAKE) flutter-release-info

flutter-all-releases:
	@echo "======================================================================="
	@echo "                 BUILDING ALL PLATFORM RELEASES                        "
	@echo "======================================================================="
	@echo ""
	@echo "This will build:"
	@echo "  - Web (Firebase Hosting)"
	@echo "  - Android (APK + AAB)"
	@echo "  - macOS (App Bundle)"
	@echo "  - Windows (if on Windows host)"
	@echo ""
	@read -p "Continue? (yes/NO): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	@echo ""
	@echo "[1/4] Cleaning previous builds..."
	@$(MAKE) flutter-clean
	@echo ""
	@echo "[2/4] Building Web release..."
	@$(MAKE) flutter-web-build
	@echo ""
	@echo "[3/4] Building Android releases..."
	@$(MAKE) flutter-android-build
	@echo ""
	@echo "[4/4] Building Desktop releases..."
	@$(MAKE) flutter-desktop-releases
	@echo ""
	@echo "======================================================================="
	@echo "✓ ALL PLATFORM BUILDS COMPLETE!"
	@echo "======================================================================="
	@$(MAKE) flutter-release-info

flutter-release-info:
	@echo ""
	@echo "📦 Release Build Locations:"
	@echo "────────────────────────────────────────────────────────────────────"
	@echo ""
	@if [ -d "apps/pos_flutter/build/web" ]; then \
		echo "🌐 Web:"; \
		echo "   apps/pos_flutter/build/web/"; \
		echo "   Deploy: make flutter-web-deploy"; \
		echo ""; \
	fi
	@if [ -f "apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk" ]; then \
		APK_SIZE=$$(du -h apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk | cut -f1); \
		echo "📱 Android APK:"; \
		echo "   apps/pos_flutter/build/app/outputs/flutter-apk/app-release.apk"; \
		echo "   Size: $$APK_SIZE"; \
		echo ""; \
	fi
	@if [ -f "apps/pos_flutter/build/app/outputs/bundle/release/app-release.aab" ]; then \
		AAB_SIZE=$$(du -h apps/pos_flutter/build/app/outputs/bundle/release/app-release.aab | cut -f1); \
		echo "📦 Android AAB (Play Store):"; \
		echo "   apps/pos_flutter/build/app/outputs/bundle/release/app-release.aab"; \
		echo "   Size: $$AAB_SIZE"; \
		echo ""; \
	fi
	@if [ -d "apps/pos_flutter/build/macos/Build/Products/Release/pos_flutter.app" ]; then \
		MACOS_SIZE=$$(du -sh apps/pos_flutter/build/macos/Build/Products/Release/pos_flutter.app | cut -f1); \
		echo "🍎 macOS App:"; \
		echo "   apps/pos_flutter/build/macos/Build/Products/Release/pos_flutter.app"; \
		echo "   Size: $$MACOS_SIZE"; \
		echo "   Install: See INSTALL-MACOS.md"; \
		echo ""; \
	fi
	@if [ -d "apps/pos_flutter/build/windows/x64/runner/Release" ]; then \
		WIN_SIZE=$$(du -sh apps/pos_flutter/build/windows/x64/runner/Release | cut -f1); \
		echo "🪟 Windows App:"; \
		echo "   apps/pos_flutter/build/windows/x64/runner/Release/"; \
		echo "   Size: $$WIN_SIZE"; \
		echo "   Install: See INSTALL-WINDOWS.md"; \
		echo ""; \
	fi
	@echo "────────────────────────────────────────────────────────────────────"
	@echo ""
	@echo "📚 Documentation:"
	@echo "   - INSTALL-WINDOWS.md - Windows installation guide"
	@echo "   - INSTALL-MACOS.md   - macOS installation guide"
	@echo ""

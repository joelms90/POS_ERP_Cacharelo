# Makefile for Empire POS-ERP project

.PHONY: help install db-up db-down db-status db-migrate db-seed db-rollback db-reset dev-backend dev-frontend lint test infra-init infra-plan infra-apply infra-destroy

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
	@echo "  db-up            Start the local PostgreSQL container in the background"
	@echo "  db-down          Stop and remove the local PostgreSQL container"
	@echo "  db-status        Check the health status of the Postgres container"
	@echo "  db-migrate       Run Knex migrations to update the database schema"
	@echo "  db-seed          Populate database with default users and roles seed data"
	@echo "  db-rollback      Rollback the last batch of database migrations"
	@echo "  db-reset         Reset the database (tear down, bring up, migrate, and seed)"
	@echo ""
	@echo "Run & Development Targets:"
	@echo "  dev-backend      Run Express backend API with hot-reload"
	@echo "  dev-frontend     Start the Flutter application locally"
	@echo ""
	@echo "Quality Assurance Targets:"
	@echo "  lint             Analyze Flutter code quality and run linter"
	@echo "  test             Run client widget tests and unit tests"
	@echo ""
	@echo "Infrastructure & Deployment Targets:"
	@echo "  infra-init       Initialize Terraform configuration"
	@echo "  infra-plan       Generate and show a Terraform execution plan"
	@echo "  infra-apply      Build or change infrastructure via Terraform"
	@echo "  infra-destroy    Destroy Terraform-managed infrastructure"
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

# Run & Development Targets
dev-backend:
	@echo "Starting backend dev server..."
	cd apps/sync_api && npm run dev

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

infra-destroy:
	@echo "Destroying Terraform infrastructure..."
	cd apps/sync_api/infra && terraform destroy

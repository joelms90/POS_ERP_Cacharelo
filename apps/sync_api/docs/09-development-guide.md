# 09: Developer Onboarding & Workflow Guide

This document describes the workflow for a new developer (or coding agent) to set up and run the backend locally.

---

## 1. Quick Start (Local Setup)

Follow these steps to boot the local environment:

### Step 1: Clone & Install Dependencies
```bash
git clone <repository_url>
cd apps/sync_api
npm install
```

### Step 2: Boot Database Container
Use Docker to spin up the local PostgreSQL instance:
```bash
docker compose up -d postgres
```

### Step 3: Configure Local Environment
Create a `.env` file at the root of the project:
```env
PORT=3000
DATABASE_URL=postgres://pos_user:pos_password@localhost:5432/pos_dev
JWT_SECRET=super_secret_local_key
```

### Step 4: Run Drizzle Database Migrations
Drizzle kit handles schema creations automatically:
```bash
# Generate SQL migrations if schema changes were made
npx drizzle-kit generate:pg

# Apply migrations to the local database
npx drizzle-kit push:pg
```

### Step 5: Run Database Seed Scripts
Insert basic catalogs, categories, products, and default users:
```bash
npm run seed
```

### Step 6: Start Server (Development Mode)
```bash
npm run dev
```
The API is now active at `http://localhost:3000`. You can access the interactive Swagger documentation at `http://localhost:3000/api-docs`.

---

## 2. Test Execution

Enforces quality controls before committing code changes:

*   **Unit Tests**: Run Jest unit tests for business logic isolation:
    ```bash
    npm run test
    ```
*   **Integration (E2E) Tests**: Verify REST endpoint routes and DB queries:
    ```bash
    npm run test:e2e
    ```
*   **Static Code Analysis**: Run the linter to verify TypeScript compliance:
    ```bash
    npm run lint
    ```

# 08: Infrastructure, Deployment & CI/CD Pipeline

This document specifies the container builds, developer compose configurations, and GCP deployment pipelines.

---

## 1. Development Docker Compose (`docker-compose.yml`)

For local development, the environment boots up PostgreSQL and the NestJS server:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pos_postgres_dev
    environment:
      POSTGRES_USER: pos_user
      POSTGRES_PASSWORD: pos_password
      POSTGRES_DB: pos_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  sync_api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: pos_sync_api_dev
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://pos_user:pos_password@postgres:5432/pos_dev
      JWT_SECRET: dev_jwt_secret_key
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres

volumes:
  pgdata:
```

---

## 2. Production Multi-Stage Dockerfile (`Dockerfile`)

To optimize cold-start performance on Google Cloud Run, we use a slim multi-stage build:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## 3. Deployment Pipeline (GitHub Actions)

A simple, maintainable pipeline to run checks and deploy updates to Google Cloud Run:

```mermaid
graph TD
    Trigger[Git Push to main] --> Lint[Run Linter]
    Lint --> Test[Run Jest Tests]
    Test --> Build[Build Production Docker Image]
    Build --> Publish[Push to Google Artifact Registry]
    Publish --> Deploy[Deploy to Cloud Run]
    Deploy --> Migration[Run DB Migrations via Drizzle-kit]
```

### Environment Config Variables:
*   `DATABASE_URL`: Connection string to Cloud SQL.
*   `JWT_SECRET`: Rotated private key for token signatures.
*   `CLOUDRUN_SERVICE`: Target service name in Google Cloud.
*   `GCP_PROJECT_ID`: Active project ID in GCP.

#!/usr/bin/env bash
set -e

# ==============================================================================
# Sync Production Cloud SQL Database to Local Docker PostgreSQL
# ==============================================================================

PROD_INSTANCE="fresh-sensor-497515-d3:us-central1:pos-db-instance"
PROD_PROXY_PORT="5433"
PROD_DB="pos_db"
PROD_USER="pos_user"
PROD_PASS="pos-secure-db-pass-2026!"

LOCAL_CONTAINER="pos_postgres_local"
LOCAL_DB="pos_dev"
LOCAL_USER="pos_user"
LOCAL_PASS="pos_password"

echo "======================================================================="
echo "🔄 SYNCING PRODUCTION DATABASE TO LOCAL POSTGRESQL (1:1 COPY)"
echo "======================================================================="
echo ""

# 1. Check prerequisites
if ! command -v docker > /dev/null 2>&1; then
  echo "❌ Error: Docker is not installed or not in PATH."
  exit 1
fi

if ! command -v cloud-sql-proxy > /dev/null 2>&1; then
  echo "❌ Error: cloud-sql-proxy is not installed."
  echo "   Install with: brew install cloud-sql-proxy"
  exit 1
fi

# 2. Ensure local Docker Postgres is up and healthy
echo "📦 [1/4] Ensuring local Docker PostgreSQL is running..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

(cd "${SYNC_API_DIR}" && docker compose up -d)

echo "⏳ Waiting for local database to be ready..."
until docker exec "${LOCAL_CONTAINER}" pg_isready -U "${LOCAL_USER}" -d "${LOCAL_DB}" > /dev/null 2>&1; do
  sleep 1
done
echo "✓ Local PostgreSQL is ready."

# 3. Check if Cloud SQL Proxy is already running or start it
STARTED_PROXY=false
if nc -z 127.0.0.1 "${PROD_PROXY_PORT}" > /dev/null 2>&1; then
  echo "✓ Cloud SQL Proxy already listening on port ${PROD_PROXY_PORT}."
else
  echo "🚀 [2/4] Starting Cloud SQL Auth Proxy in background (port ${PROD_PROXY_PORT})..."
  cloud-sql-proxy "${PROD_INSTANCE}" --port "${PROD_PROXY_PORT}" &
  PROXY_PID=$!
  STARTED_PROXY=true
  
  # Trap to cleanup proxy if script exits unexpectedly
  cleanup() {
    if [ "$STARTED_PROXY" = true ] && [ -n "$PROXY_PID" ]; then
      echo ""
      echo "🛑 Stopping Cloud SQL Proxy..."
      kill "$PROXY_PID" 2>/dev/null || true
    fi
  }
  trap cleanup EXIT INT TERM

  echo "⏳ Waiting for Cloud SQL Proxy connection..."
  for i in {1..20}; do
    if nc -z 127.0.0.1 "${PROD_PROXY_PORT}" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

# 4. Reset local database schema
echo ""
echo "🧹 [3/4] Resetting local '${LOCAL_DB}' schemas (public, drizzle)..."
docker exec -e PGPASSWORD="${LOCAL_PASS}" "${LOCAL_CONTAINER}" psql -U "${LOCAL_USER}" -d "${LOCAL_DB}" \
  -c "DROP SCHEMA IF EXISTS public CASCADE;" \
  -c "DROP SCHEMA IF EXISTS drizzle CASCADE;" \
  -c "CREATE SCHEMA public;" \
  -c "GRANT ALL ON SCHEMA public TO ${LOCAL_USER};" \
  -c "GRANT ALL ON SCHEMA public TO public;" > /dev/null

# 5. Stream dump from production directly into local DB container
echo "📥 [4/4] Copying all tables, indexes, and data from production..."
docker exec -e PGPASSWORD="${PROD_PASS}" "${LOCAL_CONTAINER}" pg_dump -h host.docker.internal -p "${PROD_PROXY_PORT}" -U "${PROD_USER}" -d "${PROD_DB}" --no-owner --no-acl \
  | docker exec -i -e PGPASSWORD="${LOCAL_PASS}" "${LOCAL_CONTAINER}" psql -U "${LOCAL_USER}" -d "${LOCAL_DB}" -q > /dev/null

echo ""
echo "======================================================================="
echo "✅ SYNC COMPLETED SUCCESSFULLY! Summary of local records:"
echo "======================================================================="
docker exec -e PGPASSWORD="${LOCAL_PASS}" "${LOCAL_CONTAINER}" psql -U "${LOCAL_USER}" -d "${LOCAL_DB}" -c "
SELECT 'users' as table_name, count(*) as records FROM users
UNION ALL
SELECT 'businesses', count(*) FROM businesses
UNION ALL
SELECT 'branches', count(*) FROM branches
UNION ALL
SELECT 'products', count(*) FROM products
UNION ALL
SELECT 'orders', count(*) FROM orders
UNION ALL
SELECT 'payments', count(*) FROM payments;
"
echo ""
echo "💡 You can now run 'make dev-backend-local' to work with this live mirror data."

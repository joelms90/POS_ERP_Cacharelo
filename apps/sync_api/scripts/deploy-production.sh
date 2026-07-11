#!/bin/bash
set -e

echo "======================================================================="
echo "               POS Sync API - Production Deployment                   "
echo "======================================================================="
echo ""

PROJECT_ID="fresh-sensor-497515-d3"
REGION="us-central1"
SERVICE_NAME="pos-sync-api"

echo "📋 Pre-deployment checklist:"
echo "  - Ensure you're on the correct branch"
echo "  - All tests passing"
echo "  - Changes committed to git"
echo ""
read -p "Continue with deployment? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "========================================"
echo "Step 1: Running Database Migrations"
echo "========================================"
echo ""

# Run migrations via Cloud SQL Proxy
echo "Starting Cloud SQL Proxy..."
cloud-sql-proxy $PROJECT_ID:$REGION:pos-db-instance --port 5433 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 3

# Run migrations
echo "Running migrations..."
DATABASE_URL="postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db" \
  NODE_ENV=production \
  pnpm run migrate

MIGRATE_EXIT_CODE=$?

# Kill proxy
kill $PROXY_PID 2>/dev/null || true

if [ $MIGRATE_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Migration failed! Aborting deployment."
    exit 1
fi

echo ""
echo "✅ Migrations completed successfully!"
echo ""

echo "========================================"
echo "Step 2: Building & Deploying to Cloud Run"
echo "========================================"
echo ""

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --platform managed \
  --timeout 900 \
  --cpu 2 \
  --memory 1Gi \
  --min-instances 0 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ Deployment Successful!"
    echo "========================================"
    echo ""
    echo "🌐 Service URL:"
    gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --format="value(status.url)"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Check logs:"
    echo "  https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs?project=$PROJECT_ID"
    exit 1
fi

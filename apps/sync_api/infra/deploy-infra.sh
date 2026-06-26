#!/bin/bash
set -e

# Load variables
PROJECT_ID="fresh-sensor-497515-d3"
REGION="us-central1"

echo "=================================================="
echo "🚀 Empire POS Backend Deploy Script"
echo "Project ID: $PROJECT_ID"
echo "Region:     $REGION"
echo "=================================================="

# Step 1: Initialize Terraform
echo "📦 Step 1: Initializing Terraform..."
terraform init

# Step 2: Provision Artifact Registry and IAM Policies first (bootstrap)
echo "📦 Step 2: Bootstrapping Artifact Registry and Cloud Build permissions..."
terraform apply \
  -target=google_artifact_registry_repository.pos_repo \
  -target=google_project_iam_member.compute_storage_viewer \
  -target=google_project_iam_member.compute_registry_writer \
  -target=google_project_iam_member.compute_logging_writer \
  -auto-approve

# Step 3: Build & push container image using Cloud Build (no local Docker required!)
echo "📦 Step 3: Building container image in the cloud via GCP Cloud Build..."
# Run gcloud builds submit from the sync_api directory (one folder up)
gcloud builds submit --project="$PROJECT_ID" --tag="${REGION}-docker.pkg.dev/${PROJECT_ID}/pos-repo/sync-api:latest" ..

# Step 4: Run full Terraform apply
echo "📦 Step 4: Deploying database, Cloud Run, and other resources..."
terraform apply -auto-approve

echo "=================================================="
echo "🎉 Deployment Complete!"
echo "=================================================="

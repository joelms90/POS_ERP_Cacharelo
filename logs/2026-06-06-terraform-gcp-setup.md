# Session Log: 2026-06-06 - Terraform GCP Infrastructure Setup

## 📅 Session Info
- **Date**: 2026-06-06
- **Agent/Model**: Antigravity / Gemini 3.5 Flash
- **Primary Files Created**:
  - [apps/sync_api/infra/main.tf](file:///Users/joelmorales/web/POS-ERP/apps/sync_api/infra/main.tf)
  - [apps/sync_api/infra/variables.tf](file:///Users/joelmorales/web/POS-ERP/apps/sync_api/infra/variables.tf)
  - [apps/sync_api/infra/outputs.tf](file:///Users/joelmorales/web/POS-ERP/apps/sync_api/infra/outputs.tf)
  - [apps/sync_api/infra/terraform.tfvars.example](file:///Users/joelmorales/web/POS-ERP/apps/sync_api/infra/terraform.tfvars.example)

## 🎯 Goals & Scope
- Set up a production-ready, serverless Google Cloud Platform (GCP) infrastructure using Terraform.
- Provision a Google Cloud Storage website bucket for the Admin Web Dashboard, Cloud Run for the Express API, Artifact Registry for container hosting, and Cloud SQL PostgreSQL for data persistence.

## 🛠️ Key Details & Configuration
1. **Infrastructure Directory**: All IaC files reside inside `/apps/sync_api/infra/`.
2. **Serverless Scale-to-Zero**: Cloud Run connects to Cloud SQL via standard UNIX socket proxy (`/cloudsql/connection-name`) and mounts volume bindings automatically.
3. **Budget Optimized**: Configured Cloud SQL instance to use shared-CPU `db-f1-micro` (~$9.50/mo) and Cloud Run scaling rules to scale down to 0 instances when idle.

## ⏩ How to Deploy

1. Initialize Terraform:
   ```bash
   cd ~/web/POS-ERP/apps/sync_api/infra
   terraform init
   ```

2. Copy the template variables and populate them:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars to insert your GCP Project ID and custom passwords
   ```

3. Build and push your Docker container to Artifact Registry:
   ```bash
   # Log in to Google Auth and Docker credential helper
   gcloud auth configure-docker us-central1-docker.pkg.dev

   # Build container inside apps/sync_api
   cd ..
   docker build -t us-central1-docker.pkg.dev/YOUR-PROJECT-ID/pos-repo/sync-api:latest .
   docker push us-central1-docker.pkg.dev/YOUR-PROJECT-ID/pos-repo/sync-api:latest
   ```

4. Apply the configuration to provision the infrastructure:
   ```bash
    cd infra
   terraform apply
   ```

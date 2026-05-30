# Quickstart Guide: Grupo Cacharelo Landing Page

This guide walks developers through local environment setup, running tests, and executing GCP deployments.

## 1. Directory Structure

This feature is organized under a unified landing app path:
```text
apps/landing_page/
├── frontend/          # Vite + React + TS + Tailwind (Atomic Design)
└── backend/           # Node.js 22 HTTPS Google Cloud Function
```

---

## 2. Local Development

### 2.1 Backend Setup & Running
The backend utilizes the Google Cloud Functions Framework to emulate the serverless environment locally.

1. Navigate to the backend directory:
   ```bash
   cd apps/landing_page/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the function emulator:
   ```bash
   npm run dev
   ```
   The endpoint will be available locally at `http://localhost:8080/`.

### 2.2 Frontend Setup & Running
1. Navigate to the frontend directory:
   ```bash
   cd apps/landing_page/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 3. Running Tests

### 3.1 Frontend Tests
Runs Vitest for unit and component tests:
```bash
cd apps/landing_page/frontend
npm run test
```

### 3.2 Backend Tests
Runs Jest/Vitest for HTTP handler validation:
```bash
cd apps/landing_page/backend
npm run test
```

---

## 4. Infrastructure Provisioning via Terraform (Preferred)

Ensure the Google Cloud SDK (`gcloud` CLI) and Terraform are installed:
```bash
gcloud auth login
gcloud auth application-default login  # Required for Terraform authentication
```

### 4.1 Initialize and Apply Infrastructure
1. Navigate to the infra directory:
   ```bash
   cd apps/landing_page/infra
   ```
2. Create a `terraform.tfvars` file and specify your parameters:
   ```hcl
   project_id  = "your-gcp-project-id"
   region      = "us-central1"
   bucket_name = "grupo-cacharelo-landing"
   ```
3. Initialize and provision the resources:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```
4. Note the output values for `function_url` and `website_bucket_name`.

---

## 5. Frontend Build and Static Deployment

### 5.1 Configure Environment Variables
Create a production environment file in the frontend folder:
`apps/landing_page/frontend/.env.production`
```env
VITE_CONTACT_API_URL=https://[REGION]-[PROJECT_ID].cloudfunctions.net/submit-inquiry
# (Or use the exact function_url output from Terraform)
```

### 5.2 Build & Deploy to GCS
1. Navigate to the frontend directory:
   ```bash
   cd apps/landing_page/frontend
   ```
2. Build the static distribution assets:
   ```bash
   pnpm build
   ```
3. Sync the `dist/` compilation folders to your public GCS bucket:
   ```bash
   gcloud storage rsync -r dist/ gs://[YOUR_WEBSITE_BUCKET_NAME]
   ```
   *(Ensure you replace `[YOUR_WEBSITE_BUCKET_NAME]` with the value outputted by Terraform `website_bucket_name`)*


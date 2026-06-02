# Quickstart Guide: Grupo Cacharelo Landing Page

This guide walks developers through local environment setup, Google Cloud configuration from scratch, running tests, and executing deployments.

## 1. Directory Structure

This feature is organized under a unified landing app path:
```text
apps/landing_page/
├── frontend/          # Vite + React + TS + Tailwind (Atomic Design)
├── backend/           # Node.js 22 HTTPS Google Cloud Function
└── infra/             # Terraform infrastructure as code (IaC)
```

---

## 2. Google Cloud Setup (For Fresh Accounts)

If you are setting up your development environment from scratch with a new Google Cloud account, follow these steps to initialize your credentials and services.

### 2.1 Install Google Cloud SDK (`gcloud` CLI)
First, install the `gcloud` command-line tool on your local machine:
* **macOS (via Homebrew - Recommended)**:
  ```bash
  brew install --cask google-cloud-sdk
  ```
* **macOS (Manual Archive)**: Download the macOS package from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install), extract it, and run `./google-cloud-sdk/install.sh`.
* **Restart your terminal** after installation to load the command paths.

### 2.2 Authenticate your CLI
Log in to your Google Cloud account through the CLI:
```bash
gcloud auth login
```
*This will open a browser window. Sign in using your Google Cloud credentials and approve authorization.*

### 2.3 Create a GCP Project & Firestore Database
If you do not have a project initialized yet:
1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Copy the generated **Project ID** (e.g. `grupo-cacharelo-dev`).
3. Set your active project in the CLI:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
4. **Provision Firestore Database**:
   * Navigate to **Firestore** in the GCP Console.
   * Click **Create Database**.
   * Select **Native Mode** (required for client SDK compatibility).
   * Choose a database region (e.g. `us-central1` or multi-region `nam5`) and finalize the creation.

### 2.4 Enable Application Default Credentials (ADC)
To allow your local backend emulation (running via Functions Framework) to connect to Firestore securely without using static service account key files:
```bash
gcloud auth application-default login
```
*This credentials file will be automatically discovered and used by the `@google-cloud/firestore` library during local execution.*

### 2.5 Handling Organization Policies (Domain Restricted Sharing)
If you are deploying public resources (such as `allUsers` access on a GCS bucket or Cloud Run function invoker) in a newer GCP Organization, the deployment may fail due to the **Domain restricted sharing** (`iam.allowedPolicyMemberDomains`) constraint. 

To override this restriction at the project level:
1. **Grant Policy Admin Permission**: Make sure your account has the **Organization Policy Administrator** (`roles/orgpolicy.policyAdmin`) role. If you are an Organization Administrator, you can grant it to yourself via the CLI:
   ```bash
   gcloud organizations add-iam-policy-binding YOUR_ORGANIZATION_ID \
     --member="user:your-email@domain.com" \
     --role="roles/orgpolicy.policyAdmin"
   ```
2. **Enable the Org Policy API**:
   ```bash
   gcloud services enable orgpolicy.googleapis.com --project=YOUR_PROJECT_ID
   ```
3. **Apply the Policy Override**:
   Create a `policy.yaml` file:
   ```yaml
   name: projects/YOUR_PROJECT_ID/policies/iam.allowedPolicyMemberDomains
   spec:
     rules:
     - allowAll: true
   ```
   Apply it via the CLI:
   ```bash
   gcloud org-policies set-policy policy.yaml
   ```

---

## 3. Local Development Setup

### 3.1 Backend Setup & Running
The backend utilizes the Google Cloud Functions Framework to emulate the serverless environment locally.

1. Navigate to the backend directory:
   ```bash
   cd apps/landing_page/backend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the function emulator:
   ```bash
   pnpm dev
   ```
   The endpoint will be available locally at `http://localhost:8080/`.

### 3.2 Frontend Setup & Running
1. Navigate to the frontend directory:
   ```bash
   cd apps/landing_page/frontend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 4. Running Tests

### 4.1 Frontend Tests
Runs Vitest for unit and component tests:
```bash
cd apps/landing_page/frontend
pnpm test
```

### 4.2 Backend Tests
Runs Vitest unit tests (mocks Firestore calls, runs with zero GCP credentials):
```bash
cd apps/landing_page/backend
pnpm test
```

---

## 5. Infrastructure Provisioning via Terraform

Ensure you have both the `gcloud` CLI and **Terraform** installed.

### 5.1 Initialize and Apply Infrastructure
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
   ```
4. Preview the changes:
   ```bash
   terraform plan
   ```
5. Deploy the resources to GCP:
   ```bash
   terraform apply
   ```
6. Note the output values for `function_url` and `website_bucket_name`.

---

## 6. Frontend Build and Static Deployment

### 6.1 Configure Environment Variables
Create a production environment file in the frontend folder:
`apps/landing_page/frontend/.env.production`
```env
VITE_CONTACT_API_URL=https://[REGION]-[PROJECT_ID].cloudfunctions.net/submit-inquiry
# (Or use the exact function_url output from Terraform)
```

### 6.2 Build & Deploy to GCS
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

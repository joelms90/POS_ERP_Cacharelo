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

## 4. Google Cloud Deployment

### 4.1 Prerequisites
Ensure the Google Cloud SDK (`gcloud` CLI) is installed and authenticated:
```bash
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
```

### 4.2 Deploying the Backend (Cloud Function)
1. Deploy the HTTPS function:
   ```bash
   cd apps/landing_page/backend
   gcloud functions deploy submit-inquiry \
     --runtime=nodejs22 \
     --trigger-http \
     --allow-unauthenticated \
     --entry-point=submitInquiry \
     --region=us-central1
   ```
2. Copy the generated URL and update the frontend `.env.production` file:
   ```env
   VITE_CONTACT_API_URL=https://us-central1-[YOUR_PROJECT_ID].cloudfunctions.net/submit-inquiry
   ```

### 4.3 Deploying the Frontend (Cloud Storage Static Web)
1. Compile the React production build:
   ```bash
   cd apps/landing_page/frontend
   npm run build
   ```
2. Upload the `dist/` directory to the GCS bucket:
   ```bash
   gcloud storage rsync -r dist/ gs://[YOUR_GCS_BUCKET_NAME]
   ```
3. Ensure the bucket is configured for public access and set the index page:
   ```bash
   gcloud storage buckets update gs://[YOUR_GCS_BUCKET_NAME] --web-main-page-suffix=index.html --web-error-page=index.html
   ```

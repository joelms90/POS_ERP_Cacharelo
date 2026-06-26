# Session Log: 2026-06-25 - Landing Page Firebase Integration & Domain Setup

## 📅 Session Info
- **Date**: 2026-06-25
- **Agent/Model**: Antigravity / Gemini 3.5 Flash
- **Primary Files Created**:
  - [apps/landing_page/frontend/firebase.json](file:///Users/joelmorales/web/POS-ERP/apps/landing_page/frontend/firebase.json) (Firebase Hosting configuration)
  - [apps/landing_page/frontend/.firebaserc](file:///Users/joelmorales/web/POS-ERP/apps/landing_page/frontend/.firebaserc) (Firebase project pointer)
  - [logs/2026-06-25-landing-page-firebase-domain-deployment.md](file:///Users/joelmorales/web/POS-ERP/logs/2026-06-25-landing-page-firebase-domain-deployment.md) (This document)
- **Primary Files Modified**:
  - [apps/landing_page/infra/terraform.tfvars](file:///Users/joelmorales/web/POS-ERP/apps/landing_page/infra/terraform.tfvars)
  - [apps/landing_page/infra/main.tf](file:///Users/joelmorales/web/POS-ERP/apps/landing_page/infra/main.tf)
  - [Makefile](file:///Users/joelmorales/web/POS-ERP/Makefile)

---

## 🎯 Goals & Scope
- Deploy the **Grupo Cacharelo Landing Page** (`apps/landing_page`) to the custom domain **`cacharelo.com`** and **`www.cacharelo.com`**.
- Establish secure HTTPS access for the website and contact form without paying for expensive Google Cloud Load Balancer rules.
- Fix Firestore writing failures on the backend contact API.
- Provide a simplified deployment process.

---

## 🛠️ Key Decisions & Implementations

### 1. Pivot from GCS to Firebase Hosting (for Free HTTPS)
* **The Challenge**: Google Cloud Storage (GCS) static website hosting does not support HTTPS natively for custom domains, and custom domain bucket naming (`www.cacharelo.com`) requires domain ownership verification in Google Search Console which failed to verify.
* **The Resolution**: Transitioned the frontend deployment target from GCS to **Firebase Hosting** (a GCP-native service). Firebase Hosting automatically provisions SSL/TLS certificates (HTTPS) for free, connects directly to the project, and handles domain mapping verification via DNS records instead of Search Console checks.

### 2. Firestore Native Database Provisioning
* **The Challenge**: Submitting the contact form returned an `Internal Server Error (500)` because the Firestore database was not initialized in the newly created GCP project.
* **The Resolution**: Modified [apps/landing_page/infra/main.tf](file:///Users/joelmorales/web/POS-ERP/apps/landing_page/infra/main.tf) to programmatically provision the default Firestore database in **Native Mode** (`FIRESTORE_NATIVE`) using Terraform, ensuring IaC consistency.

### 3. DNS Configuration in Squarespace
* Configured the following records on the domain registrar (Squarespace) DNS settings page to redirect the apex domain and map the main site:
  * `TXT` | `@` | `hosting-site=fresh-sensor-497515-d3` (Ownership verification)
  * `A` | `@` | `199.36.158.100` (Firebase load balancer IP)
  * `CNAME` | `www` | `fresh-sensor-497515-d3.web.app` (Alias mapping)
  * *Note: Google Workspace MX and security TXT records (DKIM/SPF) were preserved, ensuring emails continue to function.*

### 4. Simplified Operations (Makefile Commands)
Added quick lifecycle commands in the root [Makefile](file:///Users/joelmorales/web/POS-ERP/Makefile):
* `make landing-install`: Installs node modules for both landing page frontend (pnpm) and backend (npm).
* `make landing-build`: Compiles the static React/Vite frontend into `dist/`.
* `make landing-deploy`: Rebuilds and deploys the static files directly to Firebase Hosting.
* `make landing-infra`: Automatically applies Terraform changes (such as database updates or Cloud Function settings).

---

## ⏩ How to Deploy and Maintain

To push new updates to the landing page in the future, simply run:

```bash
make landing-deploy
```

This will automatically trigger a clean build of your React app and deploy it to `https://www.cacharelo.com` using the Firebase CLI.

---

## 📈 Status Check
- **Website SSL Status**: Live and secure under **`https://www.cacharelo.com`** (with automatic redirection from `https://cacharelo.com`).
- **Contact Form Status**: Fully verified. Forms correctly execute the Cloud Function and write records to the `contact_inquiries` collection in Firestore.

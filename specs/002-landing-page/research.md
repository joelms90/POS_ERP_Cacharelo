# Research Summary: Grupo Cacharelo Landing Page

This document outlines the architectural research, technology choices, and design rationale for implementing the landing page for Grupo Cacharelo.

## 1. Hosting & Deployment

### Decision
Deploy the Vite + React frontend to a **Google Cloud Storage (GCS)** bucket configured for public static website hosting, fronted by **Google Cloud Load Balancing** and **Cloud CDN** for SSL termination and global caching.

### Rationale
- **Cost Efficiency:** Google Cloud Storage static website hosting is extremely cost-effective compared to keeping a virtual machine or container running 24/7.
- **Performance:** Serving static assets from Google's edge locations via Cloud CDN minimizes latency, achieving the target LCP of <1.5s.
- **Simplicity:** The React + Vite project compiles down to static HTML, JavaScript, and CSS files, which can be deployed to a storage bucket with a single `gcloud storage rsync` command.

### Alternatives Considered
- **Google Cloud Run:** Rejecting because running a container for a static marketing site adds complexity (Dockerfile, container registry, cold-start latency) and higher costs for idle time.
- **Google App Engine (Standard):** Rejecting because it is more expensive than GCS and takes longer to deploy.

---

## 2. Interactive Map Component

### Decision
Implement the interactive map using **Leaflet** and **React-Leaflet** with a dark-themed raster tile layer from **CartoDB (Dark Matter)**.

### Rationale
- **Developer Overhead & Keys:** Leaflet is open-source and requires no API keys, credit card registrations, or Google Cloud Console project quotas, ensuring immediate startup.
- **Aesthetic Match:** The CartoDB Dark Matter tile layer matches the "Empire Noir" design system (deep dark obsidian and charcoal background with subtle gray/white strokes) out of the box.
- **Ease of Customization:** Leaflet makes it straightforward to add custom SVG or image markers (such as a Gold marker or corporate icon) and responsive popups.

### Alternatives Considered
- **Google Maps JavaScript API:** Rejected because it requires setting up GCP project billing, generating API keys, and writing complex custom JSON styles to match the dark theme.
- **Mapbox GL JS:** Rejected because it requires Mapbox access tokens and has usage-based pricing which could scale up with public marketing traffic.

---

## 3. Contact Form Backend

### Decision
Implement a simple HTTPS-triggered **Google Cloud Function (GCF)** running Node.js 22.x. It will receive form submissions, validate payloads (name, email, message, company), and write the inquiry to **Google Cloud Firestore** (or log/email it).

### Rationale
- **GCP Native Alignment:** A Cloud Function scales to zero when there is no traffic, costing nothing for idle time, and integrates perfectly with our GCP environment.
- **Security:** Allows secure verification of inputs, spam prevention (such as simple honeypot or reCAPTCHA integration), and keeps database or email provider keys safe from client exposure.
- **CORS Support:** The function will be configured with appropriate CORS headers to only accept submissions from the approved static landing page domain.

### Alternatives Considered
- **n8n Workflow Hook:** Rejected for core production backend because it introduces a dependency on n8n hosting availability, whereas GCF is fully managed by GCP. We could, however, trigger n8n from GCF if complex CRM routing is needed later.
- **sync_api Lambda Integration:** Rejected because the client wants the landing page deployed to gcloud and keeping the marketing and back-office POS environments separate prevents cross-talk and security risks.

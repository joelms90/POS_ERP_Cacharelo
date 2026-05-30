# Implementation Plan: Grupo Cacharelo Landing Page

**Branch**: `002-landing-page` | **Date**: 2026-05-30 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/002-landing-page/spec.md)

**Input**: Feature specification from `/specs/002-landing-page/spec.md`

## Summary

Build a high-impact, premium marketing landing page for **Grupo Cacharelo** using a cinematic "Empire Noir" design language. The technical solution leverages a **Vite + React (TypeScript + Tailwind CSS)** frontend organized via the **Atomic Design pattern**, deployed as a static site to **Google Cloud Storage (GCS)** bucket hosting. Contact form submissions will be securely processed by an HTTPS-triggered **Google Cloud Function (GCF)** in Node.js 22, persisting messages to **Google Cloud Firestore**. Map rendering is powered by **Leaflet** with a dark CartoDB Dark Matter tile style.

## Technical Context

**Language/Version**: 
- Frontend: HTML5/CSS3, TypeScript, React 18+, Vite 5+
- Backend: Node.js 22.x (Google Cloud Function)

**Primary Dependencies**:
- Frontend: `react`, `react-dom`, `typescript`, `tailwindcss`, `leaflet`, `react-leaflet`, `@types/leaflet`, `lucide-react`
- Backend: `@google-cloud/firestore`, `@google-cloud/functions-framework`

**Storage**:
- Client: LocalStorage (optional UX state)
- Cloud Database: Google Cloud Firestore (NoSQL collection `contact_inquiries`)
- Cloud Asset Hosting: Google Cloud Storage bucket

**Testing**:
- Frontend: `vitest` + `@testing-library/react` + `@testing-library/jest-dom`
- Backend: `vitest` or `jest` for API endpoint testing

**Target Platform**: 
- Web browser (Desktop and Mobile viewports)
- GCP infrastructure: GCS (static web hosting) and Cloud Functions (serverless HTTPS contact endpoint)

**Project Type**: 
- Single-page application (SPA) client + serverless API function

**Performance Goals**:
- Page load to Interactive (LCP): Under 1.5 seconds under simulated Slow 3G
- Accessibility score: >= 95 in Lighthouse
- Form response latency: Under 1.0 second to show success state

**Constraints**:
- Atomic Design structure (Atoms, Molecules, Organisms, Templates, Pages)
- Standard static site limitations (no server-side routing; client-side Router fallback)
- Strict CORS configuration allowing form submissions only from authorized landing page hosts
- Strong spam protection (honeypot field)

**Scale/Scope**:
- Public marketing traffic, handles hundreds of inquiry submissions daily
- Responsive grid supports viewports from 320px mobile to 1920px desktop

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. The landing page does not block any core POS features. The POS continues to operate offline without depending on this landing page.
- **Local authority**: PASS. Operational POS transactions do not interact with or depend on the landing page storage.
- **Sync contract**: PASS. The contact submission form uses a direct POST transaction with clear validation errors and server-generated unique IDs.
- **Cloud role**: PASS. Cloud Storage hosts the static pages, and Cloud Functions receives form submissions independently of the AWS Lambda POS sync layer.
- **Verification**: PASS. Lighthouse, responsive, and cross-browser testing scripts are planned, alongside endpoint unit tests.

## Project Structure

The project code is located entirely under the `apps/landing_page` directory:

```text
apps/landing_page/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── atoms/         # Buttons, Icons, Input, Typography
│   │   │   ├── molecules/     # Card, FormField, TabItem, Tooltip
│   │   │   ├── organisms/     # Header, Hero, BrandGrid, MapTabber, ContactForm, Footer
│   │   │   ├── templates/     # LandingTemplate (layout structures)
│   │   │   └── pages/         # LandingPage (assembles the page components)
│   │   ├── hooks/
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── vite.config.ts
└── backend/
    ├── src/
    │   └── index.ts          # GCF submitInquiry HTTPS endpoint handler
    ├── package.json
    └── tsconfig.json
```

**Structure Decision**: 
Establish `apps/landing_page/frontend` for the Vite/React application using Atomic Design, and `apps/landing_page/backend` for the Google Cloud Function. This cleanly isolates static client logic from serverless backend functions.

## Complexity Tracking

No constitution violations detected. The structure is standard for modern Vite + React static hosting with Cloud Function backends.

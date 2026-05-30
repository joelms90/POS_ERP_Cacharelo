# Tasks: Grupo Cacharelo Landing Page

**Input**: Design documents from `/specs/002-landing-page/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory layout structure

- [ ] T001 Initialize the root directory `apps/landing_page/` containing `frontend` and `backend` folders
- [ ] T002 [P] Initialize the frontend Vite + React TypeScript project under `apps/landing_page/frontend` using npm
- [ ] T003 [P] Initialize the backend Node.js Node-TS package under `apps/landing_page/backend` for Google Cloud Functions
- [ ] T004 [P] Configure TypeScript compiler settings and code formatters (Prettier/ESLint) for both projects

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: UI theme setup and API server scaffolding

**⚠️ CRITICAL**: No user story implementation can begin until these tasks are complete

- [ ] T005 Setup Tailwind CSS configurations, colors (`#0B0B0C`, `#D4AF37`, `#2A2415`), and typography tokens in `apps/landing_page/frontend/tailwind.config.js` and custom fonts inside `apps/landing_page/frontend/src/styles/index.css`
- [ ] T006 Create directory sub-folders for Atomic Design pattern (`src/components/atoms/`, `src/components/molecules/`, `src/components/organisms/`, `src/components/templates/`, `src/components/pages/`)
- [ ] T007 [P] Scaffolder functions-framework emulation server in `apps/landing_page/backend/src/index.ts` with TypeScript configuration and JSON request parsing
- [ ] T008 Setup deployment command helper scripts for static GCS sync and GCF deploy in `apps/landing_page/package.json`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Explore Brand Identity & Brands (Priority: P1) 🎯 MVP

**Goal**: Establish brand identity and render the hero and four main brand cards under the Empire Noir theme

**Independent Test**: Build and preview the frontend locally at `http://localhost:5173/`. Verify the page renders the hero background image, header/footer, and 4 cards with bronze borders transitioning to gold on hover.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create Typography Atom (`src/components/atoms/Typography.tsx`) and Button Atom (`src/components/atoms/Button.tsx`) supporting primary (gold) and secondary (ghost bronze) styles
- [ ] T010 [P] [US1] Create BrandCard Molecule (`src/components/molecules/BrandCard.tsx`) that implements the linear gradient surface and border transition on hover
- [ ] T011 [US1] Implement responsive Navigation Header Organism (`src/components/organisms/Header.tsx`) and Footer Organism (`src/components/organisms/Footer.tsx`) with mobile viewport collapsing drawers
- [ ] T012 [US1] Implement Hero Organism (`src/components/organisms/Hero.tsx`) using custom cinematic background overlay as defined in draft
- [ ] T013 [US1] Create layout Page Template (`src/components/templates/LandingTemplate.tsx`) and Main Page (`src/components/pages/LandingPage.tsx`) assembling header, hero, brand grid, and footer
- [ ] T014 [US1] Wire the page assembly into `src/App.tsx` and run frontend unit/component tests using Vitest to verify brand rendering

**Checkpoint**: User Story 1 (MVP) is fully functional and testable independently.

---

## Phase 4: User Story 2 - Interactive Territories & Operations (Priority: P2)

**Goal**: Display locations list and map pins categorized by tabs ("En La Ciudad", "En Tránsito", "Operaciones 24 Horas")

**Independent Test**: Navigate to the Territories section, verify clicking a tab displays only the locations for that category and coordinates map pins accordingly. Hovering over map pins must render detail popups.

### Implementation for User Story 2

- [ ] T015 [P] [US2] Install Leaflet dependencies (`leaflet`, `react-leaflet`, and `@types/leaflet`) in `apps/landing_page/frontend`
- [ ] T016 [P] [US2] Define location dataset records in a static config file `src/data/locations.ts` categorized by cities and transit nodes
- [ ] T017 [US2] Create TabItem Molecule (`src/components/molecules/TabItem.tsx`) representing active and inactive navigation tabs in the map controller
- [ ] T018 [US2] Implement MapView Organism (`src/components/organisms/MapView.tsx`) embedding Leaflet with CartoDB Dark Matter tile layers and customized gold location markers
- [ ] T019 [US2] Implement MapTabber Organism (`src/components/organisms/MapTabber.tsx`) linking the tab active state to both the map view markers and the responsive locations list sidebar
- [ ] T020 [US2] Integrate `MapTabber` into the main `LandingPage.tsx` page layout and test responsiveness on mobile and tablet screens

**Checkpoint**: At this point, User Stories 1 AND 2 are both functional and testable.

---

## Phase 5: User Story 3 - Safe Line & Contact Channels (Priority: P3)

**Goal**: Submit inquiries via a validated contact form to the GCF backend and provide direct WhatsApp links

**Independent Test**: Submit a contact inquiry. Verify frontend exhibits visual loading, handles validation errors, shows a success checkmark, and GCF creates a document under `contact_inquiries` collection in Firestore.

### Implementation for User Story 3

- [ ] T021 [P] [US3] Create ContactForm Organism (`src/components/organisms/ContactForm.tsx`) with client validation, email check, name limits, and a spam-preventing hidden honeypot input field
- [ ] T022 [P] [US3] Implement HTTPS endpoint routing, CORS header permission, spam check, and Firestore insertion in `apps/landing_page/backend/src/index.ts`
- [ ] T023 [US3] Write GCF API unit tests verifying validation failures (bad email format, size overflow) and honeypot submission rejection
- [ ] T024 [US3] Connect ContactForm to send fetch POST requests to the Cloud Function, binding the URL from environment configuration (`.env` files)
- [ ] T025 [US3] Create floating WhatsApp button Molecule and configure direct dial links for `55 9244 9939` in the contact section

**Checkpoint**: All user stories (US1, US2, US3) are fully integrated and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: SEO optimizations, accessibility fixes, and cloud deployments

- [ ] T026 Add proper HTML title tags, unique element IDs for test automation, meta viewport settings, and meta descriptions for SEO optimization
- [ ] T027 Configure a Vite Service Worker plugin or simple asset caching script to enable offline caching of images and stylesheet assets
- [ ] T028 Conduct Lighthouse audit reviews (Performance, Accessibility, Best Practices, SEO) on the build build output, correcting contrast and element scale down to 320px
- [ ] T029 Execute the HTTPS Google Cloud Function deployment using gcloud commands as configured in `quickstart.md`
- [ ] T030 Deploy frontend build assets to Google Cloud Storage (GCS) bucket and apply static website access configurations
- [ ] T031 Perform final end-to-end integration checks of the deployed website verifying form storage in Firestore and map interactivity

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. BLOCKS all user stories.
- **User Stories (Phases 3, 4, 5)**: Depend on Foundational completion.
  - Phase 3 (US1) is our priority MVP.
  - Phase 4 (US2) and Phase 5 (US3) can be worked on sequentially or in parallel.
- **Polish (Phase 6)**: Depends on all user stories being completed.

### Parallel Opportunities

- Initialization of frontend (`T002`) and backend (`T003`) can run concurrently.
- Setup of tailwind typography (`T005`) and backend function scaffolder (`T007`) can run concurrently.
- Front-end Atoms (`T009`) and Molecule cards (`T010`) can run concurrently.
- Leaflet map styles (`T015`) and location records data (`T016`) can run concurrently.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Setup local project layouts (Phase 1).
2. Prepare Tailwind theme configs and Atomic folders (Phase 2).
3. Implement core components, brands cards, header, and footer (Phase 3).
4. Run locally and verify visual fidelity against the draft mockup before proceeding to maps.

# Implementation Plan: Tauri Business Control Admin UI

**Branch**: `004-business-control-ui` | **Date**: 2026-06-11 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/004-business-control-ui/spec.md)

**Input**: Feature specification from `/specs/004-business-control-ui/spec.md`

## Summary

Implement a dedicated desktop administration console using React, Vite, TypeScript, and Tauri. The application will consume the existing `apps/sync_api` Express API to manage employee login PINs, verify database connectivity, and monitor POS synchronization health. Visuals will follow the premium "Empire Noir" design language (obsidian backgrounds, Champagne Gold interactive elements, Aged Bronze outlines) implemented via custom Tailwind CSS tokens. The UI code will be modularly organized following the Atomic Component Strategy (Atoms, Molecules, Organisms, Templates, Pages).

## Technical Context

**Language/Version**: 
- Desktop Client Frontend: React 18+, TypeScript 5+, Vite 5+
- Desktop Wrapper: Tauri v2
- Backend Service: Node.js 20+ (Express / TypeScript in `apps/sync_api`)

**Primary Dependencies**:
- Frontend: `react`, `react-dom`, `@tauri-apps/api` (Tauri desktop system integration)
- Styling: `tailwindcss`, `postcss`, `autoprefixer`
- Dev/Test: `vitest`, `@testing-library/react` (component and unit testing)

**Storage**:
- Local Client: `localStorage` for caching the administrative authorization token (`X-Admin-Token`).
- Backend Storage: Direct writes to PostgreSQL database (or fallback `data/users.json` file) managed by `apps/sync_api`.

**Testing**:
- Unit/Component: `vitest` and `@testing-library/react` to test form validators, inputs, button states, and state containers.
- Mocking: Mock `fetch` requests to verify API error/success integration states.

**Target Platform**: 
- macOS (Desktop Client WebKit Webview)
- Windows 10/11 (Desktop Client WebView2)

**Project Type**: 
- React-Tauri Desktop Application + REST Client

**Performance Goals**:
- Application cold launch to interactive login screen: < 800ms
- Employee list render latency: < 150ms post-API response
- Tailwind utility compilation: < 100ms in hot reload

**Constraints**:
- Must run in desktop-native wrapper window.
- The UI must adapt cleanly to sizes down to 1024x768.
- Strictly adhere to visual tokens in `THEME_SPEC.md` / `003-waiter-cashier-screens` plan (obsidian/gold palette).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. The admin app operates back-office tasks, not front-line POS orders. It degrades gracefully when the sync backend is unreachable, displaying clear system alerts and disabling actions rather than freezing or crashing.
- **Local authority**: PASS. Authentication state and token are cached locally in the Tauri client webview storage to prevent repeated login prompts.
- **Sync contract**: PASS. Uses the REST API contract exposed by `apps/sync_api`. All mutations use idempotent IDs (UUIDs) and propagate immediately to the backend database.
- **Cloud role**: PASS. The desktop app does not modify the PostgreSQL schema. It depends on the Express API server to synchronize and persist user data.
- **Verification**: PASS. Front-end unit tests check that invalid PINs and empty user records are blocked locally before making server requests.

## Project Structure

### Documentation (this feature)

```text
specs/004-business-control-ui/
├── plan.md              # This file
├── research.md          # Technology choices and theme alignment details
├── data-model.md        # UI models and TypeScript interface schemas
├── quickstart.md        # Command line instructions for starting the app
├── checklists/
│   └── requirements.md  # Spec quality validation checklist
└── contracts/
    └── api.md           # API request/response specifications
```

### Source Code

The new React Tauri project will reside inside `apps/business_control_tauri/`:

```text
apps/business_control_tauri/
├── src-tauri/
│   ├── src/
│   │   └── main.rs             # Tauri rust entrypoint
│   └── tauri.conf.json         # Window boundaries, permissions, and build targets
├── src/
│   ├── components/
│   │   ├── atoms/              # Simple style-heavy tags
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Heading.tsx
│   │   ├── molecules/          # Multi-atom compounds
│   │   │   ├── FormField.tsx
│   │   │   ├── UserCardHeader.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── organisms/          # Business logic blocks
│   │   │   ├── UserForm.tsx
│   │   │   ├── UsersGrid.tsx
│   │   │   └── LoginForm.tsx
│   │   └── templates/          # Standard layout wrappers
│   │       └── AdminLayout.tsx
│   ├── pages/                  # Page route components
│   │   ├── LoginPage.tsx
│   │   └── DashboardPage.tsx
│   ├── services/
│   │   └── api.ts              # Fetch client wrapper for backend API calls
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication state hook
│   ├── main.tsx
│   └── index.css               # Tailwind directives and core fonts loading
├── package.json
├── postcss.config.js
├── tailwind.config.js          # Extended with Obsidian, Onyx, Gold, and Bronze colors
└── tsconfig.json
```

**Structure Decision**: Create the dedicated subproject `apps/business_control_tauri` using the standard Tauri template structure. Organize frontend React code strictly within `src/components/` separated into atomic subfolders (`atoms`, `molecules`, `organisms`, `templates`) and `src/pages/` for route handlers. This separates pure UI elements from page-level state management and backend services.

## Complexity Tracking

*No constitution violations detected. Fits within standard web application design guidelines.*

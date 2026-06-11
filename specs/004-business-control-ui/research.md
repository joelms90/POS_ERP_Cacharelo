# Research & Design Decisions: Tauri Business Control Admin UI

This document outlines the research, technical decisions, and design choices for implementing the Tauri-based Business Control Admin UI, connecting to the Node-based `apps/sync_api` backend.

## 1. Application Shell & Desktop Wrapper

### Decision
Bootstrap a new desktop application using **Tauri v2** with **React**, **TypeScript**, and **Vite** as the frontend build tool.
- Setup command: `pnpm create tauri-app apps/business_control_tauri --template react-ts --manager pnpm --yes`

### Rationale
- **Lightweight Footprint**: Tauri utilizes the host operating system's native webview (WebKit on macOS, WebView2 on Windows), resulting in tiny binary sizes (~10-20MB) and very low memory consumption compared to Electron (~100MB+).
- **Security**: Tauri restricts system APIs by default, which is ideal for back-office business control where security is paramount.
- **Vite Build Speed**: Vite provides extremely fast Hot Module Replacement (HMR) during development and optimized builds.

### Alternatives Considered
- **Electron**: Rejected due to massive bundle sizes (100MB+) and high memory usage.
- **Flutter Desktop**: Rejected because the user specifically requested React with TypeScript for this admin control panel.
- **Pure Web Dashboard**: Rejected because the business needs a dedicated, secure desktop application icon and integration for administrators (e.g., local storage protection, system tray, window size controls, and native-feeling window frames).

---

## 2. Styling, Theme & Design Language

### Decision
Implement **Tailwind CSS** for component styling, extending the theme to incorporate the **"Empire Noir"** design system tokens defined in the POS-ERP project.
- **Obsidian Background**: `#0b0b0c`
- **Onyx Card Surface**: `#161618`
- **Charcoal Card Accent**: `#222225`
- **Champagne Gold Accents**: `#d4af37`
- **Gold Light**: `#f3e5ab`
- **Aged Bronze outlines**: `#8c7853`
- **Aged Bronze Dark borders**: `#2a2415`
- **Text Primary**: `#eaeaea`
- **Text Secondary**: `#a0a0a0`
- **Typography**: Inter (sans-serif) for high-density UI readability, Bodoni Moda (serif) for headers and branding.

### Rationale
- Tailwind allows rapid creation of custom designs without writing verbose stylesheet classes.
- Extending `tailwind.config.js` with project tokens ensures visual consistency with the existing Dart/Flutter POS apps.

### Alternatives Considered
- **CSS Modules**: Good for isolation, but slower to write and align with design tokens compared to Tailwind.
- **Styled Components**: Adds runtime CSS-in-JS overhead, which increases bundle size.

---

## 3. Atomic Components Strategy

### Decision
Structure the frontend React code using the **Atomic Design** pattern:
- **Atoms**: Single-responsibility, styling-heavy nodes (e.g., `<Button>`, `<Input>`, `<Badge>`, `<Heading>`).
- **Molecules**: Combinations of 2-3 atoms (e.g., `<FormField>`, `<UserCardHeader>`, `<StatusIndicator>`).
- **Organisms**: Composable, business-logic-aware widgets (e.g., `<UserForm>`, `<UsersGrid>`, `<LoginForm>`).
- **Templates**: Page layout structures (e.g., `<AdminLayout>`).
- **Pages**: View-level coordinators that fetch data and pass down props (e.g., `<LoginPage>`, `<DashboardPage>`).

Directory layout under `src/`:
```text
src/
├── components/
│   ├── atoms/
│   ├── molecules/
│   ├── organisms/
│   └── templates/
├── pages/
├── services/
├── hooks/
└── types/
```

### Rationale
- **Maintainability**: Prevents the creation of massive component files where UI styling and state logic are tightly coupled.
- **Reusability**: Standardizes UI elements like buttons, inputs, and form groups so they look identical everywhere.

---

## 4. Backend Communication & Authentication

### Decision
Use standard client-side `fetch` to connect to the local Node backend API (`apps/sync_api`):
- Connection endpoints:
  - Auth Admin: `POST http://localhost:3000/api/auth/admin` (returns the token)
  - Get Users: `GET http://localhost:3000/api/users` (requires headers: `X-Admin-Token`)
  - Add User: `POST http://localhost:3000/api/users` (requires headers: `X-Admin-Token`)
  - Delete User: `DELETE http://localhost:3000/api/users/:id` (requires headers: `X-Admin-Token`)
- Persistent Session: Store the `adminToken` in `localStorage`. Check token validity on boot.

### Rationale
- The backend `apps/sync_api` already exposes these REST endpoints.
- Client-side `fetch` is natively supported in modern browser runtimes, requiring no external packages.

### Alternatives Considered
- **Tauri HTTP plugin**: Can bypass CORS, but since the Express backend already implements `cors()` allowing all origins, standard `fetch` is cleaner and easier to mock or test in standard browser environments.

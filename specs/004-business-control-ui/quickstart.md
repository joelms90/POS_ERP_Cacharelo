# Quickstart Guide: Tauri Business Control Admin UI

This guide outlines how to bootstrap, run, and test the Tauri-based Business Control Admin UI.

---

## 1. Project Initialization

To bootstrap the React-Tauri desktop application shell:

1. Navigate to the `apps` directory:
   ```bash
   cd apps
   ```
2. Run the Tauri app generator with the React-TypeScript template:
   ```bash
   pnpm create tauri-app business_control_tauri --template react-ts --manager pnpm --yes
   ```
3. Navigate into the new project:
   ```bash
   cd business_control_tauri
   ```
4. Install Tailwind CSS and its dependencies:
   ```bash
   pnpm add -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

---

## 2. Running the Application in Development Mode

To start the Tauri application with live reload:

1. Ensure the Express backend (`apps/sync_api`) is running:
   ```bash
   cd apps/sync_api
   npm run dev
   ```
2. In a separate terminal, start the Tauri dev loop:
   ```bash
   cd apps/business_control_tauri
   pnpm tauri dev
   ```
   *(This launches a native desktop window wrapping the Vite React frontend).*

---

## 3. Running Unit and Component Tests

We will use **Vitest** and **React Testing Library** for verifying atomic component rendering and form validations.

To run the test suite:
```bash
cd apps/business_control_tauri
pnpm test
```

---

## 4. UI Verification Checklist

When building and reviewing components, verify that:
- [ ] Obsidian Background (`#0B0B0C`) and Onyx cards (`#161618`) match the POS "Empire Noir" design system.
- [ ] Button hover, focus, and active states have smooth micro-animations.
- [ ] Employee forms block invalid submits (names empty, PINs not 4 digits) with clean inline validation messages.
- [ ] Real-time status indicators turn green when the Node API port 3000 is reachable, and amber/red when unreachable.
- [ ] Tauri window layout handles resizing gracefully, down to a minimum size of 1024x768.
- [ ] Access revocation (deleting a user) triggers a confirmation dialog before sending the API request.

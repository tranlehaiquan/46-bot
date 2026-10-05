## Context

The repository currently places backend logic directly at the root (`src/`, `scripts/`, `dist/`), while the frontend is contained in `web/`. This causes asymmetry: root scripts like `pnpm dev` are missing, and developers running frontend preview or dev servers encounter `ECONNREFUSED` because there is no coordinated launcher for backend and frontend services.

Migrating to a formal pnpm workspace cleanly divides the codebase into `apps/backend` and `apps/admin` under a standard `pnpm-workspace.yaml` file.

## Goals / Non-Goals

**Goals:**
- Formalize pnpm workspace with `pnpm-workspace.yaml` including `apps/*`.
- Move root backend files into `apps/backend/` (`name: "@bot/backend"`).
- Move `web/` into `apps/admin/` (`name: "@bot/admin"`).
- Establish unified root commands in root `package.json`:
  - `pnpm dev`: Start backend server with tsx/watch and admin with Vite concurrently.
  - `pnpm build`: Build admin dist, then build backend TypeScript bundle.
  - `pnpm test`: Execute test suites across workspace packages.
  - `pnpm typecheck`: Run typechecking for all packages.
- Ensure production static serving in backend locates `apps/admin/dist` properly.

**Non-Goals:**
- Creating a shared UI component package or library (existing UI primitives inside admin are sufficient).
- Changing backend route signatures, database tables, or business logic.
- Changing admin frontend views or API contracts.

## Decisions

### 1. Workspace Layout (`apps/backend` and `apps/admin`)
- **Structure**:
  ```text
  ├── package.json           # Workspace root manifest
  ├── pnpm-workspace.yaml    # packages: ['apps/*']
  ├── pnpm-lock.yaml
  ├── apps/
  │   ├── backend/           # Fastify bot service
  │   │   ├── package.json   # @bot/backend
  │   │   ├── tsconfig.json
  │   │   ├── src/
  │   │   └── ...
  │   └── admin/             # Vite + React Admin
  │       ├── package.json   # @bot/admin
  │       ├── vite.config.ts
  │       ├── src/
  │       └── ...
  ```
- *Alternatives considered*: Keeping backend at root and only moving `web/`. Rejected because it creates toolchain ambiguity (tsconfig paths, eslint/tsc targeting, and dependency collisions).

### 2. Root Dev Orchestration
- Use `concurrently` at root or `pnpm --parallel --filter` for `pnpm dev`:
  - Backend: `pnpm --filter @bot/backend dev`
  - Admin: `pnpm --filter @bot/admin dev`
- Admin Vite proxy continues to forward `/api` requests to `http://localhost:3000`.

### 3. Static Asset Resolution in Production
- In `server.ts`, static admin serving resolves `dist` from `apps/admin/dist` relative to project root or compiled backend path.

## Risks / Trade-offs

- **Path changes for tests and scripts**: [Risk] Relative paths in tests (`src/server.test.ts`, etc.) might need adjustment. → Mitigation: Validate all 172 tests in `apps/backend` after move.
- **Environment variables loading**: [Risk] Backend needs `.env` from repo root or `apps/backend/.env`. → Mitigation: Support loading `.env` from both package directory and workspace root.

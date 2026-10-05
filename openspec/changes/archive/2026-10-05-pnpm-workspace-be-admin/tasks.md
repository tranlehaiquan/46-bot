## 1. Monorepo Workspace Configuration

- [x] 1.1 Create `pnpm-workspace.yaml` declaring `apps/*` as workspace packages
- [x] 1.2 Restructure root `package.json` with workspace lifecycle scripts (`dev`, `build`, `test`, `typecheck`)
- [x] 1.3 Add workspace dev orchestration tools (such as `concurrently`) to root dependencies

## 2. Migrate Apps Layout

- [x] 2.1 Move `web/` to `apps/admin/` and configure package manifest as `@bot/admin`
- [x] 2.2 Move backend source (`src/`, `scripts/`, `dist/`, backend configs) into `apps/backend/` with manifest `@bot/backend`
- [x] 2.3 Add dev watch script (`dev`) to `apps/backend/package.json` for live reloading

## 3. Path Resolution and Inter-Service Wiring

- [x] 3.1 Update backend static file serving in `apps/backend` to resolve `apps/admin/dist`
- [x] 3.2 Support `.env` loading from workspace root and package directory
- [x] 3.3 Verify Vite proxy configuration in `apps/admin/vite.config.ts` points to backend port 3000

## 4. Verification and Validation

- [x] 4.1 Run `pnpm install` and verify clean dependency resolution across workspace packages
- [x] 4.2 Run `pnpm test` and ensure all test suites pass
- [x] 4.3 Run `pnpm build` and ensure production bundles for both admin and backend build cleanly
- [x] 4.4 Test `pnpm dev` execution to ensure concurrent startup of backend and admin

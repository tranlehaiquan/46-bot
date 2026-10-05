## Why

Currently, the repository has an asymmetric structure where the backend code resides at the root level (`src/`) while the web admin lives in a subdirectory (`web/`). There is no `pnpm-workspace.yaml`, and root lifecycle commands like `pnpm dev` fail because commands and environments are not orchestrated across backend and frontend applications. Restructuring into a standard pnpm monorepo under `apps/` streamlines development, provides independent package management, and enables unified commands (`pnpm dev`, `pnpm build`, `pnpm test`).

## What Changes

- Add `pnpm-workspace.yaml` declaring workspace packages under `apps/*`.
- Move the backend application into `apps/backend` (or `apps/bot`), with its dedicated `package.json`, `tsconfig.json`, `src/`, and test configurations.
- Move the web admin dashboard from `web/` into `apps/admin`, with its dedicated `package.json`, `vite.config.ts`, and frontend assets.
- Configure root `package.json` with unified monorepo orchestration scripts:
  - `pnpm dev`: Runs both backend and admin frontend concurrently in development mode.
  - `pnpm build`: Builds admin assets and compiles backend TypeScript.
  - `pnpm test`: Runs test suites across workspace apps.
  - `pnpm typecheck`: Typechecks all workspace packages.
- Update references in configuration, build scripts, dockerfiles (if any), and documentation to reflect the new `apps/` paths.

## Capabilities

### New Capabilities
- `pnpm-workspace`: Multi-package pnpm monorepo layout isolating `apps/backend` and `apps/admin` with root orchestration scripts for dev, build, test, and typecheck.

### Modified Capabilities
<!-- None: Functional bot requirements and admin API behaviors remain identical. -->

## Impact

- Directory structure: `src/` moved to `apps/backend/src/`, `web/` moved to `apps/admin/`.
- Root files: `package.json` becomes workspace root manifest; `pnpm-workspace.yaml` added.
- Development workflow: Running `pnpm dev` from root will start both backend server and admin Vite dev server.
- Static serving / Build: Backend serves admin production bundle from `apps/admin/dist` or proxy in dev.

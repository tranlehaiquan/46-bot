## ADDED Requirements

### Requirement: Multi-package Workspace Layout
The repository SHALL use a pnpm workspace configuration rooted at `pnpm-workspace.yaml` declaring `apps/*` as workspace packages. The backend service SHALL reside in `apps/backend` and the admin web dashboard SHALL reside in `apps/admin`.

#### Scenario: Workspace package discovery
- **WHEN** running `pnpm -r list` or `pnpm install` at the workspace root
- **THEN** pnpm discovers both `apps/backend` and `apps/admin` as member packages with isolated dependencies and scripts

### Requirement: Unified Root Lifecycle Commands
The root `package.json` SHALL provide unified orchestration scripts for development, building, testing, and typechecking.

#### Scenario: Running development servers concurrently
- **WHEN** developer runs `pnpm dev` at the workspace root
- **THEN** both the backend API server and the admin Vite dev server start concurrently

#### Scenario: Building the full stack
- **WHEN** running `pnpm build` at the workspace root
- **THEN** the admin production bundle is built first and the backend TypeScript is compiled, producing production-ready artifacts

#### Scenario: Running test suites across workspace
- **WHEN** running `pnpm test` at the workspace root
- **THEN** test suites across workspace apps are executed and report results

### Requirement: Admin Static Asset Delivery and Routing
The backend server in `apps/backend` SHALL serve production web admin assets built by `apps/admin` when running in production mode, and allow development proxying when running in dev mode.

#### Scenario: Production admin bundle resolution
- **WHEN** the backend runs in production and receives a request under `/admin`
- **THEN** it resolves and serves static files from `apps/admin/dist` without broken paths

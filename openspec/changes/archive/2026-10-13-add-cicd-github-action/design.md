## Context

The repository is a pnpm monorepo containing:
- `@bot/backend`: Node.js 22 + TypeScript + Fastify + SQLite/Turso.
- `@bot/admin`: React 19 + Vite + Tailwind CSS v4.
- A multi-stage `Dockerfile` creating a production runtime container.

Currently, there are no GitHub Actions workflows configured in `.github/workflows/`. Continuous verification and image packaging are done manually, leading to risks of breaking changes on pull requests and untracked container builds.

## Goals / Non-Goals

**Goals:**
- Provide a robust CI workflow (`.github/workflows/ci.yml`) triggered on PRs and pushes to `main`.
- Automate workspace dependency installation with pnpm store caching (`pnpm@12.9.1`, Node 22).
- Execute workspace typechecks (`pnpm typecheck`), unit/integration test suites (`pnpm test`), and full package builds (`pnpm build`).
- Verify Docker container image buildability in CI (`docker build` check).
- Provide an automated CD workflow (`.github/workflows/cd.yml`) to build and push production Docker images to GitHub Container Registry (`ghcr.io`) upon tag push or workflow dispatch.
- Document GitHub Actions configuration, required workflow permissions, and image consumption instructions in `readme.md`.

**Non-Goals:**
- Deploying directly into production host servers via SSH/Ansible (production orchestrators will pull the published GHCR container image).
- Multi-architecture Docker builds (ARM64/v7) unless explicitly requested; AMD64 on `ubuntu-latest` is the baseline.

## Decisions

### 1. Separation of Concerns: `ci.yml` vs `cd.yml`
- **Choice**: Separate `ci.yml` for testing/verification and `cd.yml` for Docker container publishing.
- **Rationale**: Isolates minimal read-only permissions for CI checks from write permissions (`packages: write`) required for GHCR publishing. Prevents unauthorized or unnecessary image publishing on arbitrary branches or external PRs.
- **Alternatives Considered**: Unified single workflow file with conditional steps. Rejected because separating them clarifies workflow status badges, security permissions, and trigger conditions.

### 2. Node.js & pnpm Setup with Actions Caching
- **Choice**: Use `pnpm/action-setup@v4` pinned to `pnpm@12.9.1` and `actions/setup-node@v4` with `cache: 'pnpm'`.
- **Rationale**: `pnpm@12.9.1` and `node: ">=22"` are strictly specified in `package.json`. Actions cache dramatically reduces CI runtime by caching the pnpm virtual store between runs.

### 3. CI Job Pipeline Architecture
- **Choice**: Sequential or focused parallel jobs in CI:
  - `validate`: runs `pnpm typecheck`, `pnpm test`, and `pnpm build`.
  - `docker-lint`: builds the `Dockerfile` with `push: false` to ensure Dockerfile instructions remain valid as dependencies and files change.
- **Rationale**: Keeps CI simple, fast, and deterministic while ensuring Docker build validity before merge.

### 4. Container Registry: GitHub Container Registry (GHCR)
- **Choice**: Publish container images to `ghcr.io/<owner>/<repo>` using `docker/build-push-action@v6` and `docker/metadata-action@v5`.
- **Rationale**: Built-in to GitHub with zero external credential setup (uses `secrets.GITHUB_TOKEN`).
- **Tagging Strategy**:
  - `type=ref,event=branch` (e.g. `main`)
  - `type=semver,pattern={{version}}` (e.g. `v1.0.0`)
  - `type=sha,prefix=sha-` (e.g. `sha-abcd123`)
  - `type=raw,value=latest,enable={{is_default_branch}}`

## Risks / Trade-offs

- **[Risk] pnpm lockfile mismatch on CI** → **Mitigation**: Use `pnpm install --frozen-lockfile` to fail fast if dependencies were modified without updating `pnpm-lock.yaml`.
- **[Risk] Large Docker build times in CI** → **Mitigation**: Utilize GitHub Actions Cache backend (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) with Buildx.
- **[Risk] Missing repository package write permissions in CD** → **Mitigation**: Explicitly declare `permissions: packages: write, contents: read` in `cd.yml`.

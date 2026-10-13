## Why

As the codebase evolves with multiple workspace packages (`@bot/backend` and `@bot/admin`), automated verification is essential to maintain code quality, avoid regressions, and ensure that builds and tests pass reliably before merging. Additionally, introducing an automated Docker build and publish pipeline simplifies deployments and guarantees container image reproducibility.

Currently, there are no GitHub Actions workflows configured in the repository, requiring developers to manually run checks and risking undetected breakages in continuous delivery.

## What Changes

- Add GitHub Actions CI workflow (`.github/workflows/ci.yml`) triggered on push and pull requests to `main`:
  - Cache pnpm dependencies using `pnpm/action-setup` and `actions/setup-node`.
  - Execute monorepo typechecking (`pnpm typecheck`).
  - Execute test suites (`pnpm test`).
  - Execute full workspace build (`pnpm build`).
  - Validate Docker container build (`Dockerfile`).
- Add GitHub Actions CD / Container Release workflow (`.github/workflows/docker-publish.yml` or unified release pipeline):
  - Support manual triggers (`workflow_dispatch`) and automated publishing on semantic release tags or merges to `main`.
  - Build multi-stage Docker image and push to GitHub Container Registry (GHCR) with standard tags (`sha`, `latest`, semantic tags).
  - Use GitHub Actions cache for Docker layer caching to optimize build times.
- Document GitHub Actions workflows, required secrets/permissions, and local testing instructions in `readme.md`.

## Capabilities

### New Capabilities
- `github-actions-ci-cd`: Automated CI/CD pipeline using GitHub Actions covering dependency caching, typechecking, testing, building, and GHCR Docker image deployment.

### Modified Capabilities
<!-- None: no existing requirements or specifications are altered -->

## Impact

- **Affected Files/Directories**: New `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, and updates to `readme.md`.
- **APIs/Dependencies**: Relies on GitHub Actions runners (ubuntu-latest), Node.js 22, pnpm 12, and GitHub Container Registry (GHCR) with default `GITHUB_TOKEN`.
- **Breaking Changes**: None. Does not alter runtime code or developer local workflows.

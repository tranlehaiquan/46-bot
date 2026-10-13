## 1. GitHub Actions CI Workflow Setup

- [x] 1.1 Create `.github/workflows/ci.yml` with triggers for push and pull requests on the `main` branch
- [x] 1.2 Configure runner environment with Node.js 22, pnpm 12, and pnpm store caching
- [x] 1.3 Add workspace validation steps executing `pnpm typecheck`, `pnpm test`, and `pnpm build`
- [x] 1.4 Add Docker container build validation step using Buildx without pushing

## 2. GitHub Actions CD / Container Release Workflow Setup

- [x] 2.1 Create `.github/workflows/cd.yml` with triggers for release tags (`v*.*.*`), push to `main`, and manual dispatch (`workflow_dispatch`)
- [x] 2.2 Configure GitHub Container Registry (GHCR) authentication and Docker metadata tagging (`type=sha`, `type=ref`, `type=semver`)
- [x] 2.3 Configure multi-stage Docker build and push to GHCR with GitHub Actions layer caching

## 3. Documentation & Workflow Verification

- [x] 3.1 Update `readme.md` with CI/CD documentation, workflow descriptions, and GHCR container usage instructions
- [x] 3.2 Validate workflow YAML syntax against GitHub Actions schema

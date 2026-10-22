# github-actions-ci-cd Specification

## Purpose
Automated continuous integration and continuous deployment pipelines using GitHub Actions for workspace validation, testing, build, and containerization.

## Requirements

### Requirement: Continuous Integration Workflow
The repository SHALL provide a GitHub Actions CI workflow in `.github/workflows/ci.yml` triggered on pull requests and pushes to the `main` branch. The workflow SHALL validate the workspace using Node.js 24 and pnpm 12 with store caching, and execute typechecking, test suites, and build scripts.

#### Scenario: Pull request verification
- **WHEN** a pull request is created or updated targeting the `main` branch
- **THEN** GitHub Actions runs the CI workflow executing `pnpm typecheck`, `pnpm test`, and `pnpm build` against the pull request branch

#### Scenario: Pnpm dependency store caching
- **WHEN** the CI workflow executes on a GitHub runner
- **THEN** the workflow restores cached pnpm dependencies using actions cache to optimize execution time

### Requirement: Docker Container Build Validation
The CI pipeline SHALL validate that the multi-stage `Dockerfile` compiles into a valid container image without publishing to a registry.

#### Scenario: Docker build validation check
- **WHEN** CI runs for commits targeting `main` or pull requests
- **THEN** GitHub Actions executes a Docker build step using Buildx to ensure the container layers assemble without error

### Requirement: Automated Container Publishing CD Workflow
The repository SHALL provide a GitHub Actions CD workflow in `.github/workflows/cd.yml` to build and publish production container images to GitHub Container Registry (`ghcr.io`).

#### Scenario: Publishing image on release tag or manual dispatch
- **WHEN** a semantic version tag (`v*.*.*`) is pushed, changes are merged into `main`, or the workflow is triggered via `workflow_dispatch`
- **THEN** the workflow authenticates to `ghcr.io` via `GITHUB_TOKEN`, builds the Docker image, tags it with git metadata, and publishes the image

#### Scenario: Docker build layer caching
- **WHEN** the CD workflow builds the container image
- **THEN** it leverages GitHub Actions cache backend (`type=gha`) to accelerate subsequent image builds

### Requirement: CI/CD Documentation
The repository documentation in `readme.md` SHALL include information about the CI/CD pipelines, their triggers, required permissions, and guidance on pulling published container images from GHCR.

#### Scenario: Contributor checks CI/CD status and guidelines
- **WHEN** a developer views `readme.md`
- **THEN** the document details the CI checks, CD container publishing behavior, and instructions for running matching checks locally

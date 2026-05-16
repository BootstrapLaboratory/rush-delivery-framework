# Update Release Package Documentation

## Context

Rush Delivery `v0.6.6` now supports npm package release/versioning through the
standalone `release-packages` entrypoint and `.dagger/release/npm.yaml`.
Existing docs mention this feature, but they do not yet teach the full setup
with enough clarity across Docs, Quick Start, and Tutorial.

LabKit is the real reference project for this docs update:

- Repository:
  `https://github.com/BootstrapLaboratory/labkit`
- Release metadata:
  `.dagger/release/npm.yaml`
- GitHub workflow:
  `.github/workflows/package-release.yaml`
- Rush publish auth:
  `common/config/rush/.npmrc-publish`
- Rush versioning:
  `common/config/rush/version-policies.json` and `rush.json`
- Package publish shape:
  package-level `publishConfig`, `files`, package entrypoints, and normal Rush
  change-file flow.

This is docs-only work for the already released `v0.6.6` line. Do not create a
new Rush Delivery release, schema version, or versioned-doc snapshot for this
task.

## Goals

- Make package release/versioning understandable as part of the complete Rush
  Delivery CI story.
- Explain the difference between deploy release workflow and npm package
  release workflow.
- Teach package release from the GitHub Action path, raw Dagger CLI path, and
  local dry-run path.
- Add a complete tutorial path grounded in LabKit without replacing the
  existing deployment tutorial example.
- Keep documentation aligned with the current codebase and schemas.

## Current Behavior To Document

- `releasePackages` is exposed as the Dagger `release-packages` entrypoint.
- GitHub Action input `entrypoint: release-packages` calls that entrypoint.
- Package release metadata lives in `.dagger/release/npm.yaml`.
- The first strategy is `versioning.strategy: rush-change-files`.
- `versioning.target_branch` is prepared locally before live `rush publish`.
- `auth.kind: token` uses `auth.token_env`, usually `NPM_TOKEN`.
- `common/config/rush/.npmrc-publish` is required for token auth.
- `publish.provenance` defaults to `false`.
- Live package release requires Git source mode plus write credentials so Rush
  can push the generated version commit.
- `release-env` / `release-env-file` are release-scoped and separate from
  `deploy-env`.
- `release-packages` runs the shared Rush lifecycle before publishing:
  `build`, `lint`, `test`, `verify`.
- PR validation runs Rush change-file verification when release metadata exists.
- Package-only repositories do not need deploy metadata. Rush cache metadata is
  required only when a Rush cache provider such as `github` is selected.
- Provider settings may be `off` for a package-only project like LabKit, or
  `github` when the project intentionally configures GHCR-backed cache/toolchain
  metadata.

## Documentation Plan

### Phase 1: Documentation Inventory

- [x] Review the current public docs pages for stale or thin release-package
      coverage: - `README.md` - `docs/README.md` - `docs/api.md` - `docs/entrypoints.md` - `docs/github-actions.md` - `docs/metadata.md` - `docs/workflows.md` - `docs/quick-start/github-actions.md` - `docs/quick-start/ci-cli.md` - `docs/quick-start/local-run.md` - `docs/tutorial/README.md` - `docs/tutorial/09-github-actions.md` - `docs/tutorial/10-local-dry-runs.md` - `docs/tutorial/11-adapting-to-your-project.md`
- [x] Review website docs trees before adding tutorial pages: - `website-docusaurus/docs-tree.yaml` - `website/docs-tree.yaml`
- [x] Keep archived docs under `docs-versions/` unchanged.

### Phase 2: Docs And Quick Start

- [x] Update the main README package-release section so it is concise but
      complete enough for repository visitors.
- [x] Update the docs introduction so package release is a first-class guide
      topic, not only an API mention.
- [x] Expand GitHub Action docs with: - a minimal package-only workflow based on LabKit; - release env vs deploy env; - required permissions; - provider-off vs provider-backed cache/toolchain choices; - `NPM_TOKEN` and `GITHUB_TOKEN` behavior; - provenance default and when not to enable it.
- [x] Expand raw Dagger CLI docs with a complete `release-packages` command and
      a small `dagger-release.env` example.
- [x] Expand local run docs with a local `release-packages` dry-run shape and
      warnings around live local publishing.
- [x] Clarify in workflow docs that package release is currently standalone and
      does not touch deploy tags.

### Phase 3: Metadata Reference

- [x] Expand `.dagger/release/npm.yaml` documentation with every current field: - `kind` - `versioning.strategy` - `versioning.target_branch` - `auth.kind` - `auth.token_env` - `publish.registry` - `publish.tag` - `publish.access` - `publish.provenance`
- [x] Explain how Rush remains the source of truth for: - package selection; - package versions; - change files; - version policies; - changelogs; - publishable package rules.
- [x] Add LabKit-inspired examples for: - `.dagger/release/npm.yaml`; - `common/config/rush/.npmrc-publish`; - `common/config/rush/version-policies.json`; - `rush.json` `versionPolicyName`; - package-level `publishConfig` and `files`.
- [x] Mention private tooling packages and package publishability without
      overfitting to LabKit internals.

### Phase 4: Tutorial

- [x] Update tutorial introduction to mention two real examples: - the existing deployment app tutorial repository; - LabKit as the npm package release reference repository.
- [x] Add release-package tutorial chapters after the current deployment
      chapters. Proposed new chapters: - `12-npm-package-release-baseline.md` - `13-release-metadata.md` - `14-package-release-workflow.md`
- [x] Teach the package release setup in tutorial order: - Rush package publish shape; - Rush version policies; - change-file workflow; - `.npmrc-publish`; - `.dagger/release/npm.yaml`; - GitHub Action `release-packages`; - PR release-readiness validation; - local dry-run.
- [x] Update tutorial next/previous links and chapter index.
- [x] Update both website docs trees so Docusaurus and Astro expose the new
      tutorial chapters.

### Phase 5: Generated Website Inputs

- [x] Run Docusaurus docs sync after source docs change.
- [x] Run Astro docs sync after source docs change.
- [x] Do not create new `schemas/v*` directories.
- [x] Do not copy root docs into a new versioned docs directory.

### Phase 6: Verification

- [x] Run `npm run site:docusaurus:sync-docs`.
- [x] Run `npm run site:sync-docs`.
- [x] Run `npm run site:docusaurus:check`.
- [x] Run `npm run site:check`.
- [x] Run `git diff --check`.
- [x] Review the final docs diff for obsolete wording, broken relative links,
      and accidental edits under `docs-versions/`.

## Open Decisions For Approval

- Approved: add three new tutorial chapters at the end rather
  than mixing package release into the existing deployment chapters.
- Approved: use provider `off` in the minimal LabKit
  style example, then document `github` providers as optional when the project
  has provider metadata.
- Approved: `contents: write` is required for live
  package release; `packages: write` is only needed when using GHCR-backed
  provider artifacts; `id-token: write` should stay out of the default token
  publish example while provenance is disabled.

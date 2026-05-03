# Add Release Packages Stage

## Goal

Add a package release/versioning stage to Rush Delivery so the framework can
own the complete CI flow for Rush monorepos: detect, validate, build, package,
release packages, and deploy.

The public entrypoint will be named `releasePackages`. Release metadata will
live under `.dagger/release`, starting with `.dagger/release/npm.yaml`. The
metadata can include a `publish` section for the final registry upload step.

## Direction

- Keep deploy targets separate from package release metadata.
- Let Rush remain the source of truth for package selection, versioning, change
  files, and publishable package rules.
- Add package release validation to PR validation when release metadata enables
  it.
- Add `releasePackages` before composing package release behavior into the
  existing `workflow` entrypoint.
- Start with a separate package release flow, then later compose it carefully
  into `workflow` after the release behavior is proven.
- In the future composed workflow, deploy targets and release targets should
  share source acquisition, metadata validation, detection, Rush install, and
  build preparation where possible, then execute package release and deploy as
  separate branches when their dependencies allow it.
- Keep provider-off local dry-runs useful.
- Keep live package publishing unavailable from PR validation by default.

## Proposed Metadata Shape

Initial metadata target:

```text
.dagger/release/npm.yaml
```

Draft conceptual shape:

```yaml
kind: npm

versioning:
  strategy: rush-change-files
  target_branch: main

auth:
  kind: token
  token_env: NPM_TOKEN

publish:
  registry: https://registry.npmjs.org/
  tag: latest
  access: public
  provenance: true
```

The release stage should use the framework-controlled Rush workflow container by
default. That container already owns the standard Node image, Git tooling,
repository workspace, Rush install, toolchain image provider, and Rush cache
provider behavior. Release metadata should only describe release-specific
policy, authentication, and publish settings unless a future provider proves it
needs an explicit executor override.

The final schema should stay small when Rush can own behavior through existing
Rush config, such as `common/config/rush/.npmrc-publish`,
`version-policies.json`, change files, and package-level `shouldPublish`.

## Initial Implementation Decisions

- Support Rush change-file publishing first.
- Add Rush version policies as a later release strategy.
- Use token auth first with an env variable consumed by Rush/npm through
  project `.npmrc-publish` conventions.
- Treat npm trusted publishing/OIDC as a follow-up after the token flow is
  stable inside Dagger.
- Add `releaseEnvFile` to the new Dagger entrypoint instead of reusing
  `deployEnvFile`.
- Add GitHub Action inputs `release-env` and `release-env-file`. Keep
  `deploy-env` and `deploy-env-file` for deploy/workflow compatibility.
- Run the standard Rush install and lifecycle before live publishing so package
  release does not publish stale outputs.
- Keep `releasePackages` separate from `workflow` in the first implementation.
- `releasePackages` should create and push the version commit through Rush so
  it owns versioning, not only package publishing.
- Standalone `releasePackages` must not touch deploy tags.
- Later workflow composition can decide whether deploy tags point at the
  original source SHA or a generated version commit SHA.
- Token auth metadata stays simple: `auth.kind: token` and
  `auth.token_env: NPM_TOKEN`. Rush Delivery passes the configured env into the
  release command, while the project `.npmrc-publish` decides exactly how npm
  consumes it.

## Open Design Questions

- None for the first implementation slice.

## Checklist

- [ ] Freeze current docs for the latest released version before editing root
      docs for this release line.
- [ ] Finalize the release metadata contract and exact JSON schema shape.
- [ ] Add release metadata parser, model types, and schema validation.
- [ ] Extend metadata contract validation for `.dagger/release/npm.yaml`.
- [ ] Add PR validation behavior for release readiness, such as Rush change
      file verification when configured.
- [ ] Add the public `releasePackages` Dagger entrypoint.
- [ ] Implement dry-run behavior that prints planned versioning/publish actions
      without pushing commits, tags, or packages.
- [ ] Implement live npm publish flow with explicit auth handling and scoped
      runtime environment.
- [ ] Add GitHub Action wrapper support for `entrypoint: releasePackages`.
- [ ] Add tests for parser/schema validation, action argument generation,
      dry-run behavior, auth validation, and PR safety behavior.
- [ ] Update current schemas and create a new versioned schema directory for
      the release.
- [ ] Update README, API docs, metadata docs, workflow docs, GitHub Action docs,
      tutorial docs, and website examples.
- [ ] Run relevant verification.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run site:docusaurus:check`
- `npm run site:check`
- `git diff --check`

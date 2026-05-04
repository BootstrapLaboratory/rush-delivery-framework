# Fix Release Packages Scoped Validation

## Context

`release-packages` fails for package-only repositories that correctly provide
`.dagger/release/npm.yaml` and `common/config/rush/.npmrc-publish`, but do not
use deploy metadata or Rush install cache metadata.

The observed Labkit failure shows the release entrypoint currently validates the
full deploy/workflow metadata contract and reads Rush cache metadata even when
`rush-cache-provider=off`.

## Plan

- [x] Add scoped metadata contract validation for package release metadata.
- [x] Make Rush cache provider metadata optional when the provider is `off`.
- [x] Update `releasePackages` to use the release-scoped contract.
- [x] Add regression tests for release-only repositories and provider-off cache behavior.
- [x] Update docs/version references for patch release `v0.6.1`.
- [x] Run focused and full verification.

## Release Guidance

Patch release: `v0.6.1`.

Reason: the public API from `v0.6.0` remains valid; this is an implementation
fix that removes unintended metadata requirements for the new release entrypoint.

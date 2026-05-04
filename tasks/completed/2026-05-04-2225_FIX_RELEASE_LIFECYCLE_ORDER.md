# Fix Release Lifecycle Order

## Context

Labkit package release with Rush Delivery `v0.6.1` reaches the release
lifecycle, but fails during `rush verify` because workspace dependency outputs
have not been built yet.

The current Rush lifecycle order is:

```text
verify -> lint -> test -> build
```

For package release workflows, build needs to happen before verify/test so
packages that import sibling workspace packages can resolve built outputs.

## Plan

- [x] Change the shared Rush lifecycle order to build before checks.
- [x] Update tests that assert lifecycle command order.
- [x] Update current docs/examples for patch release `v0.6.2`.
- [x] Snapshot `v0.6.1` docs if the tag is available.
- [x] Run focused and full verification.

## Release Guidance

Patch release: `v0.6.2`.

Reason: public API stays unchanged; this fixes release lifecycle execution
order for repositories whose verification depends on built workspace packages.

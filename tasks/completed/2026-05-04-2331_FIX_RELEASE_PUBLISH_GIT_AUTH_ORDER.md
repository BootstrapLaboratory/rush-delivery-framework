# Fix Release Publish Git Auth Order

## Context

Rush Delivery `v0.6.3` avoids Rush-reserved internal env variable names, so
`rush publish` now reaches the versioning step. The live `release-packages` run
still fails because Rush itself pushes a temporary publish branch during
`rush publish --apply --publish`, before Rush Delivery configures authenticated
Git push access.

## Goal

Patch release: `v0.6.4`.

Configure authenticated Git remote access before `rush publish` starts, while
keeping internal environment variables outside the reserved `RUSH_*` namespace.

## Checklist

- [x] Confirm current release package auth flow and tests.
- [x] Move Git push auth setup before the `rush publish` invocation.
- [x] Keep token-bearing variables using the `RD_GIT_*` namespace.
- [x] Add or update regression coverage for the publish auth ordering.
- [x] Update current docs/examples for patch release `v0.6.4`.
- [x] Archive `v0.6.3` docs and snapshot schemas for `v0.6.4`.
- [x] Run unit, typecheck, site, and diff checks.
- [x] Move this task file to `tasks/completed` after verification.

# Fix Release Git Auth Env

## Context

Rush Delivery `v0.6.2` now reaches the package publish step, but `rush publish`
fails because internal Git push auth variables use the `RUSH_` prefix.

Rush treats unknown `RUSH_*` environment variables as configuration mistakes and
rejects them before publishing:

```text
RUSH_DELIVERY_GIT_USERNAME
RUSH_DELIVERY_GIT_REPOSITORY_URL
RUSH_DELIVERY_GIT_TOKEN
```

## Plan

- [x] Split Git author identity setup from Git push token setup.
- [x] Ensure `rush publish` does not receive internal `RUSH_*` variables.
- [x] Add regression coverage for the release auth environment contract.
- [x] Update current docs/examples for patch release `v0.6.3`.
- [x] Snapshot `v0.6.2` docs if the tag is available.
- [x] Run focused and full verification.

## Release Guidance

Patch release: `v0.6.3`.

Reason: public API stays unchanged; this fixes package release publishing when
Rush rejects unknown `RUSH_*` environment variables.

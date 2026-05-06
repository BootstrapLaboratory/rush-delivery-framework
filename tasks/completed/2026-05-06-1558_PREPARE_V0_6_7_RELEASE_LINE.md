# Prepare v0.6.7 Release Line

## Context

Rush Delivery `v0.6.7` is a release-line update for Daggerverse module
metadata and Dagger engine `v0.20.7` alignment. Schema behavior is unchanged,
but versioned schema URLs should exist for `v0.6.7` so documentation and
release references stay aligned for users.

## Checklist

- [x] Archive `v0.6.6` Docusaurus docs under `docs-versions`.
- [x] Add `schemas/v0.6.7` snapshots with matching `$id` URLs.
- [x] Update current website/docs version labels to `v0.6.7`.
- [x] Document the schema snapshot exception for release-line alignment.
- [x] Run release-prep checks.

# Prepare Release Target Branch

## Context

`release-packages` uses Dagger Git source mode at a specific commit. That
workspace has Git metadata, but it may not have a local branch named like the
release `versioning.target_branch`. Rush later runs `git checkout <target>`
during `rush publish --target-branch <target>`, so the local branch must exist.

## Goal

Prepare patch release `v0.6.6` so live npm package release creates/tracks the
local target branch before invoking `rush publish`.

## Checklist

- [x] Add a live release preparation step after Git push auth and before Rush publish.
- [x] Ensure the target branch is passed safely and not shell-interpolated.
- [x] Add tests for release execution plan order.
- [x] Update docs, README, website examples, and schema snapshots to `v0.6.6`.
- [x] Run relevant tests and site checks.
- [x] Move this task file to `tasks/completed`.

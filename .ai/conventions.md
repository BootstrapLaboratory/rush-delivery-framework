# AI Conventions

Use this file when modifying the Dagger framework or helping future agents
understand where a change belongs.

## Public Contract First

Start from the public contract:

- Dagger entrypoint parameters.
- `.dagger/` metadata schemas.
- Workflow stage inputs and outputs.
- Package release metadata under `.dagger/release`.
- Provider adapter boundaries.

Avoid changing source internals before checking whether the same outcome belongs
in metadata.

## Prefer Metadata Over Switches

Do not add target-specific `switch` or `if target === ...` logic when metadata
can describe the behavior. Target names should come from metadata and Rush, not
from hardcoded source lists.

## Keep Providers Optional

Provider `off` should keep working for local development. Provider-specific
credentials must be explicit and must not be required for dry-run paths unless a
selected target truly needs them.

## Dagger Engine Version Updates

When changing [`../dagger.json`](../dagger.json) `engineVersion`, keep every
developer runtime on the same Dagger version before validating the module.

- Update the local Dagger CLI in the current environment to the matching
  version. A module with `engineVersion: "vX.Y.Z"` is not validly tested by an
  older `dagger` binary.
- Update [`../.devcontainer/Dockerfile`](../.devcontainer/Dockerfile)
  `ARG DAGGER_VERSION=` to the same version without the leading `v`, matching
  the existing Dockerfile release URL format.
- Confirm with `dagger version` before running Dagger checks.
- Run at least a module load/call check and `dagger call self-check` after the
  CLI and `engineVersion` agree.

## Preserve Stage Boundaries

Detect decides what should run. Build creates compiled outputs. Package
materializes deploy artifacts. Package release performs registry release and
versioning actions. Deploy performs live application release actions.

If a change mixes these responsibilities, pause and create a task/design note
before implementing it.

## Documentation Style

Keep Dagger documentation high-level and API-oriented. Link schemas for exact
field rules rather than duplicating every validation detail.

Use relative links. Remove obsolete descriptions instead of adding historical
warnings about old behavior.

Before updating root [`../docs`](../docs) for a new release line, freeze the
currently released docs first. The snapshot directory must use the latest
released tag version, for example `docs-versions/versioned_docs/version-v0.5.0/`.
Only after the released docs are captured should root `docs/` be edited for the
next version.

After completing any repository file changes, include two semantic commit
message suggestions: one short commit subject and one more detailed commit
message with a body.

## Schema Versioning

Root schemas under [`../schemas`](../schemas) track the current release.

Versioned schema directories such as `schemas/v0.5.0/` are immutable release
snapshots. Never modify an already released version directory; create a new
version directory instead.

When schema behavior changes, add a new `schemas/vX.Y.Z/` directory, update the
root schemas to the current release shape, and update docs, tutorials, and
website examples to reference the new version.

When a release line needs exact version alignment for published docs or editor
URLs, create a `schemas/vX.Y.Z/` snapshot even if schema behavior is unchanged.
In that case, copy the current root schemas and update only their `$id` values
to the versioned `/schemas/vX.Y.Z/...` URLs.

Exact published schema URLs are the recommended editor contract for downstream
projects, for example
`https://bootstraplaboratory.github.io/rush-delivery/schemas/v0.5.0/deploy-target.schema.json`.

## Task Files

Read [`rules/TasksFiles.md`](rules/TasksFiles.md) before creating or modifying
task files.

Create a task file before implementation when the work is more than a small
local fix, needs multiple design decisions, or changes public project
contracts. Task files are required by default for:

- module public API changes
- metadata or JSON schema changes
- behavior changes across `workflow`, `validate`, or `deploy`
- combined docs-and-implementation changes
- anything that needs version guidance

When a task checklist is complete, move the file into the matching `completed`
directory. Do not modify completed task files.

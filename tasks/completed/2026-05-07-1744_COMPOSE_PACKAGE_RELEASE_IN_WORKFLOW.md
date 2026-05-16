# Compose Package Release In Workflow

## Context

Rush Delivery is currently at `v0.6.7`. The package release path works through
the standalone `release-packages` entrypoint. The default `workflow` entrypoint
still only owns deploy release composition:

1. acquire source;
2. validate metadata;
3. detect deploy targets;
4. prepare Rush toolchain/cache;
5. build selected deploy targets;
6. package deploy artifacts;
7. deploy selected targets and update deploy tags.

`release-packages` currently reacquires source and repeats its own Rush setup:

1. acquire source;
2. validate release-scoped metadata;
3. prepare Rush toolchain/cache;
4. run all-project Rush lifecycle: `build`, `lint`, `test`, `verify`;
5. configure npm and Git push auth;
6. prepare `versioning.target_branch`;
7. run `rush publish`.

The next feature is to let one trusted `workflow` run both deploy targets and
release targets. Package release should become a first-class release target in
the main workflow while keeping the standalone `release-packages` entrypoint
for local debugging, custom CI, and package-only projects.

## Design Goals

- Keep `release-packages` working as a standalone entrypoint.
- Add package release composition to `workflow` without surprising existing
  deploy-only users.
- Let a project have deploy targets and release targets in one run.
- Share source acquisition, metadata validation, provider resolution, Rush
  toolchain image, Rush install cache, and build lifecycle where possible.
- Run deploy side effects and package-release side effects in parallel when
  their shared prerequisites have succeeded.
- Keep PR validation safe: release readiness verification remains read-only and
  no package publish happens from PRs.
- Keep deploy tags pointing at the original source SHA unless a future feature
  intentionally rebuilds/deploys from the generated version commit.
- Keep provider `off` working for local and package-only flows.
- Make failure reporting explicit and wait for all started side-effect branches
  before returning.

## Proposed Public Contract

### Dagger `workflow`

Add optional inputs:

```ts
releaseTargetsJson: string = "[]"
workflowEnvFile?: File
releaseEnvFile?: File
```

The first supported release target is `npm`, selected explicitly:

```sh
--release-targets-json='["npm"]'
--workflow-env-file="$WORKFLOW_ENV_FILE"
--release-env-file="$RELEASE_ENV_FILE"
```

Default `releaseTargetsJson: "[]"` preserves current deploy-only workflow
behavior. This avoids surprising existing projects that already have
`.dagger/release/npm.yaml` but still run package release from a separate
workflow.

### GitHub Action

Add input:

```yaml
release-targets-json:
  default: "[]"
workflow-env:
  default: ""
workflow-env-file:
  default: ""
```

For `entrypoint: workflow`, pass:

- `--release-targets-json=...`
- `--workflow-env-file=...` when workflow env is provided.
- `--release-env-file=...` when release env is provided.

Keep existing `deploy-env`, `deploy-env-file`, `release-env`, and
`release-env-file` inputs. `workflow-env` is the shared base for the whole
workflow; deploy and release env inputs are optional overlays for teams that
want an extra CI-level split.

Recommended combined workflow shape:

```yaml
permissions:
  contents: write
  id-token: write
  packages: write

steps:
  - uses: BootstrapLaboratory/rush-delivery@vNEXT
    with:
      dry-run: "false"
      release-targets-json: '["npm"]'
      toolchain-image-provider: github
      rush-cache-provider: github
      workflow-env: |
        GITHUB_TOKEN=${{ github.token }}
      deploy-env: |
        GCP_PROJECT_ID=${{ vars.GCP_PROJECT_ID }}
      release-env: |
        NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

`packages: write` is required only when GHCR-backed toolchain images or Rush
cache are enabled. `contents: write` is required for package release because
Rush pushes the generated version commit.

## Proposed Internal Flow

### Shared Setup

`workflow` should parse separate env files:

- `workflowHostEnv`: shared workflow inputs such as source/provider auth and
  values intentionally made available for metadata-scoped use by any stage.
- `deployHostEnv`: build/deploy inputs and deploy provider credentials.
- `releaseHostEnv`: package release credentials such as `NPM_TOKEN`.

`workflowHostEnv` is the base env. Deploy and release env files are overlays
with a narrow collision rule:

- identical duplicate values are allowed;
- a key from `deployHostEnv` may not redefine a different value from
  `workflowHostEnv`;
- a key from `releaseHostEnv` may not redefine a different value from
  `workflowHostEnv`;
- `deployHostEnv` and `releaseHostEnv` are not checked against each other;
- source/provider auth uses `workflowHostEnv` plus the relevant stage overlay
  when needed;
- build/deploy stages receive `workflowHostEnv` plus `deployHostEnv`, then
  metadata decides which values are actually passed into containers;
- package release receives `workflowHostEnv` plus `releaseHostEnv`, then
  release metadata decides which values are actually passed into containers.

This preserves the simple public model: one workflow-level env plus optional
deploy/release overlays. The metadata under `.dagger` remains the authority
for which stage receives which variable.

### Planning

Extend the CI plan or add a workflow-level plan with:

```ts
release_targets: string[]
```

For this first composition:

- supported release target: `npm`;
- selected release targets come from `releaseTargetsJson`;
- selected release targets must exist in metadata;
- empty `releaseTargetsJson` means no package release from `workflow`.

Future auto-detection can be added later after the explicit flow is proven.

### Build Strategy

Use the most efficient safe lifecycle:

- If `npm` is not selected, keep current deploy build behavior:
  targeted Rush lifecycle for selected deploy targets.
- If `npm` is selected, run the all-project Rush lifecycle once:
  `build`, `lint`, `test`, `verify`.
- Package selected deploy targets from the resulting built container.
- Run npm package release from the same built container.

This avoids running two separate Rush installs and avoids duplicating the
build/lint/test/verify lifecycle when package release and deploy happen in the
same workflow.

### Side Effects

After shared build/package prerequisites succeed:

- deploy branch deploys selected deploy targets and updates deploy tags to the
  original `gitSha`;
- package release branch runs `rush publish` and pushes the generated version
  commit to `versioning.target_branch`;
- both branches can run concurrently when both are selected.

Use `Promise.allSettled` or an equivalent helper so Rush Delivery waits for all
started side-effect branches and reports every failure. Do not return early
while a started deploy or publish branch may still be running.

## Important Semantics

- Deploy tags continue to point at the original source SHA for this feature.
- Package release version commits are separate from deploy tag identity.
- The combined workflow is not transactional. If deploy succeeds and npm
  publish fails, or npm publish succeeds and deploy fails, external side effects
  may already exist. The implementation should make this visible in logs and
  final error messages.
- If a project requires strict ordering between deploy and package release, it
  can keep separate workflows for now. A future metadata dependency model can
  express ordering if needed.
- PR validation remains unchanged except docs should explain that
  `.dagger/release/npm.yaml` triggers `rush change --verify`.

## Version Guidance

This is a public behavior and API expansion for `workflow` and the GitHub
Action. Plan it as a new minor release after `v0.6.7`, likely `v0.7.0`.

Before editing root docs for `v0.7.0`, freeze the current `v0.6.7` docs and
schemas according to the versioned docs/schema convention.

## Implementation Phases

### Phase 1: Planning And Types

- [x] Add or extend workflow planning types to include `release_targets`.
- [x] Add release target selection validation against release metadata.
- [x] Keep unsupported release targets failing clearly.
- [x] Add tests for release target selection: - no selected targets by default; - `["npm"]` selected when metadata exists; - unknown target rejected; - duplicate release targets normalized.

### Phase 2: Env Boundaries

- [x] Add safe env merge helper for workflow source/provider env.
- [x] Parse `workflowEnvFile`, `deployEnvFile`, and `releaseEnvFile`
      separately in `workflow`.
- [x] Fail when `deployEnvFile` redefines a different value from
      `workflowEnvFile`.
- [x] Fail when `releaseEnvFile` redefines a different value from
      `workflowEnvFile`.
- [x] Do not fail on `deployEnvFile`/`releaseEnvFile` duplicate keys unless
      one of them conflicts with `workflowEnvFile`.
- [x] Keep build/deploy env scoped by deploy metadata.
- [x] Keep npm release env scoped by release metadata.
- [x] Add collision tests for workflow-vs-overlay duplicate env keys.

### Phase 3: Shared Rush Lifecycle

- [x] Refactor deploy build/package runner so it can accept a prebuilt Rush
      container and a build mode.
- [x] Keep current targeted deploy lifecycle when no release target is selected.
- [x] Run all-project lifecycle once when `npm` is selected.
- [x] Package deploy artifacts from the shared built container.
- [x] Reuse release command planning for the npm publish branch.
- [x] Keep standalone `release-packages` using the same lower-level helpers.

### Phase 4: Parallel Side Effects

- [x] Add workflow orchestration that starts deploy and package release branches
      after shared prerequisites succeed.
- [x] Use all-settled failure aggregation so all started branches are awaited.
- [x] Return a combined workflow result with deploy and package-release
      summaries.
- [x] Preserve old deploy-only output shape if no release targets are selected,
      or intentionally document the new combined output shape for `v0.7.0`.
- [x] Add tests for deploy-only, release-only, and deploy-plus-release plans.

### Phase 5: Public API And GitHub Action

- [x] Add `workflow` Dagger args: - `releaseTargetsJson` - `workflowEnvFile` - `releaseEnvFile`
- [x] Add GitHub Action inputs: - `release-targets-json` - `workflow-env` - `workflow-env-file`
- [x] Make action `workflow` pass workflow/release env files when needed.
- [x] Keep standalone `entrypoint: release-packages` behavior unchanged.
- [x] Add action tests for combined workflow argument generation.

### Phase 6: Docs And Versioning

- [x] Snapshot current `v0.6.7` docs before editing root docs.
- [x] Add `schemas/v0.7.0` snapshot if docs/examples reference exact schema
      URLs, even if schema shape does not change.
- [x] Update README, Quick Start, GitHub Action docs, Workflow docs, API docs,
      and tutorial package-release chapters.
- [x] Replace guidance that package release must be a separate workflow with
      guidance that it can be standalone or composed into `workflow`.
- [x] Document production recommendations: - explicit `release-targets-json`; - `release-env` separate from `deploy-env`; - deploy tags stay on original source SHA; - side effects are concurrent but not transactional.

### Phase 7: Verification

- [x] Run unit tests.
- [x] Run typecheck.
- [x] Run Docusaurus and Astro docs checks.
- [x] Run `git diff --check`.
- [x] If Dagger CLI and `dagger.json` versions match, run a module self-check
      or at least a module load/call smoke test.

## Open Decisions

Resolved before implementation:

- Keep deploy-only JSON output unchanged when `releaseTargetsJson` is empty.
  Return a combined result only when release targets are selected.
- Keep release target selection explicit for `v0.7.0`.
- Do not add side-effect ordering options in `v0.7.0`. Deploy and package
  release side effects start after shared prerequisites and run concurrently.
  Projects needing strict ordering can keep separate workflows until dependency
  metadata exists.

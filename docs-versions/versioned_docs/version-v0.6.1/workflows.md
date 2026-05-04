---
id: "workflows"
title: "Workflow Guide"
sidebar_label: "Workflow Guide"
---

## Local Framework Check

Use `self-check` before changing metadata, schemas, or Dagger source:

```sh
dagger call self-check
```

## Local Provider-Off Dry Run

This exercises the full release composition without GHCR, cloud credentials, or
a Docker socket against local unpushed changes:

```sh
RUSH_DELIVERY_MODULE=github.com/OWNER/rush-delivery@VERSION

dagger -m "$RUSH_DELIVERY_MODULE" call workflow \
  --repo=. \
  --git-sha="$(git rev-parse HEAD)" \
  --event-name=workflow_call \
  --force-targets-json='["server","webapp"]' \
  --dry-run=true \
  --toolchain-image-provider=off \
  --rush-cache-provider=off \
  --source-mode=local_copy
```

Dry-runs use package and deploy target `dry_run_defaults` for allowed build and
runtime environment values.

## CI Release Workflow

A CI provider should keep provider-specific setup small, then call the Dagger
workflow.

For GitHub Actions, prefer the repository action wrapper:

```yaml
- name: Rush Delivery
  uses: BootstrapLaboratory/rush-delivery@v0.6.1
  with:
    force-targets-json: ${{ inputs.force_targets_json || '[]' }}
    environment: prod
    dry-run: "false"
    runtime-file-map: |
      ${{ steps.auth.outputs.credentials_file_path }}=>gcp-credentials.json
    deploy-env: |
      GCP_PROJECT_ID=${{ vars.GCP_PROJECT_ID }}
```

See [GitHub Action usage](../github-action) for the complete production shape.

For pull-request validation, use the same action with the `validate`
entrypoint. The action defaults provider policies to `pull-or-build` for
validation. If npm release metadata is configured, validation also verifies Rush
change files:

```yaml
- name: Rush Delivery validation
  uses: BootstrapLaboratory/rush-delivery@v0.6.1
  with:
    entrypoint: validate
    toolchain-image-provider: github
    rush-cache-provider: github
```

For npm package release, use the standalone `release-packages` entrypoint while
the release flow is kept separate from deploy workflow composition:

```yaml
- name: Rush Delivery package release
  uses: BootstrapLaboratory/rush-delivery@v0.6.1
  with:
    entrypoint: release-packages
    dry-run: "false"
    toolchain-image-provider: github
    rush-cache-provider: github
    release-env: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

The action appends `GITHUB_TOKEN` to the release env file by default, so live
package release can push the Rush-generated version commit back to the target
branch. The workflow job needs `contents: write`; it needs `packages: read` or
`packages: write` only when using provider-backed Rush cache or toolchain
images.

For a raw Dagger command this means:

- Install the Dagger CLI.
- Authenticate to external providers when live deploy targets need it.
- Write a deploy environment file with provider secrets, build-time values, and
  deploy configuration.
- Copy deploy-only credential files into a runtime files directory when targets
  mount files.
- Call `dagger -m "$RUSH_DELIVERY_MODULE" call workflow`.

The CI provider should pass source coordinates rather than doing release logic
itself. Dagger owns source acquisition, deploy tag fetching, detection, build,
package, deployment, and deploy tag updates.

## Recommended CI Shape

```sh
mkdir -p "$RUNNER_TEMP/rush-delivery-runtime-files"
cp "$GCP_CREDENTIALS_FILE" \
  "$RUNNER_TEMP/rush-delivery-runtime-files/gcp-credentials.json"

dagger -m "$RUSH_DELIVERY_MODULE" call workflow \
  --git-sha="$GITHUB_SHA" \
  --event-name="$GITHUB_EVENT_NAME" \
  --force-targets-json="$FORCE_TARGETS_JSON" \
  --pr-base-sha="$PR_BASE_SHA" \
  --deploy-tag-prefix="$DEPLOY_TAG_PREFIX" \
  --artifact-prefix="$DEPLOY_ARTIFACT_PREFIX" \
  --environment=prod \
  --dry-run=false \
  --deploy-env-file="$DEPLOY_ENV_FILE" \
  --host-workspace-dir="$GITHUB_WORKSPACE" \
  --toolchain-image-provider="$TOOLCHAIN_IMAGE_PROVIDER" \
  --toolchain-image-policy="$TOOLCHAIN_IMAGE_POLICY" \
  --rush-cache-provider="$RUSH_CACHE_PROVIDER" \
  --rush-cache-policy="$RUSH_CACHE_POLICY" \
  --source-mode=git \
  --source-repository-url="$SOURCE_REPOSITORY_URL" \
  --source-ref="$SOURCE_REF" \
  --source-auth-token-env=GITHUB_TOKEN \
  --runtime-files="$RUNNER_TEMP/rush-delivery-runtime-files" \
  --docker-socket=/var/run/docker.sock
```

## Split Stage Workflows

The stage-level APIs exist for CI systems that need separate jobs. Prefer the
single `workflow` entrypoint unless there is a provider-specific reason to split
handoff between detect, build, package, and deploy.

When splitting stages, persist the CI plan and package manifest as files rather
than re-encoding stage state in CI-specific outputs.

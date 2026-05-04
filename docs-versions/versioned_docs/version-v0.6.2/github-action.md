---
id: "github-action"
title: "GitHub Action"
sidebar_label: "GitHub Action"
description: "Use Rush Delivery directly from GitHub Actions."
---

Rush Delivery can be used as a GitHub Action or as a raw Dagger module. The
GitHub Action is a thin adapter over the module's Dagger functions, so release
and validation behavior stay identical between action and raw CLI usage.

## Pull Request Validation

Use `entrypoint: validate` for PR CI. The action defaults to Git source mode,
uses the current GitHub repository and ref, writes `GITHUB_TOKEN` into the
deploy env file for source authentication, and forwards the pull request base
SHA from the GitHub event. When `entrypoint: validate` is selected, provider
policies default to `pull-or-build`, so existing toolchain images and Rush cache
can be reused without granting publish access. If npm release metadata exists,
validation also runs Rush change-file verification.

```yaml
name: ci-validate

on:
  pull_request:

permissions:
  contents: read
  packages: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: BootstrapLaboratory/rush-delivery@v0.6.2
        with:
          entrypoint: validate
          toolchain-image-provider: github
          rush-cache-provider: github
```

`pull-or-build` pulls the provider artifact when it exists. If it is missing,
validation builds locally inside the current Dagger run and does not publish to
GHCR.

If selected package targets declare build-time `pass_env` or `map_env`, include
those source values in `deploy-env` for PR validation too. Keep PR values
read-only and avoid granting publish credentials.

To validate unpushed local-copy source from a checked-out runner workspace,
override the source mode and pass `repo`:

```yaml
steps:
  - uses: actions/checkout@v5
    with:
      fetch-depth: 0

  - uses: BootstrapLaboratory/rush-delivery@v0.6.2
    with:
      entrypoint: validate
      repo: .
      source-mode: local_copy
```

## Release Workflow

Provider authentication stays in the caller workflow. Pass any generated files
to Rush Delivery through `runtime-file-map`, and pass build or deploy
environment values through `deploy-env`.

```yaml
steps:
  - id: auth
    name: Authenticate to Google Cloud
    if: inputs.force_targets_json != '["webapp"]'
    uses: google-github-actions/auth@v3
    with:
      workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
      service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

  - name: Rush Delivery
    uses: BootstrapLaboratory/rush-delivery@v0.6.2
    with:
      force-targets-json: ${{ inputs.force_targets_json || '[]' }}
      deploy-tag-prefix: ${{ env.DEPLOY_TAG_PREFIX }}
      artifact-prefix: ${{ env.DEPLOY_ARTIFACT_PREFIX }}
      environment: prod
      dry-run: "false"
      toolchain-image-provider: ${{ env.TOOLCHAIN_IMAGE_PROVIDER }}
      toolchain-image-policy: ${{ env.TOOLCHAIN_IMAGE_POLICY }}
      rush-cache-provider: ${{ env.RUSH_CACHE_PROVIDER }}
      rush-cache-policy: ${{ env.RUSH_CACHE_POLICY }}
      runtime-file-map: |
        ${{ steps.auth.outputs.credentials_file_path }}=>gcp-credentials.json
      deploy-env: |
        GCP_PROJECT_ID=${{ vars.GCP_PROJECT_ID }}
        GCP_ARTIFACT_REGISTRY_REPOSITORY=${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}
        CLOUD_RUN_SERVICE=${{ vars.CLOUD_RUN_SERVICE }}
        CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${{ vars.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT }}
        CLOUD_RUN_CORS_ORIGIN=${{ vars.CLOUD_RUN_CORS_ORIGIN }}
        CLOUD_RUN_REGION=${{ env.CLOUD_RUN_REGION }}
        CLOUDFLARE_API_TOKEN=${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID=${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        CLOUDFLARE_PAGES_PROJECT_NAME=${{ vars.CLOUDFLARE_PAGES_PROJECT_NAME }}
        WEBAPP_VITE_GRAPHQL_HTTP=${{ vars.WEBAPP_VITE_GRAPHQL_HTTP }}
        WEBAPP_VITE_GRAPHQL_WS=${{ vars.WEBAPP_VITE_GRAPHQL_WS }}
        WEBAPP_URL=https://${{ vars.CLOUDFLARE_PAGES_PROJECT_NAME }}.pages.dev
```

The action appends `GITHUB_ACTOR`, `GITHUB_REPOSITORY`, `GITHUB_API_URL`, and
`GITHUB_TOKEN` to generated env files by default. Set
`include-github-env: "false"` if you want to provide those values yourself.

## Package Release

Use `entrypoint: release-packages` when a workflow should publish npm packages
from `.dagger/release/npm.yaml`. Keep npm credentials in `release-env`, not
`deploy-env`.

```yaml
name: package-release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  packages: write

jobs:
  release-packages:
    runs-on: ubuntu-latest
    steps:
      - uses: BootstrapLaboratory/rush-delivery@v0.6.2
        with:
          entrypoint: release-packages
          dry-run: "false"
          toolchain-image-provider: github
          rush-cache-provider: github
          release-env: |
            NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

The package release entrypoint uses Git source mode by default, runs the shared
Rush lifecycle in build-first order (`build`, `lint`, `test`, `verify`), lets
Rush apply change files, publishes packages, and pushes the generated version
commit to the metadata `target_branch`.

For package-only repositories that do not use Rush Delivery cache metadata, set
`rush-cache-provider: off` or omit the input. `.dagger/rush-cache/providers.yaml`
is only required when `rush-cache-provider: github` is selected.

## Runtime Files

`runtime-file-map` is a multiline list of `SOURCE=>DEST` entries. `SOURCE` is a
file path on the GitHub runner, and `DEST` is a safe relative path inside the
runtime files bundle passed to Dagger.

Empty `SOURCE` values are skipped. This supports conditional provider auth
steps where an output is intentionally blank for some target selections.

```yaml
runtime-file-map: |
  ${{ steps.auth.outputs.credentials_file_path }}=>gcp-credentials.json
  ${{ steps.signing.outputs.key_path }}=>signing/key.json
```

Deploy target metadata can mount those files with:

```yaml
runtime:
  env:
    GOOGLE_APPLICATION_CREDENTIALS: /runtime-files/gcp-credentials.json
  file_mounts:
    - source: gcp-credentials.json
```

## Raw Dagger Mode

The action mode does not replace raw Dagger usage. Local runs, other CI
providers, and lower-level debugging can still call the module directly:

```sh
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.6.2 call workflow \
  --git-sha="$GITHUB_SHA" \
  --source-mode=git \
  --source-repository-url="$SOURCE_REPOSITORY_URL" \
  --source-ref="$SOURCE_REF" \
  --source-auth-token-env=GITHUB_TOKEN
```

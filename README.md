# Rush Delivery

Rush Delivery is a Dagger module and GitHub Action for Rush-based release
workflows. It owns the release path from source acquisition through detect,
validate, build, package, package release, and deploy while keeping
project-specific behavior in metadata.

Use it when a Rush monorepo needs one repeatable release path across CI and
local debugging:

- detect affected deploy targets from repository metadata;
- run validation and build work through Dagger with explicit metadata-selected
  environment;
- package deploy artifacts;
- release npm packages through Rush change files;
- mount deploy-only runtime files such as cloud credentials;
- publish deploy tags and provider-backed cache or toolchain images.

## GitHub Actions

For GitHub CI, use the action. It prepares the Dagger CLI, deploy environment
file, runtime files bundle, Git source coordinates, and source auth token
plumbing for you.

Pin the action to a released tag and advance that tag intentionally when you
want new behavior.

### Pull Request Validation

Use the `validate` entrypoint for PR CI. The action clones the pull request
source inside Dagger, so normal validation does not need `actions/checkout`.
Provider-backed toolchain images and Rush cache stay read-only in PRs by
default: `validate` uses `pull-or-build`, which pulls an existing artifact when
available and builds locally on miss without publishing to GHCR.

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
      - uses: BootstrapLaboratory/rush-delivery@v0.6.7
        with:
          entrypoint: validate
          toolchain-image-provider: github
          rush-cache-provider: github
```

### Release Workflow

Use the default `workflow` entrypoint for release CI.

```yaml
permissions:
  contents: write
  id-token: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - id: auth
        name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - name: Rush Delivery
        uses: BootstrapLaboratory/rush-delivery@v0.6.7
        with:
          dry-run: "false"
          environment: prod
          deploy-tag-prefix: deploy/prod
          artifact-prefix: deploy-target
          toolchain-image-provider: github
          toolchain-image-policy: lazy
          rush-cache-provider: github
          rush-cache-policy: lazy
          runtime-file-map: |
            ${{ steps.auth.outputs.credentials_file_path }}=>gcp-credentials.json
          deploy-env: |
            GCP_PROJECT_ID=${{ vars.GCP_PROJECT_ID }}
            GCP_ARTIFACT_REGISTRY_REPOSITORY=${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}
```

See [GitHub Actions quick start](docs/quick-start/github-actions.md) and
[GitHub Action usage](docs/github-actions.md) for the full production shape.

### Package Release

Use the `release-packages` entrypoint for npm package release/versioning. It
uses `.dagger/release/npm.yaml`, runs the shared Rush lifecycle in build-first
order (`build`, `lint`, `test`, `verify`), lets Rush apply change files,
publishes packages, and pushes the generated version commit. Package-only
repositories do not need deploy metadata for this entrypoint.
For live releases, Rush Delivery prepares the metadata `target_branch` as a
local branch before invoking `rush publish`, so Rush can merge the generated
version commit back to the remote branch.

The project still owns Rush package publishing policy: package names, version
policies, change files, `publishConfig`, package `files`, and
`common/config/rush/.npmrc-publish`. Rush Delivery owns the isolated CI runtime,
source acquisition, build-before-publish lifecycle, release credentials, and
Git push plumbing.

NPM provenance is disabled by default. Keep `publish.provenance` omitted unless
your release runtime is explicitly wired for npm's supported provenance
provider detection from inside Dagger.

```yaml
permissions:
  contents: read

jobs:
  release-packages:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: BootstrapLaboratory/rush-delivery@v0.6.7
        with:
          entrypoint: release-packages
          dry-run: "false"
          toolchain-image-provider: off
          rush-cache-provider: off
          release-env: |
            NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

Use `packages: write` and provider `github` only when the project also
configures GHCR-backed toolchain images or Rush install cache.

## CI Using Command Line

Use the raw Dagger command when your CI provider is not GitHub Actions, or when
you want to own all surrounding shell steps yourself.

This mode clones the target repository inside Dagger, so the CI runner does not
need to mount the repository into the module.

```sh
RUSH_DELIVERY_MODULE=github.com/BootstrapLaboratory/rush-delivery@v0.6.7
RUNTIME_FILES_DIR="${RUNNER_TEMP}/rush-delivery-runtime-files"
DEPLOY_ENV_FILE="${RUNNER_TEMP}/dagger-deploy.env"
SOURCE_REPOSITORY_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}.git"

mkdir -p "${RUNTIME_FILES_DIR}"
cp "${GCP_CREDENTIALS_FILE}" "${RUNTIME_FILES_DIR}/gcp-credentials.json"

cat > "${DEPLOY_ENV_FILE}" <<EOF
GCP_PROJECT_ID=${GCP_PROJECT_ID}
GITHUB_ACTOR=${GITHUB_ACTOR}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY}
GITHUB_TOKEN=${GITHUB_TOKEN}
EOF

dagger -m "${RUSH_DELIVERY_MODULE}" call workflow \
  --git-sha="${GITHUB_SHA}" \
  --event-name="${GITHUB_EVENT_NAME}" \
  --force-targets-json="${FORCE_TARGETS_JSON:-[]}" \
  --deploy-tag-prefix=deploy/prod \
  --artifact-prefix=deploy-target \
  --environment=prod \
  --dry-run=false \
  --deploy-env-file="${DEPLOY_ENV_FILE}" \
  --toolchain-image-provider=github \
  --toolchain-image-policy=lazy \
  --rush-cache-provider=github \
  --rush-cache-policy=lazy \
  --source-mode=git \
  --source-repository-url="${SOURCE_REPOSITORY_URL}" \
  --source-ref="${GITHUB_REF}" \
  --source-auth-token-env=GITHUB_TOKEN \
  --runtime-files="${RUNTIME_FILES_DIR}" \
  --docker-socket=/var/run/docker.sock
```

See [CI using command line](docs/quick-start/ci-cli.md) for the guided version.

## Local Runs Against Unpushed Changes

For local testing, pass the working tree explicitly. This keeps unpushed edits
available to Dagger and avoids relying on a remote Git ref that does not contain
your latest changes.

```sh
RUSH_DELIVERY_MODULE=github.com/BootstrapLaboratory/rush-delivery@v0.6.7

dagger -m "${RUSH_DELIVERY_MODULE}" call workflow \
  --repo=. \
  --git-sha="$(git rev-parse HEAD)" \
  --event-name=manual \
  --force-targets-json='[]' \
  --environment=prod \
  --dry-run=true \
  --toolchain-image-provider=off \
  --rush-cache-provider=off \
  --source-mode=local_copy
```

See [local runs](docs/quick-start/local-run.md) for more context.

## Documentation

- [Documentation site](https://bootstraplaboratory.github.io/rush-delivery/)
- [Introduction](docs/README.md)
- [Public Dagger API](docs/api.md)
- [Entrypoints reference](docs/entrypoints.md)
- [Workflow guide](docs/workflows.md)
- [Metadata contracts](docs/metadata.md)
- [Provider adapters](docs/providers.md)
- [Development notes](docs/development.md)

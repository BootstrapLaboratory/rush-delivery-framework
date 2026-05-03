# Local Runs

For local testing, pass the working tree explicitly. This keeps unpushed edits
available to Dagger and avoids relying on a remote Git ref that does not contain
your latest changes.

```sh
RUSH_DELIVERY_MODULE=github.com/BootstrapLaboratory/rush-delivery@v0.6.0

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

For local PR-style validation only:

```sh
dagger -m "${RUSH_DELIVERY_MODULE}" call validate \
  --repo=. \
  --event-name=pull_request \
  --pr-base-sha="$(git merge-base HEAD origin/main)" \
  --source-mode=local_copy
```

Keep live deploy credentials out of source. If a local live deploy needs files
such as cloud credentials, pass them through a runtime files directory and refer
to them from target metadata.

For deployment metadata, see [Metadata contracts](../metadata.md). For workflow
shape and release behavior, see the [Workflow Guide](../workflows.md).

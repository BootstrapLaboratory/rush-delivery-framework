---
title: "Dagger Metadata Map"
sidebar_label: "Dagger Metadata Map"
---

Rush Delivery is configured by metadata in `.dagger`. The directory belongs to
the product repository, not to the Rush Delivery module, because target
behavior is product-specific.

The example repository uses this layout:

```text
.dagger/
├── deploy/
│   ├── services-mesh.yaml
│   └── targets/
│       ├── server.yaml
│       └── webapp.yaml
├── package/
│   └── targets/
│       ├── server.yaml
│       └── webapp.yaml
├── rush-cache/
│   └── providers.yaml
├── toolchain-images/
│   └── providers.yaml
└── validate/
    └── targets/
        └── server.yaml
```

Each part answers one question.

## Deployment Graph

`.dagger/deploy/services-mesh.yaml` answers:

- Which deploy targets exist?
- Which targets must run before other targets?

The example says `webapp` waits for `server`.

## Package Targets

`.dagger/package/targets/*.yaml` answers:

- What artifact does this target need?
- Is the artifact a Rush deploy archive or a built directory?
- Which Rush project and deploy scenario produce it?

## Deploy Targets

`.dagger/deploy/targets/*.yaml` answers:

- What runtime image should execute the deploy?
- Which files from the built workspace should be mounted?
- Which tools should be installed into the deploy runtime?
- Which environment variables may be passed?
- Which deploy script should run?

## Provider Artifacts

`.dagger/toolchain-images/providers.yaml` and
`.dagger/rush-cache/providers.yaml` answer:

- Where should reusable toolchain images and Rush install cache be stored?
- Which environment variables provide repository, token, and username?
- Which Rush install paths should be restored and published?

## Validation Targets

`.dagger/validate/targets/*.yaml` answers:

- Which additional runtime services are needed for validation?
- Which commands or long-running services should start?
- Which smoke checks should prove the target works?

## Checklist

- Keep `.dagger` metadata small and declarative.
- Put provider credentials in CI env, not in metadata.
- Put executable deployment behavior in scripts.
- Use metadata to connect Rush projects, package artifacts, and deploy targets.

Next: [Provider Artifacts](../provider-artifacts).

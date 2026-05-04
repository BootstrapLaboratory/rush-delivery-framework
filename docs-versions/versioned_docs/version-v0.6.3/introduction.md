---
id: "introduction"
title: "Introduction"
sidebar_label: "Introduction"
---

Rush Delivery is a provider-adaptable Dagger module for Rush monorepos. The
framework assumes Rush is the project graph and uses `.dagger/` metadata as the
extension surface for validation, packaging, deployment, caches, and toolchains.

## Guides

- [Quick Start](../quick-start/github-actions): recommended ways to run Rush
  Delivery from GitHub Actions, CI scripts, and local working trees.
- [Public Dagger API](../api): callable functions and when to use them.
- [GitHub Action usage](../github-action): GitHub CI wrapper for validation
  and release entrypoints.
- [Entrypoints reference](../entrypoints): every callable Dagger function and
  separate-use workflow.
- [Workflow guide](../workflows): local and CI workflow shapes.
- [Metadata contracts](../metadata): files under `.dagger/` that define target
  behavior.
- [Provider adapters](../providers): source, registry, cache, and CI-provider
  boundaries.
- [Development](../development): maintainer checks, website build notes, and
  generated documentation inputs.
- [AI architecture](https://github.com/BootstrapLaboratory/rush-delivery/blob/v0.6.3/docs/ai/architecture.md): high-level design map for future
  coding agents.
- [AI conventions](https://github.com/BootstrapLaboratory/rush-delivery/blob/v0.6.3/docs/ai/conventions.md): contribution rules and invariants.

## Source Of Truth

The schemas under [`../schemas`](https://github.com/BootstrapLaboratory/rush-delivery/blob/v0.6.3/schemas) are the field-level metadata
contract. These docs explain intent and usage; schemas define file shape.

Published schemas are available from the documentation site:

- `https://bootstraplaboratory.github.io/rush-delivery/schemas/<schema>.schema.json`
- `https://bootstraplaboratory.github.io/rush-delivery/schemas/v0.6.3/<schema>.schema.json`

Use exact versioned schema URLs in project metadata editor hints so older
projects keep the schema contract they were written against. The root
`/schemas/` URLs point at the current release line.

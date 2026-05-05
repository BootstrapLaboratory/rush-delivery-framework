---
id: "tutorial"
title: "Tutorial"
sidebar_label: "Tutorial"
description: "Build a Rush Delivery setup from Rush metadata to deployment."
---

This tutorial walks through a complete Rush Delivery setup for a Rush monorepo.
It uses a real public project as the worked example:

[BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk)

That repository is already wired end to end with Rush Delivery. It deploys a
NestJS backend to Google Cloud Run, deploys a React webapp to Cloudflare Pages,
and validates pull requests through Rush Delivery before changes reach `main`.

The cloud providers are examples, not requirements. The reusable part is the
shape:

- Rush owns project identity, dependency graph, selected project commands, and
  deploy bundles.
- `.dagger` metadata describes deployment targets, package artifacts,
  validation targets, provider-backed cache, and provider-backed toolchains.
- GitHub Actions stays thin. It authenticates to external systems, passes env
  and runtime files, and calls the Rush Delivery action.
- Rush Delivery owns source acquisition, affected target detection, build,
  package, validation, deploy ordering, and runtime execution.

## What You Will Build

By the end of the tutorial, a project should have this shape:

```text
.
├── rush.json
├── common/config/rush/
├── .dagger/
│   ├── deploy/
│   ├── package/
│   ├── rush-cache/
│   ├── toolchain-images/
│   └── validate/
└── .github/workflows/
```

The tutorial does not teach NestJS, Relay, React, Google Cloud Run, or
Cloudflare Pages in depth. Those are implementation details of the example
project. The point is to teach how a Rush project becomes a Rush Delivery
project.

## Chapters

1. [Rush Monorepo Baseline](rush-monorepo-baseline)
2. [Rush Commands](rush-commands)
3. [Dagger Metadata Map](dagger-metadata-map)
4. [Provider Artifacts](provider-artifacts)
5. [Package Targets](package-targets)
6. [Deploy Mesh](deploy-mesh)
7. [Deploy Targets](deploy-targets)
8. [Validation Targets](validation-targets)
9. [GitHub Actions](github-actions)
10. [Local Dry Runs](local-dry-runs)
11. [Adapt To Your Project](adapting-to-your-project)

## The Example Repository

The example has three Rush projects:

- `api-contract` in `libs/api`
- `server` in `apps/server`
- `webapp` in `apps/webapp`

Its deployment model has two deploy targets:

- `server`, packaged with `rush deploy` and deployed by a Cloud Run script
- `webapp`, packaged as a static build directory and deployed by a Cloudflare
  Pages script

Its validation model includes normal Rush validation plus a backend runtime
validation target that starts Postgres, Redis, runs migrations, starts the
server, and performs a smoke check.

Use the example repository as a reference implementation. Copy shapes and
contracts from it, but adapt target names, scripts, environment variables, and
provider choices to your own product.

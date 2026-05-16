# Fix Dependency Security Alerts

## Context

`trunk check -a` reports OSV security issues in generated dependency locks:

- `website/package-lock.json`
- `website-docusaurus/package-lock.json`
- root `yarn.lock`

The issues are in website/tooling dependencies, not Rush Delivery runtime
metadata or Dagger public behavior.

## Release Guidance

Treat this as a patch release after `v0.7.0`, likely `v0.7.1`.

No new schema snapshot or versioned documentation slice is needed because this
does not change the public module contract, metadata shape, or documentation
content. If docs examples pin the latest action tag, update current docs and
website examples to the patch tag only.

## Checklist

- [x] Inspect package manager layout for root, Astro site, and Docusaurus site.
- [x] Update vulnerable dependencies to patched versions without broad
      unrelated upgrades.
- [x] Run relevant install/lock refresh commands.
- [x] Run `trunk check -a`.
- [x] Run project tests/type checks affected by dependency updates.
- [x] Provide release guidance and semantic commit message suggestions.

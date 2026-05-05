# Default NPM Provenance False

## Context

Rush Delivery `release-packages` runs `rush publish` inside a Dagger container.
NPM automatic provenance can fail there because npm cannot always detect a
supported CI/OIDC provider from inside the isolated runtime.

## Goal

Prepare patch release `v0.6.5` with an explicit default contract: npm package
provenance is disabled unless metadata opts in.

## Checklist

- [x] Confirm parser behavior for omitted `publish.provenance`.
- [x] Add regression coverage for an existing `publish` block without provenance.
- [x] Update JSON schema defaults and release schema snapshot.
- [x] Update Rush Delivery docs, README, and website examples to `v0.6.5`.
- [x] Document when to keep provenance omitted/false and when to opt in.
- [x] Archive `v0.6.4` docs for Docusaurus versioned docs.
- [x] Run relevant tests and site checks.
- [x] Move this task file to `tasks/completed`.

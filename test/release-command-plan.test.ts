import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { NpmReleaseDefinition } from "../src/model/npm-release.ts";
import {
  buildNpmReleaseExecutionPlan,
  buildRushChangeVerifyStep,
  buildRushPublishStep,
} from "../src/stages/release/release-command-plan.ts";
import { RELEASE_GIT_AUTH_ENV_NAMES } from "../src/stages/release/git-auth-env.ts";

const releaseDefinition: NpmReleaseDefinition = {
  auth: {
    kind: "token",
    token_env: "NPM_TOKEN",
  },
  kind: "npm",
  publish: {
    access: "public",
    provenance: true,
    registry: "https://registry.npmjs.org/",
    tag: "latest",
  },
  versioning: {
    strategy: "rush-change-files",
    target_branch: "main",
  },
};

test("builds Rush change verification command", () => {
  assert.deepEqual(buildRushChangeVerifyStep(releaseDefinition), {
    args: [
      "common/scripts/install-run-rush.js",
      "change",
      "--verify",
      "--target-branch",
      "main",
    ],
    command: "node",
  });
});

test("builds dry-run Rush publish command without mutating flags", () => {
  assert.deepEqual(buildRushPublishStep(releaseDefinition, true), {
    args: [
      "common/scripts/install-run-rush.js",
      "publish",
      "--registry",
      "https://registry.npmjs.org/",
      "--tag",
      "latest",
      "--set-access-level",
      "public",
    ],
    command: "node",
  });
});

test("builds live Rush publish command with apply and publish flags", () => {
  assert.deepEqual(buildRushPublishStep(releaseDefinition, false), {
    args: [
      "common/scripts/install-run-rush.js",
      "publish",
      "--apply",
      "--target-branch",
      "main",
      "--publish",
      "--registry",
      "https://registry.npmjs.org/",
      "--tag",
      "latest",
      "--set-access-level",
      "public",
    ],
    command: "node",
  });
});

test("configures Git push auth before live Rush publish", () => {
  const plan = buildNpmReleaseExecutionPlan(releaseDefinition, false);

  assert.deepEqual(
    plan.map((step) => step.kind),
    ["git-push-auth", "rush-publish"],
  );
});

test("does not configure Git push auth during dry-run publish", () => {
  const plan = buildNpmReleaseExecutionPlan(releaseDefinition, true);

  assert.deepEqual(
    plan.map((step) => step.kind),
    ["rush-publish"],
  );
});

test("keeps release Git auth env names out of Rush reserved namespace", () => {
  for (const name of RELEASE_GIT_AUTH_ENV_NAMES) {
    assert.equal(name.startsWith("RUSH_"), false);
  }
});

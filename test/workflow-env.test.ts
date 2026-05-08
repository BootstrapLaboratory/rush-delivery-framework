import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  mergeWorkflowEnvOverlay,
  mergeWorkflowSourceEnv,
} from "../src/workflow/env.ts";

test("workflow env overlay allows duplicate keys with the same value", () => {
  assert.deepEqual(
    mergeWorkflowEnvOverlay(
      {
        GITHUB_TOKEN: "token",
        SHARED: "base",
      },
      {
        GITHUB_TOKEN: "token",
        TARGET_ONLY: "value",
      },
      "deploy env",
    ),
    {
      GITHUB_TOKEN: "token",
      SHARED: "base",
      TARGET_ONLY: "value",
    },
  );
});

test("workflow env overlay rejects duplicate keys with different values", () => {
  assert.throws(
    () =>
      mergeWorkflowEnvOverlay(
        {
          GITHUB_TOKEN: "base-token",
        },
        {
          GITHUB_TOKEN: "deploy-token",
        },
        "deploy env",
      ),
    /deploy env variable "GITHUB_TOKEN" cannot redefine workflow env with a different value\./,
  );
});

test("workflow source env prefers workflow env and then deploy overlay", () => {
  assert.deepEqual(
    mergeWorkflowSourceEnv(
      {
        GITHUB_TOKEN: "workflow-token",
      },
      {
        GITHUB_TOKEN: "deploy-token",
        PROVIDER_TOKEN: "deploy-provider",
      },
      {
        GITHUB_TOKEN: "release-token",
        PROVIDER_TOKEN: "release-provider",
        RELEASE_ONLY: "yes",
      },
    ),
    {
      GITHUB_TOKEN: "workflow-token",
      PROVIDER_TOKEN: "deploy-provider",
      RELEASE_ONLY: "yes",
    },
  );
});


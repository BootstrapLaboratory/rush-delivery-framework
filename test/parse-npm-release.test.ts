import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseNpmRelease } from "../src/stages/release/parse-npm-release.ts";

test("parses NPM release metadata with token auth and publish options", () => {
  assert.deepEqual(
    parseNpmRelease(
      [
        "kind: npm",
        "versioning:",
        "  strategy: rush-change-files",
        "  target_branch: main",
        "auth:",
        "  kind: token",
        "  token_env: NPM_TOKEN",
        "publish:",
        "  registry: https://registry.npmjs.org/",
        "  tag: latest",
        "  access: public",
        "  provenance: true",
        "",
      ].join("\n"),
    ),
    {
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
    },
  );
});

test("defaults optional NPM release publish options", () => {
  assert.deepEqual(
    parseNpmRelease(
      [
        "kind: npm",
        "versioning:",
        "  strategy: rush-change-files",
        "  target_branch: main",
        "auth:",
        "  kind: token",
        "  token_env: NPM_TOKEN",
        "",
      ].join("\n"),
    ).publish,
    {
      provenance: false,
      registry: "",
      tag: "latest",
    },
  );
});

test("rejects unsupported NPM release versioning strategy", () => {
  assert.throws(
    () =>
      parseNpmRelease(
        [
          "kind: npm",
          "versioning:",
          "  strategy: version-policy",
          "  target_branch: main",
          "auth:",
          "  kind: token",
          "  token_env: NPM_TOKEN",
          "",
        ].join("\n"),
      ),
    /Unsupported NPM release versioning strategy "version-policy"\./,
  );
});

test("rejects unsafe NPM release target branch", () => {
  assert.throws(
    () =>
      parseNpmRelease(
        [
          "kind: npm",
          "versioning:",
          "  strategy: rush-change-files",
          "  target_branch: ../main",
          "auth:",
          "  kind: token",
          "  token_env: NPM_TOKEN",
          "",
        ].join("\n"),
      ),
    /NPM release versioning target_branch is not a safe Git branch name\./,
  );
});

test("rejects invalid NPM release token env", () => {
  assert.throws(
    () =>
      parseNpmRelease(
        [
          "kind: npm",
          "versioning:",
          "  strategy: rush-change-files",
          "  target_branch: main",
          "auth:",
          "  kind: token",
          "  token_env: npm_token",
          "",
        ].join("\n"),
      ),
    /NPM release auth token_env must match/,
  );
});

import * as assert from "node:assert/strict";
import { test } from "node:test";

import { selectWorkflowReleaseTargets } from "../src/workflow/release-target-selection.ts";

test("keeps workflow release targets empty by default", () => {
  assert.deepEqual(selectWorkflowReleaseTargets("[]", ["npm"]), []);
});

test("selects npm when configured", () => {
  assert.deepEqual(selectWorkflowReleaseTargets('["npm","npm"]', ["npm"]), [
    "npm",
  ]);
});

test("rejects unknown workflow release targets", () => {
  assert.throws(
    () => selectWorkflowReleaseTargets('["npm"]', []),
    /Unsupported workflow release target "npm"\. Configured release targets: \(none\)\./,
  );
});


import type { NpmReleaseDefinition } from "../../model/npm-release.ts";

const RUSH_SCRIPT = "common/scripts/install-run-rush.js";

export type ReleaseCommandStep = {
  args: string[];
  command: "git" | "node";
};

export function buildRushChangeVerifyStep(
  definition: NpmReleaseDefinition,
): ReleaseCommandStep {
  return {
    args: [
      RUSH_SCRIPT,
      "change",
      "--verify",
      "--target-branch",
      definition.versioning.target_branch,
    ],
    command: "node",
  };
}

export function buildRushPublishStep(
  definition: NpmReleaseDefinition,
  dryRun: boolean,
): ReleaseCommandStep {
  const args = [RUSH_SCRIPT, "publish"];

  if (!dryRun) {
    args.push(
      "--apply",
      "--target-branch",
      definition.versioning.target_branch,
      "--publish",
    );
  }

  if (definition.publish.registry.length > 0) {
    args.push("--registry", definition.publish.registry);
  }

  if (definition.publish.tag.length > 0) {
    args.push("--tag", definition.publish.tag);
  }

  if (definition.publish.access !== undefined) {
    args.push("--set-access-level", definition.publish.access);
  }

  return {
    args,
    command: "node",
  };
}

export function buildGitPushReleaseStep(
  definition: NpmReleaseDefinition,
): ReleaseCommandStep {
  return {
    args: [
      "push",
      "origin",
      definition.versioning.target_branch,
      "--follow-tags",
    ],
    command: "git",
  };
}

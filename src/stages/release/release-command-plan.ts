import type { NpmReleaseDefinition } from "../../model/npm-release.ts";

const RUSH_SCRIPT = "common/scripts/install-run-rush.js";

export type ReleaseCommandStep = {
  args: string[];
  command: "git" | "node";
};

export type ReleaseExecutionStep =
  | {
      kind: "git-push-auth";
    }
  | {
      targetBranch: string;
      kind: "git-target-branch";
    }
  | {
      commandStep: ReleaseCommandStep;
      kind: "rush-publish";
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

export function buildNpmReleaseExecutionPlan(
  definition: NpmReleaseDefinition,
  dryRun: boolean,
): ReleaseExecutionStep[] {
  const publishStep = buildRushPublishStep(definition, dryRun);

  if (dryRun) {
    return [
      {
        commandStep: publishStep,
        kind: "rush-publish",
      },
    ];
  }

  return [
    {
      kind: "git-push-auth",
    },
    {
      kind: "git-target-branch",
      targetBranch: definition.versioning.target_branch,
    },
    {
      commandStep: publishStep,
      kind: "rush-publish",
    },
  ];
}

import { parseReleaseTargets } from "../planning/parse-release-targets.ts";

export function selectWorkflowReleaseTargets(
  releaseTargetsJson: string,
  configuredReleaseTargets: string[],
): string[] {
  const selectedTargets = parseReleaseTargets(releaseTargetsJson);
  const configuredTargetSet = new Set(configuredReleaseTargets);

  for (const target of selectedTargets) {
    if (!configuredTargetSet.has(target)) {
      throw new Error(
        `Unsupported workflow release target "${target}". Configured release targets: ${configuredReleaseTargets.length === 0 ? "(none)" : configuredReleaseTargets.join(", ")}.`,
      );
    }
  }

  return selectedTargets;
}


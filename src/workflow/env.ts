import type { File } from "@dagger.io/dagger";

import { parseEnvFileContents } from "../env/env-file.ts";

export async function parseOptionalEnvFile(
  envFile: File | undefined,
  label: string,
): Promise<Record<string, string>> {
  if (envFile === undefined) {
    return {};
  }

  return parseEnvFileContents(await envFile.contents(), label);
}

export function mergeWorkflowEnvOverlay(
  workflowEnv: Record<string, string>,
  overlayEnv: Record<string, string>,
  overlayLabel: string,
): Record<string, string> {
  for (const [name, value] of Object.entries(overlayEnv)) {
    const workflowValue = workflowEnv[name];

    if (workflowValue !== undefined && workflowValue !== value) {
      throw new Error(
        `${overlayLabel} variable "${name}" cannot redefine workflow env with a different value.`,
      );
    }
  }

  return {
    ...workflowEnv,
    ...overlayEnv,
  };
}

export function mergeWorkflowSourceEnv(
  workflowEnv: Record<string, string>,
  deployEnv: Record<string, string>,
  releaseEnv: Record<string, string>,
): Record<string, string> {
  return {
    ...releaseEnv,
    ...deployEnv,
    ...workflowEnv,
  };
}

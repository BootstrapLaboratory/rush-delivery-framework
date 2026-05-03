import type { Container, Directory } from "@dagger.io/dagger";

import { logSection } from "../../logging/sections.ts";
import { loadOptionalNpmReleaseMetadata } from "./load-release-metadata.ts";
import { buildRushChangeVerifyStep } from "./release-command-plan.ts";

export async function hasReleaseReadinessValidation(
  repo: Directory,
): Promise<boolean> {
  return (await loadOptionalNpmReleaseMetadata(repo)) !== undefined;
}

export async function runReleaseReadinessValidation(
  repo: Directory,
  container: Container,
): Promise<Container> {
  const definition = await loadOptionalNpmReleaseMetadata(repo);

  if (definition === undefined) {
    return container;
  }

  logSection("Release readiness");

  const changeVerifyStep = buildRushChangeVerifyStep(definition);
  console.log(
    `[release-readiness] Rush command: ${changeVerifyStep.args.slice(1).join(" ")}`,
  );

  return container.withExec(
    [changeVerifyStep.command, ...changeVerifyStep.args],
    {
      expand: false,
    },
  );
}

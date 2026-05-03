import { Directory, ExistsType } from "@dagger.io/dagger";

import type { NpmReleaseDefinition } from "../../model/npm-release.ts";
import { npmReleaseMetadataPath } from "./metadata-paths.ts";
import { parseNpmRelease } from "./parse-npm-release.ts";

export async function hasNpmReleaseMetadata(repo: Directory): Promise<boolean> {
  return repo.exists(npmReleaseMetadataPath, {
    expectedType: ExistsType.RegularType,
  });
}

export async function loadNpmReleaseMetadata(
  repo: Directory,
): Promise<NpmReleaseDefinition> {
  return parseNpmRelease(await repo.file(npmReleaseMetadataPath).contents());
}

export async function loadOptionalNpmReleaseMetadata(
  repo: Directory,
): Promise<NpmReleaseDefinition | undefined> {
  if (!(await hasNpmReleaseMetadata(repo))) {
    return undefined;
  }

  return loadNpmReleaseMetadata(repo);
}

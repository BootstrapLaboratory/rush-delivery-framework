import type {
  DeployRuntimeSpec,
  FileMountSpec,
} from "../../model/deploy-target.ts";
import type { HostEnv } from "../../model/env.ts";
import { parseEnvFileContents } from "../../env/env-file.ts";
import { resolvePassThroughEnvironment } from "../../env/pass-through.ts";

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseDeployEnvFile(contents: string): Record<string, string> {
  return parseEnvFileContents(contents, "deploy env");
}

export function resolveSpecEnvironment(
  spec: DeployRuntimeSpec,
  hostEnv: HostEnv,
  dryRun: boolean,
  target: string,
): Record<string, string> {
  const envVars = resolvePassThroughEnvironment({
    context: "target",
    dryRun,
    hostEnv,
    spec,
    target,
  });

  for (const [name, value] of Object.entries(spec.env)) {
    const existingValue = envVars[name];

    if (existingValue !== undefined && existingValue !== value) {
      throw new Error(
        `Environment variable "${name}" for target "${target}" is defined by both runtime env passthrough and static env with different values.`,
      );
    }

    envVars[name] = value;
  }

  return envVars;
}

export function validateRequiredHostEnv(
  spec: DeployRuntimeSpec,
  hostEnv: HostEnv,
  dryRun: boolean,
  target: string,
): void {
  if (dryRun) {
    return;
  }

  for (const name of spec.required_host_env) {
    if (!isNonEmptyString(hostEnv[name])) {
      throw new Error(
        `Missing required host environment variable "${name}" for target "${target}".`,
      );
    }
  }
}

export function getRequiredMountSource(
  hostEnv: HostEnv,
  name: string,
  target: string,
): string {
  const value = hostEnv[name];

  if (!isNonEmptyString(value)) {
    throw new Error(
      `Missing required host environment variable "${name}" for target "${target}".`,
    );
  }

  return value;
}

function normalizePathForComparison(value: string): string {
  let normalized = value.replace(/\\/g, "/").replace(/\/+/g, "/");

  while (normalized.endsWith("/") && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function normalizeRepoRelativePath(value: string): string {
  let normalized = normalizePathForComparison(value);

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  return normalized;
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:\//.test(value);
}

function validateRepoRelativePath(
  path: string,
  target: string,
  name: string,
): string {
  const normalized = normalizeRepoRelativePath(path);

  if (normalized.length === 0 || normalized === ".") {
    throw new Error(
      `File mount source "${name}" for target "${target}" must resolve to a repository-relative file path.`,
    );
  }

  if (isAbsolutePath(normalized)) {
    throw new Error(
      `File mount source "${name}" for target "${target}" must resolve to a repository-relative file path.`,
    );
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(
      `File mount source "${name}" for target "${target}" must stay under the checked-out repository.`,
    );
  }

  return normalized;
}

export function getRequiredRepoRelativeHostPathSource(
  hostEnv: HostEnv,
  name: string,
  target: string,
  hostWorkspaceDir: string = "",
): string {
  const sourcePath = getRequiredMountSource(hostEnv, name, target);
  const normalizedSourcePath = normalizePathForComparison(sourcePath);

  if (!isAbsolutePath(normalizedSourcePath)) {
    return validateRepoRelativePath(normalizedSourcePath, target, name);
  }

  const normalizedWorkspaceDir = normalizePathForComparison(hostWorkspaceDir);
  if (!isNonEmptyString(normalizedWorkspaceDir)) {
    throw new Error(
      `Mount source "${name}" for target "${target}" is absolute. Pass hostWorkspaceDir so Dagger can map host paths into the checked-out repository.`,
    );
  }

  const workspacePrefix = `${normalizedWorkspaceDir}/`;
  if (!normalizedSourcePath.startsWith(workspacePrefix)) {
    throw new Error(
      `Mount source "${name}" for target "${target}" must be located under hostWorkspaceDir "${normalizedWorkspaceDir}".`,
    );
  }

  const relativePath = normalizedSourcePath.slice(workspacePrefix.length);
  return validateRepoRelativePath(relativePath, target, name);
}

export function validateRuntimeFilesProvided(
  fileMounts: FileMountSpec[],
  runtimeFiles: unknown,
  dryRun: boolean,
  target: string,
): void {
  const hasRuntimeFileMounts = fileMounts.some(
    (fileMount) => fileMount.kind === "runtime_file",
  );

  if (dryRun || !hasRuntimeFileMounts) {
    return;
  }

  if (runtimeFiles === undefined) {
    throw new Error(
      `Runtime files directory is required for target "${target}" because it references runtime file mounts.`,
    );
  }
}

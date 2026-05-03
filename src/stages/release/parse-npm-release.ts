import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../../metadata/parse-utils.ts";
import type {
  NpmReleaseAuth,
  NpmReleaseDefinition,
  NpmReleasePublish,
  NpmReleaseVersioning,
} from "../../model/npm-release.ts";

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parseOptionalString(rawValue: unknown, name: string): string {
  if (rawValue === undefined) {
    return "";
  }

  return parseRequiredString(rawValue, name);
}

function parseOptionalBoolean(rawValue: unknown, name: string): boolean {
  if (rawValue === undefined) {
    return false;
  }

  if (typeof rawValue !== "boolean") {
    throw new Error(`${name} must be a boolean.`);
  }

  return rawValue;
}

function parseSafeCliValue(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name);

  if (/[\u0000-\u001f\u007f\s]/u.test(value)) {
    throw new Error(
      `${name} must not contain whitespace or control characters.`,
    );
  }

  if (value.startsWith("-")) {
    throw new Error(`${name} must not start with "-".`);
  }

  return value;
}

function parseSafeGitBranch(rawValue: unknown, name: string): string {
  const value = parseSafeCliValue(rawValue, name);

  if (value.includes("..") || value.endsWith(".lock")) {
    throw new Error(`${name} is not a safe Git branch name.`);
  }

  return value;
}

function parseEnvName(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name);

  if (!ENV_NAME_PATTERN.test(value)) {
    throw new Error(`${name} must match ${ENV_NAME_PATTERN}.`);
  }

  return value;
}

function parseVersioning(rawValue: unknown): NpmReleaseVersioning {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("NPM release versioning must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["strategy", "target_branch"],
    "NPM release versioning",
  );

  const strategy = parseRequiredString(
    "strategy" in rawValue ? rawValue.strategy : undefined,
    "NPM release versioning strategy",
  );

  if (strategy !== "rush-change-files") {
    throw new Error(
      `Unsupported NPM release versioning strategy "${strategy}".`,
    );
  }

  return {
    strategy,
    target_branch: parseSafeGitBranch(
      "target_branch" in rawValue ? rawValue.target_branch : undefined,
      "NPM release versioning target_branch",
    ),
  };
}

function parseAuth(rawValue: unknown): NpmReleaseAuth {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("NPM release auth must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["kind", "token_env"],
    "NPM release auth",
  );

  const kind = parseRequiredString(
    "kind" in rawValue ? rawValue.kind : undefined,
    "NPM release auth kind",
  );

  if (kind !== "token") {
    throw new Error(`Unsupported NPM release auth kind "${kind}".`);
  }

  return {
    kind,
    token_env: parseEnvName(
      "token_env" in rawValue ? rawValue.token_env : undefined,
      "NPM release auth token_env",
    ),
  };
}

function parsePublish(rawValue: unknown): NpmReleasePublish {
  if (rawValue === undefined) {
    return {
      provenance: false,
      registry: "",
      tag: "latest",
    };
  }

  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("NPM release publish must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["access", "provenance", "registry", "tag"],
    "NPM release publish",
  );

  const access =
    "access" in rawValue && rawValue.access !== undefined
      ? parseRequiredString(rawValue.access, "NPM release publish access")
      : undefined;

  if (access !== undefined && access !== "public" && access !== "restricted") {
    throw new Error(`Unsupported NPM release publish access "${access}".`);
  }

  return {
    ...(access === undefined ? {} : { access }),
    provenance: parseOptionalBoolean(
      "provenance" in rawValue ? rawValue.provenance : undefined,
      "NPM release publish provenance",
    ),
    registry: parseOptionalString(
      "registry" in rawValue ? rawValue.registry : undefined,
      "NPM release publish registry",
    ),
    tag:
      "tag" in rawValue && rawValue.tag !== undefined
        ? parseSafeCliValue(rawValue.tag, "NPM release publish tag")
        : "latest",
  };
}

export function parseNpmRelease(npmReleaseYaml: string): NpmReleaseDefinition {
  const parsedValue = parseYaml(npmReleaseYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("NPM release file must define a top-level mapping.");
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["auth", "kind", "publish", "versioning"],
    "NPM release file",
  );

  const kind = parseRequiredString(
    "kind" in parsedValue ? parsedValue.kind : undefined,
    "NPM release kind",
  );

  if (kind !== "npm") {
    throw new Error(`Unsupported NPM release kind "${kind}".`);
  }

  return {
    auth: parseAuth("auth" in parsedValue ? parsedValue.auth : undefined),
    kind,
    publish: parsePublish(
      "publish" in parsedValue ? parsedValue.publish : undefined,
    ),
    versioning: parseVersioning(
      "versioning" in parsedValue ? parsedValue.versioning : undefined,
    ),
  };
}

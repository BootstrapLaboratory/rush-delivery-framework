import {
  dag,
  type Container,
  type Directory,
  type File,
} from "@dagger.io/dagger";

import type { NpmReleaseDefinition } from "../../model/npm-release.ts";
import type { GitSourcePlan, SourcePlan } from "../../model/source.ts";
import { formatMetadataContractValidationResult } from "../../metadata/metadata-contract.ts";
import { validateMetadataContract } from "../../metadata/dagger-metadata-contract.ts";
import { buildRushAllProjectsLifecycleSteps } from "../../rush/rush-command-plan.ts";
import { resolveRushProviderOptions } from "../../rush/provider-options.ts";
import {
  installRushWithCache,
  prepareRushWorkflowContainer,
  type RushWorkflowContainerOptions,
} from "../../rush/workflow-container.ts";
import { resolveSource } from "../../source/resolve-source.ts";
import { buildSourceAcquisitionPlan } from "../../source/source-options.ts";
import { logSection } from "../../logging/sections.ts";
import { parseDeployEnvFile } from "../deploy/runtime-env.ts";
import { loadOptionalNpmReleaseMetadata } from "./load-release-metadata.ts";
import {
  buildGitPushReleaseStep,
  buildRushPublishStep,
} from "./release-command-plan.ts";

export type ReleasePackagesInput = {
  dryRun?: boolean;
  gitSha?: string;
  releaseEnvFile?: File;
  repo?: Directory;
  rushCachePolicy?: string;
  rushCacheProvider?: string;
  sourceAuthTokenEnv?: string;
  sourceAuthUsername?: string;
  sourceMode?: string;
  sourceRef?: string;
  sourceRepositoryUrl?: string;
  toolchainImagePolicy?: string;
  toolchainImageProvider?: string;
};

type ReleasePackagesSummary = {
  dry_run: boolean;
  publish: {
    access?: string;
    provenance: boolean;
    registry: string;
    tag: string;
  };
  release_target: "npm";
  versioning: {
    strategy: string;
    target_branch: string;
  };
};

function requireHostEnv(
  hostEnv: Record<string, string>,
  name: string,
  context: string,
): string {
  const value = hostEnv[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${context} requires host env ${name}.`);
  }

  return value;
}

function requireGitSourcePlan(
  sourcePlan: SourcePlan,
  context: string,
): GitSourcePlan {
  if (sourcePlan.mode !== "git") {
    throw new Error(`${context} requires git source mode.`);
  }

  if (sourcePlan.auth === undefined) {
    throw new Error(`${context} requires Git source auth.`);
  }

  return sourcePlan;
}

function withNpmPublishAuth(
  container: Container,
  definition: NpmReleaseDefinition,
  hostEnv: Record<string, string>,
  dryRun: boolean,
): Container {
  if (dryRun) {
    return container;
  }

  const token = requireHostEnv(
    hostEnv,
    definition.auth.token_env,
    "NPM package release",
  );

  return container.withSecretVariable(
    definition.auth.token_env,
    dag.setSecret("rush-delivery-npm-token", token),
  );
}

function withNpmPublishEnvironment(
  container: Container,
  definition: NpmReleaseDefinition,
  dryRun: boolean,
): Container {
  if (dryRun || !definition.publish.provenance) {
    return container;
  }

  return container.withEnvVariable("NPM_CONFIG_PROVENANCE", "true");
}

function withGitPushAuth(
  container: Container,
  sourcePlan: SourcePlan,
  hostEnv: Record<string, string>,
  dryRun: boolean,
): Container {
  if (dryRun) {
    return container;
  }

  const gitSourcePlan = requireGitSourcePlan(sourcePlan, "NPM package release");
  const tokenEnv = gitSourcePlan.auth!.tokenEnv;
  const token = requireHostEnv(
    hostEnv,
    tokenEnv,
    "NPM package release Git push",
  );
  const tokenSecret = dag.setSecret("rush-delivery-git-push-token", token);

  return container
    .withSecretVariable("RUSH_DELIVERY_GIT_TOKEN", tokenSecret)
    .withEnvVariable("RUSH_DELIVERY_GIT_USERNAME", gitSourcePlan.auth!.username)
    .withEnvVariable(
      "RUSH_DELIVERY_GIT_REPOSITORY_URL",
      gitSourcePlan.repositoryUrl,
    )
    .withExec(
      [
        "bash",
        "-lc",
        [
          'case "${RUSH_DELIVERY_GIT_REPOSITORY_URL}" in http://*|https://*) ;; *) echo "NPM package release requires an HTTP(S) Git source URL for token push auth." >&2; exit 1 ;; esac',
          'git config --local user.name "${GIT_AUTHOR_NAME:-rush-delivery}"',
          'git config --local user.email "${GIT_AUTHOR_EMAIL:-rush-delivery@users.noreply.github.com}"',
          'if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "${RUSH_DELIVERY_GIT_REPOSITORY_URL}"; else git remote add origin "${RUSH_DELIVERY_GIT_REPOSITORY_URL}"; fi',
          'encoded="$(printf "%s:%s" "${RUSH_DELIVERY_GIT_USERNAME}" "${RUSH_DELIVERY_GIT_TOKEN}" | base64 | tr -d "\\n")"',
          'git config --local "http.${RUSH_DELIVERY_GIT_REPOSITORY_URL}.extraheader" "AUTHORIZATION: basic ${encoded}"',
        ].join(" && "),
      ],
      {
        expand: false,
      },
    );
}

function runRushLifecycle(container: Container): Container {
  logSection("Rush release build");

  let nextContainer = container.withEnvVariable("FAILURE_MODE", "release");

  for (const { command, args } of buildRushAllProjectsLifecycleSteps()) {
    console.log(`[release-packages] Rush command: ${args[1]}`);
    nextContainer = nextContainer.withExec([command, ...args], {
      expand: false,
    });
  }

  return nextContainer;
}

function runNpmRelease(
  container: Container,
  definition: NpmReleaseDefinition,
  sourcePlan: SourcePlan,
  hostEnv: Record<string, string>,
  dryRun: boolean,
): Container {
  logSection("NPM package release");

  let nextContainer = withNpmPublishEnvironment(
    withNpmPublishAuth(
      withGitPushAuth(container, sourcePlan, hostEnv, dryRun),
      definition,
      hostEnv,
      dryRun,
    ),
    definition,
    dryRun,
  );
  const publishStep = buildRushPublishStep(definition, dryRun);

  console.log(
    `[release-packages] Rush command: ${publishStep.args.slice(1).join(" ")}`,
  );
  nextContainer = nextContainer.withExec(
    [publishStep.command, ...publishStep.args],
    {
      expand: false,
    },
  );

  if (dryRun) {
    return nextContainer;
  }

  const pushStep = buildGitPushReleaseStep(definition);
  console.log(`[release-packages] Git command: ${pushStep.args.join(" ")}`);

  return nextContainer.withExec([pushStep.command, ...pushStep.args], {
    expand: false,
  });
}

function releaseSummary(
  definition: NpmReleaseDefinition,
  dryRun: boolean,
): ReleasePackagesSummary {
  return {
    dry_run: dryRun,
    publish: {
      ...(definition.publish.access === undefined
        ? {}
        : { access: definition.publish.access }),
      provenance: definition.publish.provenance,
      registry: definition.publish.registry,
      tag: definition.publish.tag,
    },
    release_target: "npm",
    versioning: {
      strategy: definition.versioning.strategy,
      target_branch: definition.versioning.target_branch,
    },
  };
}

export async function releasePackages(
  input: ReleasePackagesInput,
): Promise<string> {
  const {
    dryRun = true,
    gitSha = "",
    releaseEnvFile,
    repo,
    rushCachePolicy = "lazy",
    rushCacheProvider = "off",
    sourceAuthTokenEnv = "",
    sourceAuthUsername = "",
    sourceMode = "local_copy",
    sourceRef = "",
    sourceRepositoryUrl = "",
    toolchainImagePolicy = "lazy",
    toolchainImageProvider = "off",
  } = input;
  const hostEnv = releaseEnvFile
    ? parseDeployEnvFile(await releaseEnvFile.contents())
    : {};
  const sourcePlan = buildSourceAcquisitionPlan({
    gitSha,
    sourceAuthTokenEnv,
    sourceAuthUsername,
    sourceMode,
    sourceRef,
    sourceRepositoryUrl,
  });

  logSection("Source acquisition");
  console.log(`[source] mode=${sourcePlan.mode}`);
  const sourceRepo = await resolveSource(sourcePlan, { hostEnv, repo });

  logSection("Metadata contract");
  console.log(
    formatMetadataContractValidationResult(
      await validateMetadataContract(sourceRepo),
    ),
  );

  const definition = await loadOptionalNpmReleaseMetadata(sourceRepo);
  if (definition === undefined) {
    console.log("[release-packages] no NPM release metadata configured");
    return JSON.stringify(
      {
        dry_run: dryRun,
        release_target: "npm",
        skipped: true,
      },
      null,
      2,
    );
  }

  const rushOptions: RushWorkflowContainerOptions = {
    hostEnv,
    ...(await resolveRushProviderOptions(sourceRepo, {
      rushCachePolicy,
      rushCacheProvider,
      toolchainImagePolicy,
      toolchainImageProvider,
    })),
  };
  const baseContainer = await prepareRushWorkflowContainer(
    sourceRepo,
    rushOptions,
  );
  const rushContainer = await installRushWithCache(
    sourceRepo,
    baseContainer,
    rushOptions,
  );
  const builtContainer = runRushLifecycle(rushContainer);

  await runNpmRelease(
    builtContainer,
    definition,
    sourcePlan,
    hostEnv,
    dryRun,
  ).sync();

  return JSON.stringify(releaseSummary(definition, dryRun), null, 2);
}

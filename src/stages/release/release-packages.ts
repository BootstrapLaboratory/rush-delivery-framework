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
import {
  requiresRushCacheProviderMetadata,
  resolveRushProviderOptions,
} from "../../rush/provider-options.ts";
import {
  installRushWithCache,
  prepareRushWorkflowContainer,
  type RushWorkflowContainerOptions,
} from "../../rush/workflow-container.ts";
import { resolveSource } from "../../source/resolve-source.ts";
import { buildSourceAcquisitionPlan } from "../../source/source-options.ts";
import { logSection } from "../../logging/sections.ts";
import { parseDeployEnvFile } from "../deploy/runtime-env.ts";
import {
  RELEASE_GIT_REPOSITORY_URL_ENV,
  RELEASE_GIT_TOKEN_ENV,
  RELEASE_GIT_USERNAME_ENV,
} from "./git-auth-env.ts";
import { loadOptionalNpmReleaseMetadata } from "./load-release-metadata.ts";
import { buildNpmReleaseExecutionPlan } from "./release-command-plan.ts";

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

type GitPushAuth = {
  repositoryUrl: string;
  token: string;
  username: string;
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

function resolveGitPushAuth(
  sourcePlan: SourcePlan,
  hostEnv: Record<string, string>,
  dryRun: boolean,
): GitPushAuth | undefined {
  if (dryRun) {
    return undefined;
  }

  const gitSourcePlan = requireGitSourcePlan(sourcePlan, "NPM package release");
  const token = requireHostEnv(
    hostEnv,
    gitSourcePlan.auth!.tokenEnv,
    "NPM package release Git push",
  );

  return {
    repositoryUrl: gitSourcePlan.repositoryUrl,
    token,
    username: gitSourcePlan.auth!.username,
  };
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

function withGitAuthorIdentity(container: Container, dryRun: boolean): Container {
  if (dryRun) {
    return container;
  }

  return container.withExec(
    [
      "bash",
      "-lc",
      [
        'git config --local user.name "${GIT_AUTHOR_NAME:-rush-delivery}"',
        'git config --local user.email "${GIT_AUTHOR_EMAIL:-rush-delivery@users.noreply.github.com}"',
      ].join(" && "),
    ],
    {
      expand: false,
    },
  );
}

function withGitPushAuth(container: Container, auth: GitPushAuth): Container {
  const tokenSecret = dag.setSecret("rush-delivery-git-push-token", auth.token);

  return container
    .withSecretVariable(RELEASE_GIT_TOKEN_ENV, tokenSecret)
    .withEnvVariable(RELEASE_GIT_USERNAME_ENV, auth.username)
    .withEnvVariable(RELEASE_GIT_REPOSITORY_URL_ENV, auth.repositoryUrl)
    .withExec(
      [
        "bash",
        "-lc",
        [
          `case "\${${RELEASE_GIT_REPOSITORY_URL_ENV}}" in http://*|https://*) ;; *) echo "NPM package release requires an HTTP(S) Git source URL for token push auth." >&2; exit 1 ;; esac`,
          `if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "\${${RELEASE_GIT_REPOSITORY_URL_ENV}}"; else git remote add origin "\${${RELEASE_GIT_REPOSITORY_URL_ENV}}"; fi`,
          `encoded="$(printf "%s:%s" "\${${RELEASE_GIT_USERNAME_ENV}}" "\${${RELEASE_GIT_TOKEN_ENV}}" | base64 | tr -d "\\n")"`,
          `git config --local "http.\${${RELEASE_GIT_REPOSITORY_URL_ENV}}.extraheader" "AUTHORIZATION: basic \${encoded}"`,
        ].join(" && "),
      ],
      {
        expand: false,
      },
    );
}

function prepareNpmReleaseContainer(
  container: Container,
  definition: NpmReleaseDefinition,
  hostEnv: Record<string, string>,
  dryRun: boolean,
): Container {
  return withNpmPublishEnvironment(
    withNpmPublishAuth(
      withGitAuthorIdentity(container, dryRun),
      definition,
      hostEnv,
      dryRun,
    ),
    definition,
    dryRun,
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

  const gitPushAuth = resolveGitPushAuth(sourcePlan, hostEnv, dryRun);
  let nextContainer = prepareNpmReleaseContainer(
    container,
    definition,
    hostEnv,
    dryRun,
  );

  for (const step of buildNpmReleaseExecutionPlan(definition, dryRun)) {
    switch (step.kind) {
      case "git-push-auth": {
        nextContainer = withGitPushAuth(nextContainer, gitPushAuth!);
        break;
      }

      case "rush-publish": {
        const publishStep = step.commandStep;
        console.log(
          `[release-packages] Rush command: ${publishStep.args.slice(1).join(" ")}`,
        );
        nextContainer = nextContainer.withExec(
          [publishStep.command, ...publishStep.args],
          {
            expand: false,
          },
        );
        break;
      }
    }
  }

  return nextContainer;
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
      await validateMetadataContract(sourceRepo, {
        require_deploy_metadata: false,
        require_rush_cache_metadata: requiresRushCacheProviderMetadata({
          rushCacheProvider,
        }),
      }),
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

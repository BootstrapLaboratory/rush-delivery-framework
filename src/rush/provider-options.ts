import type { Directory } from "@dagger.io/dagger";

import type {
  RushCachePolicy,
  RushCacheProvider,
  RushCacheProvidersDefinition,
} from "../model/rush-cache.ts";
import type {
  ToolchainImagePolicy,
  ToolchainImageProvider,
  ToolchainImageProvidersDefinition,
} from "../model/toolchain-image.ts";
import {
  parseRushCachePolicy,
  parseRushCacheProvider,
} from "../rush-cache/options.ts";
import { parseRushCacheProviders } from "../rush-cache/parse-providers.ts";
import { rushCacheProvidersPath } from "../rush-cache/metadata-paths.ts";
import {
  parseToolchainImagePolicy,
  parseToolchainImageProvider,
} from "../toolchain-images/options.ts";
import { parseToolchainImageProviders } from "../toolchain-images/parse-providers.ts";
import { toolchainImageProvidersPath } from "../toolchain-images/metadata-paths.ts";

export type RushProviderInput = {
  rushCachePolicy?: string;
  rushCacheProvider?: string;
  toolchainImagePolicy?: string;
  toolchainImageProvider?: string;
};

export type RushProviderOptions = {
  rushCachePolicy: RushCachePolicy;
  rushCacheProvider: RushCacheProvider;
  rushCacheProviders: RushCacheProvidersDefinition;
  toolchainImagePolicy: ToolchainImagePolicy;
  toolchainImageProvider: ToolchainImageProvider;
  toolchainImageProviders?: ToolchainImageProvidersDefinition;
};

export function requiresRushCacheProviderMetadata(
  input: RushProviderInput = {},
): boolean {
  return parseRushCacheProvider(input.rushCacheProvider ?? "off") !== "off";
}

const disabledRushCacheProviders: RushCacheProvidersDefinition = {
  cache: {
    paths: [],
    version: "off",
  },
  providers: {},
};

export async function resolveRushProviderOptions(
  repo: Directory,
  input: RushProviderInput = {},
): Promise<RushProviderOptions> {
  const toolchainImageProvider = parseToolchainImageProvider(
    input.toolchainImageProvider ?? "off",
  );
  const toolchainImagePolicy = parseToolchainImagePolicy(
    input.toolchainImagePolicy ?? "lazy",
  );
  const rushCacheProvider = parseRushCacheProvider(
    input.rushCacheProvider ?? "off",
  );
  const rushCachePolicy = parseRushCachePolicy(input.rushCachePolicy ?? "lazy");
  const toolchainImageProviders =
    toolchainImageProvider === "off"
      ? undefined
      : parseToolchainImageProviders(
          await repo.file(toolchainImageProvidersPath).contents(),
        );
  const rushCacheProviders =
    rushCacheProvider === "off"
      ? disabledRushCacheProviders
      : parseRushCacheProviders(
          await repo.file(rushCacheProvidersPath).contents(),
        );

  return {
    rushCachePolicy,
    rushCacheProvider,
    rushCacheProviders,
    toolchainImagePolicy,
    toolchainImageProvider,
    toolchainImageProviders,
  };
}

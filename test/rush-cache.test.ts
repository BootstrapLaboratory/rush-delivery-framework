import * as assert from "node:assert/strict";
import { test } from "node:test";
import type { Directory } from "@dagger.io/dagger";

import { resolveRushProviderOptions } from "../src/rush/provider-options.ts";
import { buildGithubRushCacheReference } from "../src/rush-cache/github-reference.ts";
import {
  parseRushCachePolicy,
  parseRushCacheProvider,
} from "../src/rush-cache/options.ts";
import { parseRushCacheProviders } from "../src/rush-cache/parse-providers.ts";
import {
  buildGithubRushCacheResolvePlan,
  buildRushCacheArchiveCommand,
  buildRushCacheRestoreCommand,
  isMissingRushCacheImageError,
  shouldPublishRushCache,
} from "../src/rush-cache/resolve-plan.ts";
import {
  buildRushCacheSpec,
  normalizeRushCacheSpec,
  RUSH_CACHE_TAG_PATTERN,
  rushCacheTag,
} from "../src/rush-cache/spec.ts";

function fakeDirectory(files: Record<string, string>): Directory {
  return {
    file(filePath: string) {
      return {
        async contents() {
          const contents = files[filePath];

          if (contents === undefined) {
            throw new Error(`Unexpected file read: ${filePath}`);
          }

          return contents;
        },
      };
    },
  } as unknown as Directory;
}

test("parses GitHub Rush cache provider metadata", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    registry: ghcr.io
    image_namespace: custom-caches
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers, {
    cache: {
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    providers: {
      github: {
        image_namespace: "custom-caches",
        kind: "github_container_registry",
        registry: "ghcr.io",
        repository_env: "GITHUB_REPOSITORY",
        token_env: "GITHUB_TOKEN",
        username_env: "GITHUB_ACTOR",
      },
    },
  });
});

test("fills GitHub Rush cache provider metadata defaults", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers.cache, {
    paths: ["common/temp/node_modules"],
    version: "v1",
  });
  assert.deepStrictEqual(providers.providers.github, {
    image_namespace: "rush-delivery-caches",
    kind: "github_container_registry",
    registry: "ghcr.io",
    repository_env: "GITHUB_REPOSITORY",
    token_env: "GITHUB_TOKEN",
    username_env: "GITHUB_ACTOR",
  });
});

test("resolves Rush cache provider off without provider metadata", async () => {
  const options = await resolveRushProviderOptions(fakeDirectory({}), {
    rushCacheProvider: "off",
    toolchainImageProvider: "off",
  });

  assert.equal(options.rushCacheProvider, "off");
  assert.deepEqual(options.rushCacheProviders, {
    cache: {
      paths: [],
      version: "off",
    },
    providers: {},
  });
});

test("fails when Rush cache config contains key_files", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers: {}
`),
    /Rush cache config has unsupported field: key_files\./,
  );
});

test("allows repository-relative Rush cache paths", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers: {}
`);

  assert.deepStrictEqual(providers.cache.paths, ["common/temp/node_modules"]);
});

test("fails when Rush cache paths are absolute", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - /workspace/common/temp
providers: {}
`),
    /paths\[0\] must be a repository-relative path/,
  );
});

test("fails when Rush cache provider metadata contains unsupported providers", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  gitlab:
    kind: gitlab_container_registry
`),
    /Rush cache providers has unsupported field: gitlab\./,
  );
});

test("fails when GitHub Rush cache provider env names are invalid", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: github_repository
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`),
    /repository_env "github_repository" must match/,
  );
});

test("normalizes Rush cache specs for stable cache identity", () => {
  const config = {
    paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
    version: "v1",
  };
  const left = buildRushCacheSpec({
    config,
  });
  const right = buildRushCacheSpec({
    config: {
      ...config,
      paths: ["common/temp/pnpm-store", "common/temp/node_modules"],
    },
  });

  assert.deepStrictEqual(normalizeRushCacheSpec(left), {
    paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
    version: "v1",
  });
  assert.deepStrictEqual(
    normalizeRushCacheSpec(left),
    normalizeRushCacheSpec(right),
  );
  assert.equal(rushCacheTag(left), "v1");
});

test("keeps Rush cache tag stable when cache paths change", () => {
  const baseSpec = buildRushCacheSpec({
    config: {
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
  });
  const changedSpec = buildRushCacheSpec({
    config: {
      paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
      version: "v1",
    },
  });

  assert.equal(rushCacheTag(baseSpec), rushCacheTag(changedSpec));
});

test("rejects Rush cache versions that cannot be OCI tags", () => {
  assert.throws(
    () =>
      rushCacheTag(
        buildRushCacheSpec({
          config: {
            paths: ["common/temp/node_modules"],
            version: "rush cache/v1",
          },
        }),
      ),
    /must match/,
  );
  assert.match("v1", RUSH_CACHE_TAG_PATTERN);
});

test("changes the Rush cache tag when cache version changes", () => {
  const left = buildRushCacheSpec({
    config: {
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
  });
  const right = buildRushCacheSpec({
    config: {
      paths: ["common/temp/node_modules"],
      version: "v2",
    },
  });

  assert.notEqual(rushCacheTag(left), rushCacheTag(right));
});

test("builds a default GitHub Container Registry Rush cache reference", () => {
  const spec = buildRushCacheSpec({
    config: {
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
  });
  const reference = buildGithubRushCacheReference({
    repository: "BeltOrg/beltapp",
    tag: rushCacheTag(spec),
  });

  assert.deepStrictEqual(reference, {
    imagePath: "beltorg/beltapp/rush-delivery-caches/rush-install",
    reference: `ghcr.io/beltorg/beltapp/rush-delivery-caches/rush-install:${rushCacheTag(spec)}`,
    registry: "ghcr.io",
    repository: "beltorg/beltapp",
    tag: rushCacheTag(spec),
  });
});

test("fails when GitHub Rush cache repository is not owner/repo", () => {
  assert.throws(
    () =>
      buildGithubRushCacheReference({
        repository: "beltapp",
        tag: "sha256-abc123",
      }),
    /must use owner\/repo form/,
  );
});

test("builds Rush cache archive and restore commands", () => {
  assert.equal(
    buildRushCacheArchiveCommand([
      "common/temp/node_modules",
      "common/temp/pnpm-store",
    ]),
    "set -euo pipefail && tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -C '/workspace' -cf - 'common/temp/node_modules' 'common/temp/pnpm-store' | gzip -9 -n > '/tmp/rush-cache.tar.gz' && printf '[rush-cache] created archive size: %s bytes\\n' \"$(stat -c %s '/tmp/rush-cache.tar.gz')\"",
  );
  assert.equal(
    buildRushCacheRestoreCommand(),
    "set -euo pipefail && printf '[rush-cache] restore archive size: %s bytes\\n' \"$(stat -c %s '/tmp/rush-cache.tar.gz')\" && tar -xzf '/tmp/rush-cache.tar.gz' -C '/workspace'",
  );
});

test("fails when building a Rush cache archive command without paths", () => {
  assert.throws(
    () => buildRushCacheArchiveCommand([]),
    /requires at least one path/,
  );
});

test("builds a GitHub Rush cache resolve plan from provider metadata", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);
  const spec = buildRushCacheSpec({
    config: providers.cache,
  });
  const plan = buildGithubRushCacheResolvePlan(spec, providers, {
    GITHUB_ACTOR: "octocat",
    GITHUB_REPOSITORY: "BeltOrg/beltapp",
    GITHUB_TOKEN: "secret-token",
  });

  assert.deepStrictEqual(plan, {
    reference: {
      imagePath: "beltorg/beltapp/rush-delivery-caches/rush-install",
      reference: `ghcr.io/beltorg/beltapp/rush-delivery-caches/rush-install:v1`,
      registry: "ghcr.io",
      repository: "beltorg/beltapp",
      tag: "v1",
    },
    registryAuth: {
      address: "ghcr.io",
      token: "secret-token",
      tokenSecretName: "rush-cache-github-token",
      username: "octocat",
    },
  });
});

test("fails when GitHub Rush cache provider env is missing", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);
  const spec = buildRushCacheSpec({
    config: providers.cache,
  });

  assert.throws(
    () => buildGithubRushCacheResolvePlan(spec, providers, {}),
    /requires host env GITHUB_REPOSITORY/,
  );
});

test("detects missing Rush cache image errors without hiding auth failures", () => {
  assert.equal(
    isMissingRushCacheImageError(new Error("manifest unknown")),
    true,
  );
  assert.equal(
    isMissingRushCacheImageError(new Error("pull access denied")),
    false,
  );
});

test("parses supported Rush cache options", () => {
  assert.equal(parseRushCacheProvider("off"), "off");
  assert.equal(parseRushCacheProvider("github"), "github");
  assert.equal(parseRushCachePolicy("lazy"), "lazy");
  assert.equal(parseRushCachePolicy("pull-or-build"), "pull-or-build");
});

test("plans Rush cache publishing from policy", () => {
  assert.equal(shouldPublishRushCache("lazy"), true);
  assert.equal(shouldPublishRushCache("pull-or-build"), false);
});

test("rejects unsupported Rush cache options", () => {
  assert.throws(
    () => parseRushCacheProvider("gitlab"),
    /Unsupported Rush cache provider "gitlab"\./,
  );
  assert.throws(
    () => parseRushCachePolicy("prewarm"),
    /Unsupported Rush cache policy "prewarm"\./,
  );
});

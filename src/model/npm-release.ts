export type NpmReleaseVersioningStrategy = "rush-change-files";

export type NpmReleaseVersioning = {
  strategy: NpmReleaseVersioningStrategy;
  target_branch: string;
};

export type NpmReleaseAuth = {
  kind: "token";
  token_env: string;
};

export type NpmReleasePublish = {
  access?: "public" | "restricted";
  provenance: boolean;
  registry: string;
  tag: string;
};

export type NpmReleaseDefinition = {
  auth: NpmReleaseAuth;
  kind: "npm";
  publish: NpmReleasePublish;
  versioning: NpmReleaseVersioning;
};

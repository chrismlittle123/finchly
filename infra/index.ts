import { defineConfig, createDatabase } from "@palindrom-ai/infra";

defineConfig({
  cloud: "aws",
  region: "eu-west-2",
  project: "finchly",
  environment: process.env.PULUMI_STACK || "dev",
});

const db = createDatabase("main", {
  size: "small",
  public: true, // needed for cross-cloud access from GCP Cloud Run
});

export const dbHost = db.host;
export const dbPort = db.port;
export const dbDatabase = db.database;
export const dbPasswordSecretArn = db.passwordSecretArn;

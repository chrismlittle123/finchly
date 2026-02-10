import { defineConfig, createDatabase } from "@palindrom-ai/infra";
import * as aws from "@pulumi/aws";
import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

// =============================================================================
// Configuration
// =============================================================================

const gcpConfig = new pulumi.Config("gcp");
const config = new pulumi.Config();

const gcpRegion = gcpConfig.require("region");
const gcpProject = gcpConfig.require("project");
const environment = process.env.PULUMI_STACK || "dev";

const imageTag = config.get("imageTag") || "latest";

// =============================================================================
// AWS — RDS Database (existing)
// =============================================================================

defineConfig({
  cloud: "aws",
  region: "eu-west-2",
  project: "finchly",
  environment,
});

const db = createDatabase("main", {
  size: "small",
  public: true,
});

// =============================================================================
// Build DATABASE_URL from RDS outputs + password from AWS Secrets Manager
// =============================================================================

const dbPassword = aws.secretsmanager.getSecretVersionOutput({
  secretId: db.passwordSecretArn,
}).apply(v => v.secretString);

const databaseUrl = pulumi.interpolate`postgresql://postgres:${dbPassword}@${db.host}:${db.port}/${db.database}?sslmode=require`;

// =============================================================================
// GCP — Artifact Registry
// =============================================================================

const artifactRegistry = new gcp.artifactregistry.Repository("finchly-repo", {
  repositoryId: "finchly",
  location: gcpRegion,
  format: "DOCKER",
  description: "Docker images for finchly-api",
}, {
  protect: true,
});

// =============================================================================
// GCP — Secrets
// =============================================================================

const databaseUrlSecret = new gcp.secretmanager.Secret("database-url", {
  secretId: `finchly-database-url-${environment}`,
  replication: { auto: {} },
});

new gcp.secretmanager.SecretVersion("database-url-version", {
  secret: databaseUrlSecret.id,
  secretData: databaseUrl,
});

const slackBotTokenSecret = new gcp.secretmanager.Secret("slack-bot-token", {
  secretId: `finchly-slack-bot-token-${environment}`,
  replication: { auto: {} },
});

const slackSigningSecretSecret = new gcp.secretmanager.Secret("slack-signing-secret", {
  secretId: `finchly-slack-signing-secret-${environment}`,
  replication: { auto: {} },
});

const slackChannelIdSecret = new gcp.secretmanager.Secret("slack-channel-id", {
  secretId: `finchly-slack-channel-id-${environment}`,
  replication: { auto: {} },
});

const jwtSecretSecret = new gcp.secretmanager.Secret("jwt-secret", {
  secretId: `finchly-jwt-secret-${environment}`,
  replication: { auto: {} },
});

const allSecrets = [
  databaseUrlSecret,
  slackBotTokenSecret,
  slackSigningSecretSecret,
  slackChannelIdSecret,
  jwtSecretSecret,
];

// =============================================================================
// GCP — Service Account & IAM
// =============================================================================

const containerName = `finchly-api-${environment}`;

const serviceAccount = new gcp.serviceaccount.Account("finchly-api-sa", {
  accountId: containerName.substring(0, 28),
  displayName: `Service account for ${containerName}`,
});

allSecrets.forEach((secret, index) => {
  new gcp.secretmanager.SecretIamMember(`secret-access-${index}`, {
    secretId: secret.id,
    role: "roles/secretmanager.secretAccessor",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
  });
});

// =============================================================================
// GCP — Cloud Run Service
// =============================================================================

const service = new gcp.cloudrunv2.Service("finchly-api", {
  name: containerName,
  location: gcpRegion,
  ingress: "INGRESS_TRAFFIC_ALL",
  deletionProtection: false,
  template: {
    serviceAccount: serviceAccount.email,
    maxInstanceRequestConcurrency: 80,
    scaling: {
      minInstanceCount: 0,
      maxInstanceCount: 3,
    },
    containers: [{
      image: `${gcpRegion}-docker.pkg.dev/${gcpProject}/finchly/api:${imageTag}`,
      ports: { containerPort: 3001 },
      resources: {
        limits: { cpu: "1", memory: "512Mi" },
        cpuIdle: true,
      },
      envs: [
        {
          name: "DATABASE_URL",
          valueSource: { secretKeyRef: { secret: databaseUrlSecret.secretId, version: "latest" } },
        },
        {
          name: "JWT_SECRET",
          valueSource: { secretKeyRef: { secret: jwtSecretSecret.secretId, version: "latest" } },
        },
        // TODO: Uncomment when Slack app is configured with real secret values
        // {
        //   name: "SLACK_BOT_TOKEN",
        //   valueSource: { secretKeyRef: { secret: slackBotTokenSecret.secretId, version: "latest" } },
        // },
        // {
        //   name: "SLACK_SIGNING_SECRET",
        //   valueSource: { secretKeyRef: { secret: slackSigningSecretSecret.secretId, version: "latest" } },
        // },
        // {
        //   name: "SLACK_CHANNEL_ID",
        //   valueSource: { secretKeyRef: { secret: slackChannelIdSecret.secretId, version: "latest" } },
        // },
      ],
    }],
  },
  traffics: [{
    type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
    percent: 100,
  }],
});

// Allow unauthenticated access
new gcp.cloudrunv2.ServiceIamMember("finchly-api-invoker", {
  name: service.name,
  location: gcpRegion,
  role: "roles/run.invoker",
  member: "allUsers",
});

// =============================================================================
// Exports
// =============================================================================

// AWS
export const dbHost = db.host;
export const dbPort = db.port;
export const dbDatabase = db.database;
export const dbPasswordSecretArn = db.passwordSecretArn;

// GCP
export const serviceUrl = service.uri;
export const serviceAccountEmail = serviceAccount.email;
export const artifactRegistryUrl = pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/${artifactRegistry.repositoryId}`;

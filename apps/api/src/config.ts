import { z } from "@palindrom/fastify-api";
import type { AppConfigInput } from "@palindrom/fastify-api";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-").optional(),
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  SLACK_CHANNEL_ID: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.string().default("development"),
});

export type FinchlyEnv = z.infer<typeof envSchema>;

export function loadConfig(): { appConfig: AppConfigInput; env: FinchlyEnv } {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  }

  const env = result.data;

  const appConfig: AppConfigInput = {
    name: "finchly-api",
    server: {
      port: env.PORT,
      host: env.HOST,
    },
    auth: {
      jwt: {
        secret: env.JWT_SECRET,
        issuer: "finchly",
      },
    },
    docs: {
      title: "Finchly API",
      version: "1.0.0",
      path: "/docs",
    },
    logging: {
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV !== "production",
    },
  };

  return { appConfig, env };
}

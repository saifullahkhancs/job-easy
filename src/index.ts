import { Container, getRandom } from "@cloudflare/containers";
import { env as workerEnv } from "cloudflare:workers";

const INSTANCE_COUNT = 1;

const PASSTHROUGH_ENV_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_ALGORITHM",
  "ACCESS_TOKEN_EXPIRE_MINUTES",
  "REFRESH_TOKEN_EXPIRE_DAYS",
  "PASSWORD_RESET_TOKEN_EXPIRE_MINUTES",
  "PASSWORD_RESET_URL",
  "APP_ENCRYPTION_KEY",
  "BACKEND_CORS_ORIGINS",
  "CORS_ORIGINS",
  "ENVIRONMENT",
  "DEBUG",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "SMTP_USE_TLS",
  "SMTP_USE_SSL",
  "RATE_LIMIT_ENABLED",
  "RATE_LIMIT_REQUESTS",
  "RATE_LIMIT_PERIOD",
] as const;

function buildContainerEnvVars(): Record<string, string> {
  const runtimeEnv = workerEnv as Record<string, unknown>;
  const containerEnv: Record<string, string> = {
    ENVIRONMENT: "production",
    DEBUG: "false",
  };

  for (const key of PASSTHROUGH_ENV_KEYS) {
    const value = runtimeEnv[key];
    if (typeof value === "string" && value.length > 0) {
      containerEnv[key] = value;
    }
  }

  return containerEnv;
}

export class BackendContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
  pingEndpoint = "localhost/api/health";
  envVars = buildContainerEnvVars();
}

interface Env {
  BACKEND_CONTAINER: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = await getRandom(env.BACKEND_CONTAINER, INSTANCE_COUNT);
    return container.fetch(request);
  },
};

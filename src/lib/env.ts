import env from "env-var";

export type Env = {
  LUMA_CALENDAR_ID: string;
  LUMA_WEBHOOK_SECRET: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  DISCORD_EVENTS_WEBHOOK_URL: string;
  DISCORD_LOGGING_WEBHOOK_URL: string;
  DISCORD_MOD_ROLE_ID: string;
  POSTGRES_URL: string;
  APP_URL: string;
  EMAIL_ENABLED: boolean;
  SESSION_SECRET: string;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_RP_NAME: string;
  SUBSTACK_API_KEY?: string;
  CRON_SECRET?: string;
  ADMIN_API_KEY?: string;
  VERCEL: string | undefined;
};

const config: Env = {
  LUMA_CALENDAR_ID: env.get("LUMA_CALENDAR_ID").required().asString(),
  LUMA_WEBHOOK_SECRET: env.get("LUMA_WEBHOOK_SECRET").required().asString(),
  AWS_ACCESS_KEY_ID: env.get("AWS_ACCESS_KEY_ID").required().asString(),
  AWS_SECRET_ACCESS_KEY: env.get("AWS_SECRET_ACCESS_KEY").required().asString(),
  AWS_REGION: env.get("AWS_REGION").default("us-east-1").asString(),
  DISCORD_EVENTS_WEBHOOK_URL: env
    .get("DISCORD_EVENTS_WEBHOOK_URL")
    .required()
    .asUrlString(),
  DISCORD_LOGGING_WEBHOOK_URL: env
    .get("DISCORD_LOGGING_WEBHOOK_URL")
    .required()
    .asUrlString(),
  DISCORD_MOD_ROLE_ID: env.get("DISCORD_MOD_ROLE_ID").required().asString(),
  POSTGRES_URL: env.get("POSTGRES_URL").required().asString(),
  APP_URL: env.get("APP_URL").required().asUrlString(),
  EMAIL_ENABLED: env.get("EMAIL_ENABLED").default("false").asBool(),
  SESSION_SECRET: env.get("SESSION_SECRET").required().asString(),
  WEBAUTHN_RP_ID: env.get("WEBAUTHN_RP_ID").asString(),
  WEBAUTHN_RP_NAME: env
    .get("WEBAUTHN_RP_NAME")
    .default("Fractal Events")
    .asString(),
  SUBSTACK_API_KEY: env.get("SUBSTACK_API_KEY").asString(),
  CRON_SECRET: env.get("CRON_SECRET").asString(),
  ADMIN_API_KEY: env.get("ADMIN_API_KEY").asString(),
  VERCEL: env.get("VERCEL").asString(),
};

export { config as env };

export function isDevelopment(): boolean {
  return config.VERCEL === undefined;
}

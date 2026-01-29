import env from "env-var";

export type Env = {
  LUMA_CALENDAR_ID: string;
  LUMA_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  DISCORD_EVENTS_WEBHOOK_URL: string;
  DISCORD_LOGGING_WEBHOOK_URL: string;
  DISCORD_MOD_ROLE_ID: string;
  POSTGRES_URL: string;
  SUBSCRIBE_API_KEY: string;
  APP_URL: string;
  EMAIL_ENABLED: boolean;
  SUBSTACK_API_KEY?: string;
  CRON_SECRET?: string;
};

const config: Env = {
  LUMA_CALENDAR_ID: env.get("LUMA_CALENDAR_ID").required().asString(),
  LUMA_WEBHOOK_SECRET: env.get("LUMA_WEBHOOK_SECRET").required().asString(),
  RESEND_API_KEY: env.get("RESEND_API_KEY").required().asString(),
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
  SUBSCRIBE_API_KEY: env.get("SUBSCRIBE_API_KEY").required().asString(),
  APP_URL: env.get("APP_URL").required().asUrlString(),
  EMAIL_ENABLED: env.get("EMAIL_ENABLED").default("false").asBool(),
  SUBSTACK_API_KEY: env.get("SUBSTACK_API_KEY").asString(),
  CRON_SECRET: env.get("CRON_SECRET").asString(),
};

export { config as env };

import env from 'env-var'

export type Env = {
  LUMA_API_KEY: string
  LUMA_CALENDAR_ID: string
  LUMA_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  DISCORD_WEBHOOK_URL: string
  DISCORD_MOD_ROLE_ID: string
  DATABASE_URL: string
  SUBSCRIBE_API_KEY: string
  APP_URL: string
  CRON_SECRET?: string
}

// Validate and export all environment variables
const config: Env = {
  LUMA_API_KEY: env.get('LUMA_API_KEY').required().asString(),
  LUMA_CALENDAR_ID: env.get('LUMA_CALENDAR_ID').required().asString(),
  LUMA_WEBHOOK_SECRET: env.get('LUMA_WEBHOOK_SECRET').required().asString(),
  RESEND_API_KEY: env.get('RESEND_API_KEY').required().asString(),
  DISCORD_WEBHOOK_URL: env.get('DISCORD_WEBHOOK_URL').required().asUrlString(),
  DISCORD_MOD_ROLE_ID: env.get('DISCORD_MOD_ROLE_ID').required().asString(),
  DATABASE_URL: env.get('DATABASE_URL').required().asString(),
  SUBSCRIBE_API_KEY: env.get('SUBSCRIBE_API_KEY').required().asString(),
  APP_URL: env.get('APP_URL').required().asUrlString(),
  CRON_SECRET: env.get('CRON_SECRET').asString(),
}

export { config as env }

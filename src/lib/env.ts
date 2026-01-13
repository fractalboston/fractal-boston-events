import { z } from 'zod'

const envSchema = z.object({
  LUMA_API_KEY: z.string().min(1),
  LUMA_CALENDAR_ID: z.string().min(1),
  LUMA_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  DISCORD_WEBHOOK_URL: z.string().url(),
  DISCORD_MOD_ROLE_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUBSCRIBE_API_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  return parsed.data
}

export const env = validateEnv()

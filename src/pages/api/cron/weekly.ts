import type { NextApiRequest, NextApiResponse } from 'next'
import { validateCronSecret } from '@/lib/auth'
import { sendSuccess, sendMethodNotAllowed, sendInternalError } from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { getAllVerifiedSubscribers } from '@/lib/subscribers'
import { sendBatchEmails } from '@/lib/email'
import {
  sendDiscordWeeklySummary,
  sendDiscordEmailJobStats,
  sendDiscordError,
} from '@/lib/discord'
import { fetchUpcomingEvents } from '@/lib/luma'
import { env } from '@/lib/env'

type CronResponse = {
  message: string
  eventsCount: number
  emailsSent: number
  emailsFailed: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<CronResponse> | ApiErrorResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    sendMethodNotAllowed(res)
    return
  }

  if (!validateCronSecret(req, res)) {
    return
  }

  try {
    const { LUMA_API_KEY, LUMA_CALENDAR_ID, DISCORD_WEBHOOK_URL, DISCORD_MOD_ROLE_ID, APP_URL } = env

    // Fetch upcoming events
    const events = await fetchUpcomingEvents(LUMA_API_KEY, LUMA_CALENDAR_ID)

    // Post to Discord
    try {
      await sendDiscordWeeklySummary(DISCORD_WEBHOOK_URL, events, DISCORD_MOD_ROLE_ID)
    } catch (discordError) {
      console.error('Failed to post to Discord:', discordError)
    }

    // Get all verified subscribers
    const subscribers = await getAllVerifiedSubscribers()

    // Send weekly digest to all subscribers
    const { success, failed } = await sendBatchEmails(
      subscribers,
      events,
      APP_URL,
      'weekly',
      undefined,
      DISCORD_WEBHOOK_URL
    )

    // Send job stats to Discord
    try {
      // Resend free tier: 3000 emails/month, 100/day
      // Estimate monthly usage: 4 weeks * subscribers
      const estimatedMonthlyUsage = subscribers.length * 4
      await sendDiscordEmailJobStats(DISCORD_WEBHOOK_URL, {
        emailsSent: success,
        emailsFailed: failed,
        eventsCount: events.length,
        subscribersCount: subscribers.length,
        resendMonthlyLimit: 3000,
        resendMonthlyUsed: estimatedMonthlyUsage,
      })
    } catch (discordError) {
      console.error('Failed to send stats to Discord:', discordError)
    }

    sendSuccess(res, {
      message: 'Weekly digest sent',
      eventsCount: events.length,
      emailsSent: success,
      emailsFailed: failed,
    })
  } catch (error) {
    console.error('Weekly cron error:', error)

    // Log error to Discord
    try {
      await sendDiscordError(
        env.DISCORD_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        'Weekly cron job error'
      )
    } catch (discordError) {
      console.error('Failed to log error to Discord:', discordError)
    }

    sendInternalError(res, 'Failed to run weekly digest')
  }
}

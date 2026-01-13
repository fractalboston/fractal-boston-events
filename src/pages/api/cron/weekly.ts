import type { NextApiRequest, NextApiResponse } from 'next'
import { validateCronSecret } from '@/lib/auth'
import { sendSuccess, sendMethodNotAllowed, sendInternalError } from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { getAllVerifiedSubscribers } from '@/lib/subscribers'
import { sendBatchEmails } from '@/lib/email'
import { sendDiscordWeeklySummary } from '@/lib/discord'
import { fetchUpcomingEvents } from '@/lib/luma'

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
    const lumaApiKey = process.env.LUMA_API_KEY
    const lumaCalendarId = process.env.LUMA_CALENDAR_ID
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    const discordModRoleId = process.env.DISCORD_MOD_ROLE_ID
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

    if (lumaApiKey === undefined || lumaCalendarId === undefined) {
      sendInternalError(res, 'Missing Luma API configuration')
      return
    }

    // Fetch upcoming events
    const events = await fetchUpcomingEvents(lumaApiKey, lumaCalendarId)

    // Post to Discord
    if (discordWebhookUrl !== undefined) {
      try {
        await sendDiscordWeeklySummary(discordWebhookUrl, events, discordModRoleId)
      } catch (discordError) {
        console.error('Failed to post to Discord:', discordError)
      }
    }

    // Get all verified subscribers
    const subscribers = await getAllVerifiedSubscribers()

    // Send weekly digest to all subscribers
    const { success, failed } = await sendBatchEmails(subscribers, events, appUrl, 'weekly')

    sendSuccess(res, {
      message: 'Weekly digest sent',
      eventsCount: events.length,
      emailsSent: success,
      emailsFailed: failed,
    })
  } catch (error) {
    console.error('Weekly cron error:', error)
    sendInternalError(res, 'Failed to run weekly digest')
  }
}

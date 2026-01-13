import type { NextApiRequest, NextApiResponse } from 'next'
import { validateLumaWebhook } from '@/lib/auth'
import {
  sendSuccess,
  sendMethodNotAllowed,
  sendInternalError,
  sendBadRequest,
} from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { getAllVerifiedSubscribers } from '@/lib/subscribers'
import { sendBatchEmails } from '@/lib/email'
import { sendDiscordNewEventAlert } from '@/lib/discord'
import { parseLumaEventCreatedWebhook, isEventWithinNextWeek } from '@/lib/luma'
import { ZodError } from 'zod'

type WebhookResponse = {
  message: string
  emailsSent?: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<WebhookResponse> | ApiErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res)
    return
  }

  if (!validateLumaWebhook(req, res)) {
    return
  }

  try {
    const payload = parseLumaEventCreatedWebhook(req.body)
    const event = payload.data.event

    // Check if event is within the next week
    if (!isEventWithinNextWeek(event)) {
      sendSuccess(res, { message: 'Event is not within the next week, skipping notification' })
      return
    }

    // Post to Discord
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (discordWebhookUrl !== undefined) {
      try {
        await sendDiscordNewEventAlert(discordWebhookUrl, event)
      } catch (discordError) {
        console.error('Failed to post to Discord:', discordError)
      }
    }

    // Email all verified subscribers
    const subscribers = await getAllVerifiedSubscribers()
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

    const { success } = await sendBatchEmails(subscribers, [], appUrl, 'new-event', event)

    sendSuccess(res, {
      message: `New event notification sent`,
      emailsSent: success,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      sendBadRequest(res, 'Invalid webhook payload')
      return
    }
    console.error('Luma event webhook error:', error)
    sendInternalError(res, 'Failed to process webhook')
  }
}

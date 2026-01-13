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
import { sendDiscordNewEventAlert, sendDiscordError } from '@/lib/discord'
import { parseLumaEventCreatedWebhook, isEventWithinNextWeek } from '@/lib/luma'
import { env } from '@/lib/env'
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

    // Post new event alert to Discord events channel
    try {
      await sendDiscordNewEventAlert(env.DISCORD_EVENTS_WEBHOOK_URL, event)
    } catch (discordError) {
      console.error('Failed to post to Discord:', discordError)
    }

    // Email all verified subscribers
    const subscribers = await getAllVerifiedSubscribers()

    const { success } = await sendBatchEmails(
      subscribers,
      [],
      env.APP_URL,
      'new-event',
      event,
      env.DISCORD_LOGGING_WEBHOOK_URL
    )

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

    // Log error to Discord logging channel
    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        'Luma event webhook error'
      )
    } catch (discordError) {
      console.error('Failed to log error to Discord:', discordError)
    }

    sendInternalError(res, 'Failed to process webhook')
  }
}

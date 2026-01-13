import type { NextApiRequest, NextApiResponse } from 'next'
import { validateLumaWebhook } from '@/lib/auth'
import {
  sendSuccess,
  sendMethodNotAllowed,
  sendInternalError,
  sendBadRequest,
} from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { createSubscriber, getSubscriberByEmail } from '@/lib/subscribers'
import { sendWelcomeEmail } from '@/lib/email'
import { fetchUpcomingEvents, parseLumaSubscriberWebhook } from '@/lib/luma'
import { sendDiscordError } from '@/lib/discord'
import { env } from '@/lib/env'
import { ZodError } from 'zod'

type WebhookResponse = {
  message: string
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
    const payload = parseLumaSubscriberWebhook(req.body)
    const email = payload.data.user.email

    // Check if already exists
    const existing = await getSubscriberByEmail(email)

    if (existing !== undefined) {
      sendSuccess(res, { message: 'Subscriber already exists' })
      return
    }

    // Create as verified (from Luma)
    const subscriber = await createSubscriber({
      email,
      source: 'luma',
      status: 'verified',
    })

    // Send welcome email with upcoming events
    try {
      const events = await fetchUpcomingEvents(env.LUMA_API_KEY, env.LUMA_CALENDAR_ID)
      await sendWelcomeEmail(subscriber.email, subscriber.token, events, env.APP_URL)
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
    }

    sendSuccess(res, { message: 'Subscriber added from Luma' })
  } catch (error) {
    if (error instanceof ZodError) {
      sendBadRequest(res, 'Invalid webhook payload')
      return
    }
    console.error('Luma subscriber webhook error:', error)

    // Log error to Discord logging channel
    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        'Luma subscriber webhook error'
      )
    } catch (discordError) {
      console.error('Failed to log error to Discord:', discordError)
    }

    sendInternalError(res, 'Failed to process webhook')
  }
}

import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendMethodNotAllowed,
  sendInternalError,
} from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { verifySubscriber, getSubscriberByToken } from '@/lib/subscribers'
import { sendWelcomeEmail } from '@/lib/email'
import { fetchUpcomingEvents } from '@/lib/luma'
import { sendDiscordError } from '@/lib/discord'
import { env } from '@/lib/env'

const verifySchema = z.object({
  token: z.string().uuid(),
})

type VerifyResponse = {
  message: string
  email: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<VerifyResponse> | ApiErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res)
    return
  }

  const parsed = verifySchema.safeParse(req.body)

  if (!parsed.success) {
    sendBadRequest(res, 'Invalid token')
    return
  }

  const { token } = parsed.data

  try {
    // Check current status
    const existing = await getSubscriberByToken(token)

    if (existing === undefined) {
      sendNotFound(res, 'Token not found')
      return
    }

    if (existing.status === 'verified') {
      sendSuccess(res, {
        message: 'Already verified',
        email: existing.email,
      })
      return
    }

    if (existing.status === 'unsubscribed') {
      sendBadRequest(res, 'This email has been unsubscribed')
      return
    }

    // Verify subscriber
    const subscriber = await verifySubscriber(token)

    if (subscriber === undefined) {
      sendNotFound(res, 'Token not found or already verified')
      return
    }

    // Fetch upcoming events and send welcome email
    try {
      const events = await fetchUpcomingEvents(env.LUMA_API_KEY, env.LUMA_CALENDAR_ID)
      await sendWelcomeEmail(subscriber.email, subscriber.token, events, env.APP_URL)
    } catch (emailError) {
      // Log but don't fail verification if welcome email fails
      console.error('Failed to send welcome email:', emailError)
    }

    sendSuccess(res, {
      message: 'Email verified successfully',
      email: subscriber.email,
    })
  } catch (error) {
    console.error('Verify error:', error)

    // Log error to Discord logging channel
    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        'Verify endpoint error'
      )
    } catch (discordError) {
      console.error('Failed to log error to Discord:', discordError)
    }

    sendInternalError(res, 'Failed to verify email')
  }
}

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
import { unsubscribe, getSubscriberByToken } from '@/lib/subscribers'
import { sendDiscordError } from '@/lib/discord'

const unsubscribeSchema = z.object({
  token: z.string().uuid(),
})

type UnsubscribeResponse = {
  message: string
  email: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UnsubscribeResponse> | ApiErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res)
    return
  }

  const parsed = unsubscribeSchema.safeParse(req.body)

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

    if (existing.status === 'unsubscribed') {
      sendSuccess(res, {
        message: 'Already unsubscribed',
        email: existing.email,
      })
      return
    }

    // Unsubscribe
    const subscriber = await unsubscribe(token)

    if (subscriber === undefined) {
      sendNotFound(res, 'Token not found')
      return
    }

    sendSuccess(res, {
      message: 'Successfully unsubscribed',
      email: subscriber.email,
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)

    // Log error to Discord
    const discordWebhookUrl = env.DISCORD_WEBHOOK_URL
    if (discordWebhookUrl !== undefined) {
      try {
        await sendDiscordError(
          discordWebhookUrl,
          error instanceof Error ? error : new Error(String(error)),
          'Unsubscribe endpoint error'
        )
      } catch (discordError) {
        console.error('Failed to log error to Discord:', discordError)
      }
    }

    sendInternalError(res, 'Failed to unsubscribe')
  }
}

import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { validateApiKey } from '@/lib/auth'
import {
  sendCreated,
  sendBadRequest,
  sendMethodNotAllowed,
  sendInternalError,
  sendSuccess,
} from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'
import { createSubscriber, getSubscriberByEmail, resubscribe } from '@/lib/subscribers'
import { sendVerificationEmail } from '@/lib/email'

const subscribeSchema = z.object({
  email: z.string().email(),
})

type SubscribeResponse = {
  message: string
  email: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SubscribeResponse> | ApiErrorResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res)
    return
  }

  if (!validateApiKey(req, res)) {
    return
  }

  const parsed = subscribeSchema.safeParse(req.body)

  if (!parsed.success) {
    sendBadRequest(res, 'Invalid email address')
    return
  }

  const { email } = parsed.data
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  try {
    // Check if already subscribed
    const existing = await getSubscriberByEmail(email)

    if (existing !== undefined) {
      if (existing.status === 'verified') {
        sendSuccess(res, {
          message: 'Already subscribed',
          email: existing.email,
        })
        return
      }

      if (existing.status === 'unsubscribed') {
        // Resubscribe
        const resubscribed = await resubscribe(email)
        if (resubscribed !== undefined) {
          sendSuccess(res, {
            message: 'Resubscribed successfully',
            email: resubscribed.email,
          })
          return
        }
      }

      if (existing.status === 'pending') {
        // Resend verification email
        await sendVerificationEmail(email, existing.token, appUrl)
        sendSuccess(res, {
          message: 'Verification email resent',
          email: existing.email,
        })
        return
      }
    }

    // Create new subscriber
    const subscriber = await createSubscriber({
      email,
      source: 'form',
      status: 'pending',
    })

    // Send verification email
    await sendVerificationEmail(email, subscriber.token, appUrl)

    sendCreated(res, {
      message: 'Verification email sent',
      email: subscriber.email,
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    sendInternalError(res, 'Failed to process subscription')
  }
}

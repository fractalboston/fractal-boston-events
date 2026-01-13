import type { NextApiRequest, NextApiResponse } from 'next'
import { sendUnauthorized } from '@/lib/api-response'
import type { ApiErrorResponse } from '@/lib/api-response'
import { env } from '@/lib/env'

export function validateApiKey(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>
): boolean {
  const apiKey = req.headers['x-api-key']

  if (typeof apiKey !== 'string' || apiKey !== env.SUBSCRIBE_API_KEY) {
    sendUnauthorized(res, 'Invalid or missing API key')
    return false
  }

  return true
}

export function validateCronSecret(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>
): boolean {
  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  const authHeader = req.headers.authorization

  if (typeof authHeader !== 'string' || authHeader !== `Bearer ${env.CRON_SECRET ?? ''}`) {
    sendUnauthorized(res, 'Invalid cron secret')
    return false
  }

  return true
}

export function validateLumaWebhook(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse>
): boolean {
  const signature = req.headers['x-luma-signature']

  // Luma sends a signature header for webhook verification
  // For now, we'll use a simple secret comparison
  // In production, implement proper HMAC verification
  const webhookSecret = env.LUMA_WEBHOOK_SECRET

  if (typeof signature !== 'string' || signature !== webhookSecret) {
    sendUnauthorized(res, 'Invalid webhook signature')
    return false
  }

  return true
}

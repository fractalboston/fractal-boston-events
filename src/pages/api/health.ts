import type { NextApiRequest, NextApiResponse } from 'next'
import { sendSuccess, sendMethodNotAllowed } from '@/lib/api-response'
import type { ApiResponse, ApiErrorResponse } from '@/lib/api-response'

type HealthResponse = {
  status: string
  timestamp: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<HealthResponse> | ApiErrorResponse>
): void {
  if (req.method !== 'GET') {
    sendMethodNotAllowed(res)
    return
  }

  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}

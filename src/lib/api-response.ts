import type { NextApiResponse } from 'next'

export type ApiSuccessResponse<T> = {
  success: true
  data: T
}

export type ApiErrorResponse = {
  success: false
  error: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function sendSuccess<T>(res: NextApiResponse<ApiResponse<T>>, data: T): void {
  res.status(200).json({ success: true, data })
}

export function sendCreated<T>(res: NextApiResponse<ApiResponse<T>>, data: T): void {
  res.status(201).json({ success: true, data })
}

export function sendError(
  res: NextApiResponse<ApiErrorResponse>,
  status: number,
  message: string
): void {
  res.status(status).json({ success: false, error: message })
}

export function sendBadRequest(res: NextApiResponse<ApiErrorResponse>, message: string): void {
  sendError(res, 400, message)
}

export function sendUnauthorized(res: NextApiResponse<ApiErrorResponse>, message: string): void {
  sendError(res, 401, message)
}

export function sendNotFound(res: NextApiResponse<ApiErrorResponse>, message: string): void {
  sendError(res, 404, message)
}

export function sendMethodNotAllowed(res: NextApiResponse<ApiErrorResponse>): void {
  sendError(res, 405, 'Method not allowed')
}

export function sendInternalError(res: NextApiResponse<ApiErrorResponse>, message: string): void {
  sendError(res, 500, message)
}

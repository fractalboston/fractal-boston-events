import { NextResponse } from "next/server";

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function sendSuccess<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

export function sendCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function sendError(
  status: number,
  message: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function sendBadRequest(
  message: string
): NextResponse<ApiErrorResponse> {
  return sendError(400, message);
}

export function sendUnauthorized(
  message: string
): NextResponse<ApiErrorResponse> {
  return sendError(401, message);
}

export function sendNotFound(message: string): NextResponse<ApiErrorResponse> {
  return sendError(404, message);
}

export function sendMethodNotAllowed(): NextResponse<ApiErrorResponse> {
  return sendError(405, "Method not allowed");
}

export function sendInternalError(
  message: string
): NextResponse<ApiErrorResponse> {
  return sendError(500, message);
}

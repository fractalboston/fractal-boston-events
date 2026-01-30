import { NextResponse } from "next/server";
import { HOMEPAGE_URL } from "@/lib/constants";

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
  const body: ApiSuccessResponse<T> = { success: true, data };
  return addCorsHeaders(
    NextResponse.json(body, { status: 200 }) as NextResponse<ApiResponse<T>>
  );
}

export function sendCreated<T>(data: T): NextResponse<ApiResponse<T>> {
  const body: ApiSuccessResponse<T> = { success: true, data };
  return addCorsHeaders(
    NextResponse.json(body, { status: 201 }) as NextResponse<ApiResponse<T>>
  );
}

export function sendError(
  status: number,
  message: string
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { success: false, error: message };
  return addCorsHeaders(
    NextResponse.json(body, {
      status,
    })
  );
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

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": HOMEPAGE_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function addCorsHeaders<T>(response: NextResponse<T>): NextResponse<T> {
  const headers = getCorsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function handleOptionsRequest(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

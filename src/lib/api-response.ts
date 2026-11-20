import { NextResponse } from "next/server";
import { z } from "zod";
import { HOMEPAGE_URL } from "@/lib/constants";
import { isDevelopment } from "@/lib/env";
import { subscriberTokenParamSchema } from "@/lib/subscriberToken";

export const subscribeBodySchema = z.union([
  z.object({
    email: z.email(),
    website: z.string().optional(),
  }),
  z.object({
    token: subscriberTokenParamSchema,
    confirmed: z.boolean().optional(),
  }),
]);

/** True when the signup honeypot field was filled in (typical of bots). */
export function isSubscribeHoneypotFilled(
  website: string | undefined
): boolean {
  return website !== undefined && website.trim() !== "";
}

export const verifyBodySchema = z.object({
  token: subscriberTokenParamSchema,
  confirmed: z.boolean().optional(),
});

export const unsubscribeBodySchema = z.object({
  token: subscriberTokenParamSchema,
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type VerifyBody = z.infer<typeof verifyBodySchema>;
export type UnsubscribeBody = z.infer<typeof unsubscribeBodySchema>;

export type SubscribeResponse = {
  message: string;
};

export type VerifyResponse = {
  message: string;
  email: string;
};

export type UnsubscribeResponse = {
  message: string;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  needsConfirmation?: true;
};

export const NEEDS_CONFIRMATION_MESSAGE =
  "Please confirm your subscription using the button on this page. If you don't see a button yet, reload this page in a few minutes to finish signing up.";

export function sendNeedsConfirmation(): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    error: NEEDS_CONFIRMATION_MESSAGE,
    needsConfirmation: true,
  };
  return addCorsHeaders(NextResponse.json(body, { status: 200 }));
}

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
  const allowAllOrigins = isDevelopment();
  return {
    "Access-Control-Allow-Origin": allowAllOrigins ? "*" : HOMEPAGE_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

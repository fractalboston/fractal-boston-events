import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendUnauthorized } from "@/lib/api-response";
import type { ApiErrorResponse } from "@/lib/api-response";
import { env } from "@/lib/env";

export async function validateApiKey(): Promise<NextResponse<ApiErrorResponse> | null> {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  if (typeof apiKey !== "string" || apiKey !== env.SUBSCRIBE_API_KEY) {
    return sendUnauthorized("Invalid or missing API key");
  }

  return null;
}

export async function validateCronSecret(): Promise<NextResponse<ApiErrorResponse> | null> {
  // In development, allow without secret
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  const headersList = await headers();

  const adminKey = headersList.get("x-admin-api-key") ?? "";
  if (adminKey) {
    if (adminKey === env.ADMIN_API_KEY) {
      return null;
    }
    return sendUnauthorized("Invalid admin API key");
  }

  const authHeader = headersList.get("authorization");

  if (
    typeof authHeader !== "string" ||
    authHeader !== `Bearer ${env.CRON_SECRET ?? ""}`
  ) {
    return sendUnauthorized("Invalid cron secret");
  }

  return null;
}

export async function validateLumaWebhook(): Promise<NextResponse<ApiErrorResponse> | null> {
  const headersList = await headers();
  const signature = headersList.get("x-luma-signature");

  // Luma sends a signature header for webhook verification
  // For now, we'll use a simple secret comparison
  // In production, implement proper HMAC verification
  const webhookSecret = env.LUMA_WEBHOOK_SECRET;

  if (typeof signature !== "string" || signature !== webhookSecret) {
    return sendUnauthorized("Invalid webhook signature");
  }

  return null;
}

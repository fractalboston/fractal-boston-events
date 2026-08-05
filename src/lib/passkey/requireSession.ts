import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/api-response";
import { sendUnauthorized } from "@/lib/api-response";
import { type SessionUser, getSessionUser } from "@/lib/passkey/session";

export async function requireSession(
  request: Request
): Promise<SessionUser | NextResponse<ApiErrorResponse>> {
  const user = await getSessionUser(request);
  if (!user) {
    return sendUnauthorized("Authentication required");
  }
  return user;
}

export function isSessionUser(
  value: SessionUser | NextResponse<ApiErrorResponse>
): value is SessionUser {
  return !(value instanceof NextResponse);
}

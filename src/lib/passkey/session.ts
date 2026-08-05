import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  getSessionSecret,
  shouldUseSecureCookies,
} from "@/lib/passkey/config";
import { deleteSession, getSessionById, getUserById } from "@/lib/passkey/db";

export type SessionUser = {
  id: string;
};

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function createSessionCookieHeader({
  sessionId,
  request,
}: {
  sessionId: string;
  request: Request;
}): string {
  const value = createSessionCookieValue(sessionId);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${String(maxAge)}`,
  ];
  if (shouldUseSecureCookies(request)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookieHeader(request: Request): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (shouldUseSecureCookies(request)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function parseSessionIdFromCookieHeader(
  cookieHeader: string | null
): string | null {
  if (cookieHeader === null || cookieHeader === "") {
    return null;
  }

  const prefix = `${SESSION_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const value = trimmed.slice(prefix.length);
    const dotIndex = value.lastIndexOf(".");
    if (dotIndex === -1) {
      return null;
    }
    const sessionId = value.slice(0, dotIndex);
    const signature = value.slice(dotIndex + 1);
    const expected = sign(sessionId);
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return null;
      }
    } catch {
      return null;
    }
    return sessionId;
  }

  return null;
}

export async function getSessionUserFromCookieHeader(
  cookieHeader: string | null
): Promise<SessionUser | null> {
  const sessionId = parseSessionIdFromCookieHeader(cookieHeader);
  if (sessionId === null) {
    return null;
  }

  const session = await getSessionById(sessionId);
  if (session === undefined) {
    return null;
  }

  if (session.expires_at.getTime() <= Date.now()) {
    await deleteSession(sessionId);
    return null;
  }

  const user = await getUserById(session.user_id);
  if (user === undefined) {
    return null;
  }

  return { id: user.id };
}

export async function getSessionUser(
  request: Request
): Promise<SessionUser | null> {
  return getSessionUserFromCookieHeader(request.headers.get("cookie"));
}

export async function endSession(request: Request): Promise<void> {
  const sessionId = parseSessionIdFromCookieHeader(
    request.headers.get("cookie")
  );
  if (sessionId !== null) {
    await deleteSession(sessionId);
  }
}

export function withSetCookie<T>(
  response: NextResponse<T>,
  cookie: string
): NextResponse<T> {
  response.headers.append("Set-Cookie", cookie);
  return response;
}

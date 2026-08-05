import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const BOOTSTRAP_USERNAME = "admin";
export const INVITE_LABEL_MAX_LENGTH = 120;

function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/:\d+$/, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function firstHeaderValue(value: string | null): string | null {
  if (value === null || value === "") {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  if (first === undefined || first === "") {
    return null;
  }
  return first;
}

/** Public site origin (scheme + host). Off-localhost always uses https. */
export function getPublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host")
  );
  const hostHeader = firstHeaderValue(request.headers.get("host"));
  const host =
    forwardedHost ??
    hostHeader ??
    (url.host !== "" ? url.host : new URL(env.APP_URL).host);

  const hostname = host.replace(/:\d+$/, "");
  const proto = isLocalHostname(hostname) ? "http" : "https";

  return `${proto}://${host}`;
}

export function getWebAuthnConfig(request: Request): {
  rpName: string;
  rpID: string;
  origin: string;
} {
  const origin = getPublicOrigin(request);
  const originHostname = new URL(origin).hostname;
  const rpID = env.WEBAUTHN_RP_ID ?? originHostname;
  const rpName = env.WEBAUTHN_RP_NAME;

  return { rpName, rpID, origin };
}

export function shouldUseSecureCookies(request: Request): boolean {
  return getPublicOrigin(request).startsWith("https://");
}

export function getSessionSecret(): string {
  return env.SESSION_SECRET;
}

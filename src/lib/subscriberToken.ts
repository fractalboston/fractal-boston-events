import { z } from "zod";

const HEX_TOKEN_PATTERN = /^[0-9a-f]{32}$/i;
const UUID_WITH_TRAILING_DASHES_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-+$/i;

/**
 * Trims input and removes trailing dashes accidentally copied after a UUID
 * (e.g. from the email footer rule "---" on the next line).
 */
export function normalizeSubscriberTokenInput(raw: string): string {
  const trimmed = raw.trim();
  if (UUID_WITH_TRAILING_DASHES_PATTERN.test(trimmed)) {
    return trimmed.replace(/-+$/, "");
  }
  return trimmed;
}

export function isHexSubscriberToken(value: string): boolean {
  return HEX_TOKEN_PATTERN.test(value);
}

export function isSubscriberUuid(value: string): boolean {
  return z.guid().safeParse(value).success;
}

export function isValidSubscriberTokenOrId(value: string): boolean {
  return isHexSubscriberToken(value) || isSubscriberUuid(value);
}

export const subscriberTokenParamSchema = z
  .string()
  .trim()
  .min(1, "Token is required")
  .transform(normalizeSubscriberTokenInput)
  .refine(isValidSubscriberTokenOrId, "Invalid token");

export const subscriberIdParamSchema = z
  .string()
  .trim()
  .min(1, "Id is required")
  .transform(normalizeSubscriberTokenInput)
  .pipe(z.guid("Invalid subscriber id"));

import { z } from "zod";

const UUID_WITH_TRAILING_DASHES_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-+$/i;

function isUuidShape(value: string): boolean {
  return z.guid().safeParse(value).success;
}

/**
 * Normalizes a public subscriber token (UUID-shaped, dashed).
 * Trims input and removes trailing dashes accidentally copied after a UUID
 * (e.g. from the email footer rule "---" on the next line).
 */
export function normalizeSubscriberTokenInput(raw: string): string {
  let trimmed = raw.trim();
  if (UUID_WITH_TRAILING_DASHES_PATTERN.test(trimmed)) {
    trimmed = trimmed.replace(/-+$/, "");
  }
  if (isUuidShape(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

/** Normalizes an internal admin subscriber id (never used in public URLs). */
export function normalizeSubscriberIdInput(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isSubscriberToken(value: string): boolean {
  return isUuidShape(value);
}

export function isSubscriberId(value: string): boolean {
  return isUuidShape(value);
}

export const subscriberTokenParamSchema = z
  .string()
  .trim()
  .min(1, "Token is required")
  .transform(normalizeSubscriberTokenInput)
  .refine(isSubscriberToken, "Invalid token");

export const subscriberIdParamSchema = z
  .string()
  .trim()
  .min(1, "Id is required")
  .transform(normalizeSubscriberIdInput)
  .pipe(z.guid("Invalid subscriber id"));

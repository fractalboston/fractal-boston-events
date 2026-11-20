import type { Subscriber, SubscriberStatus } from "@/db/db";
import { getSubscriberByToken, verifySubscriber } from "@/lib/subscribers";

/** Auto-POST is allowed only after this many seconds since the verification email was sent. */
export const VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS = 300;

export type VerificationDecision =
  | { kind: "already_verified" }
  | { kind: "not_pending"; status: SubscriberStatus }
  | { kind: "needs_confirmation" }
  | { kind: "verify" };

export function isInsideVerificationConfirmWindow({
  verificationSentAt,
  now = new Date(),
  windowSeconds = VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS,
}: {
  verificationSentAt: Date | null;
  now?: Date;
  windowSeconds?: number;
}): boolean {
  if (verificationSentAt === null) {
    return true;
  }
  return now.getTime() - verificationSentAt.getTime() < windowSeconds * 1000;
}

export function evaluateVerificationAttempt({
  status,
  verificationSentAt,
  confirmed,
  now = new Date(),
  windowSeconds = VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS,
}: {
  status: SubscriberStatus;
  verificationSentAt: Date | null;
  confirmed: boolean;
  now?: Date;
  windowSeconds?: number;
}): VerificationDecision {
  if (status === "verified") {
    return { kind: "already_verified" };
  }
  if (status !== "pending") {
    return { kind: "not_pending", status };
  }
  if (
    !confirmed &&
    isInsideVerificationConfirmWindow({
      verificationSentAt,
      now,
      windowSeconds,
    })
  ) {
    return { kind: "needs_confirmation" };
  }
  return { kind: "verify" };
}

export type ProcessVerificationResult =
  | {
      kind: "already_verified";
      subscriber: Subscriber;
    }
  | { kind: "verified"; subscriber: Subscriber }
  | { kind: "not_found" }
  | { kind: "not_pending"; status: SubscriberStatus }
  | { kind: "needs_confirmation" };

export async function processVerificationRequest({
  token,
  confirmed,
  now,
}: {
  token: string;
  confirmed: boolean;
  now?: Date;
}): Promise<ProcessVerificationResult> {
  const existing = await getSubscriberByToken(token);
  if (existing === undefined) {
    return { kind: "not_found" };
  }

  const decision = evaluateVerificationAttempt({
    status: existing.status,
    verificationSentAt: existing.verification_sent_at,
    confirmed,
    now,
  });

  if (decision.kind === "already_verified") {
    return { kind: "already_verified", subscriber: existing };
  }
  if (decision.kind === "not_pending") {
    return decision;
  }
  if (decision.kind === "needs_confirmation") {
    return decision;
  }

  const subscriber = await verifySubscriber(existing.token);
  if (subscriber === undefined) {
    return { kind: "not_found" };
  }
  return { kind: "verified", subscriber };
}

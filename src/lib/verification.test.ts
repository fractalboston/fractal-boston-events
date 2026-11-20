import { describe, expect, it } from "vitest";
import {
  VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS,
  evaluateVerificationAttempt,
} from "@/lib/verification";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const INSIDE_WINDOW = new Date(
  NOW.getTime() - (VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS - 30) * 1000
);
const OUTSIDE_WINDOW = new Date(
  NOW.getTime() - (VERIFY_HUMAN_CONFIRM_WINDOW_SECONDS + 30) * 1000
);

describe("evaluateVerificationAttempt", () => {
  it("does not verify inside the window without an explicit confirmation", () => {
    expect(
      evaluateVerificationAttempt({
        status: "pending",
        verificationSentAt: INSIDE_WINDOW,
        confirmed: false,
        now: NOW,
      })
    ).toEqual({ kind: "needs_confirmation" });
  });

  it("verifies inside the window when confirmed is true", () => {
    expect(
      evaluateVerificationAttempt({
        status: "pending",
        verificationSentAt: INSIDE_WINDOW,
        confirmed: true,
        now: NOW,
      })
    ).toEqual({ kind: "verify" });
  });

  it("auto-verifies outside the window without an explicit confirmation", () => {
    expect(
      evaluateVerificationAttempt({
        status: "pending",
        verificationSentAt: OUTSIDE_WINDOW,
        confirmed: false,
        now: NOW,
      })
    ).toEqual({ kind: "verify" });
  });

  it("is idempotent for an already-verified token, including inside the window", () => {
    expect(
      evaluateVerificationAttempt({
        status: "verified",
        verificationSentAt: INSIDE_WINDOW,
        confirmed: false,
        now: NOW,
      })
    ).toEqual({ kind: "already_verified" });
    expect(
      evaluateVerificationAttempt({
        status: "verified",
        verificationSentAt: OUTSIDE_WINDOW,
        confirmed: true,
        now: NOW,
      })
    ).toEqual({ kind: "already_verified" });
  });

  it("requires a button when verification_sent_at is missing", () => {
    expect(
      evaluateVerificationAttempt({
        status: "pending",
        verificationSentAt: null,
        confirmed: false,
        now: NOW,
      })
    ).toEqual({ kind: "needs_confirmation" });
  });
});

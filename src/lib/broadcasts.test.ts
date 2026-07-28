import { describe, expect, it } from "vitest";
import {
  canSendBroadcast,
  editClearsTestApproval,
  formatSenderFrom,
  formatTestSubject,
  isAllowedSenderEmail,
  resolveBroadcastFinalStatus,
} from "@/lib/broadcasts";

describe("isAllowedSenderEmail", () => {
  it("accepts addresses at the sender domain", () => {
    expect(isAllowedSenderEmail("events@fractal.boston")).toBe(true);
    expect(isAllowedSenderEmail("hello@fractal.boston")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isAllowedSenderEmail("  Events@Fractal.Boston  ")).toBe(true);
  });

  it("rejects other domains", () => {
    expect(isAllowedSenderEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedSenderEmail("someone@fractal.boston.evil.com")).toBe(false);
  });

  it("rejects subdomain lookalikes", () => {
    expect(isAllowedSenderEmail("someone@sub.fractal.boston")).toBe(false);
  });

  it("rejects strings without a local part", () => {
    expect(isAllowedSenderEmail("@fractal.boston")).toBe(false);
    expect(isAllowedSenderEmail("fractal.boston")).toBe(false);
  });
});

describe("formatSenderFrom", () => {
  it("formats name and email as a From header", () => {
    expect(
      formatSenderFrom({
        name: "Fractal Events",
        email: "events@fractal.boston",
      })
    ).toBe("Fractal Events <events@fractal.boston>");
  });
});

describe("formatTestSubject", () => {
  it("prefixes the subject with [TEST]", () => {
    expect(formatTestSubject("Big announcement")).toBe(
      "[TEST] Big announcement"
    );
  });
});

describe("editClearsTestApproval", () => {
  const broadcast = {
    subject: "Subject",
    content: "<p>Body</p>",
    sender_identity_id: "11111111-1111-1111-1111-111111111111",
  };

  it("clears approval when subject changes", () => {
    expect(
      editClearsTestApproval({
        broadcast,
        updates: { subject: "New subject" },
      })
    ).toBe(true);
  });

  it("clears approval when content changes", () => {
    expect(
      editClearsTestApproval({
        broadcast,
        updates: { content: "<p>New body</p>" },
      })
    ).toBe(true);
  });

  it("clears approval when sender changes", () => {
    expect(
      editClearsTestApproval({
        broadcast,
        updates: {
          senderIdentityId: "22222222-2222-2222-2222-222222222222",
        },
      })
    ).toBe(true);
  });

  it("keeps approval when values are unchanged", () => {
    expect(
      editClearsTestApproval({
        broadcast,
        updates: {
          subject: broadcast.subject,
          content: broadcast.content,
          senderIdentityId: broadcast.sender_identity_id,
        },
      })
    ).toBe(false);
  });

  it("keeps approval when no fields are provided", () => {
    expect(editClearsTestApproval({ broadcast, updates: {} })).toBe(false);
  });
});

describe("canSendBroadcast", () => {
  const testSentAt = new Date();

  it("allows a tested draft", () => {
    expect(
      canSendBroadcast({ status: "draft", test_sent_at: testSentAt })
    ).toEqual({ ok: true });
  });

  it("allows resuming a failed broadcast", () => {
    expect(
      canSendBroadcast({ status: "failed", test_sent_at: testSentAt })
    ).toEqual({ ok: true });
  });

  it("rejects an untested draft", () => {
    const result = canSendBroadcast({ status: "draft", test_sent_at: null });
    expect(result.ok).toBe(false);
  });

  it("rejects a sent broadcast", () => {
    const result = canSendBroadcast({
      status: "sent",
      test_sent_at: testSentAt,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a broadcast that is already sending", () => {
    const result = canSendBroadcast({
      status: "sending",
      test_sent_at: testSentAt,
    });
    expect(result.ok).toBe(false);
  });
});

describe("resolveBroadcastFinalStatus", () => {
  it("returns sent when everything succeeded", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 10,
        totalCount: 10,
      })
    ).toBe("sent");
  });

  it("returns sent with partial failures once nothing is pending", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 8,
        totalCount: 10,
      })
    ).toBe("sent");
  });

  it("returns failed when sends remain pending (quota abort)", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 5,
        sentCount: 3,
        totalCount: 10,
      })
    ).toBe("failed");
  });

  it("returns failed when nothing was sent", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 0,
        totalCount: 10,
      })
    ).toBe("failed");
  });

  it("returns sent for an empty audience", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 0,
        totalCount: 0,
      })
    ).toBe("sent");
  });
});

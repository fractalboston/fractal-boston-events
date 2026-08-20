import { describe, expect, it } from "vitest";
import {
  buildBroadcastHtml,
  canSendBroadcast,
  checkRenderedSize,
  editClearsTestApproval,
  findContentWarnings,
  formatSenderFrom,
  formatTestSubject,
  isAllowedSenderEmail,
  resolveBroadcastFinalStatus,
} from "@/lib/broadcasts";
import { joinAppUrl } from "@/lib/urls";

describe("findContentWarnings", () => {
  it("flags a zero-width space inside an href (the production dead-link bug)", () => {
    const content = `<a href="\u200bhttps://example.com">sign a waiver</a>`;
    const warnings = findContentWarnings(content);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("zero-width space inside an HTML tag");
  });

  it("flags a zero-width space in prose as accidental", () => {
    const warnings = findContentWarnings("<p>hello\u200bworld</p>");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("in text");
  });

  it("does not flag curly quotes in prose", () => {
    expect(findContentWarnings("<p>“We’re excited” she said.</p>")).toEqual([]);
  });

  it("flags curly quotes used to quote an attribute", () => {
    const warnings = findContentWarnings(
      "<a href=“https://example.com”>link</a>"
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("curly double quote inside an HTML tag");
  });

  it("flags a non-breaking space only inside tags", () => {
    expect(findContentWarnings("<p>hello\u00a0world</p>")).toEqual([]);
    expect(
      findContentWarnings('<a\u00a0href="https://example.com">x</a>')
    ).toHaveLength(1);
  });

  it("reports the line number", () => {
    const warnings = findContentWarnings("<p>ok</p>\n<p>ok</p>\n<p>\u200b</p>");
    expect(warnings[0]).toContain("Line 3");
  });

  it("returns nothing for clean content", () => {
    expect(
      findContentWarnings('<h1>Hi</h1><p><a href="https://x.com">go</a></p>')
    ).toEqual([]);
  });
});

describe("checkRenderedSize", () => {
  it("passes normal-sized content", () => {
    expect(checkRenderedSize("<p>Short announcement.</p>")).toBeNull();
  });

  it("warns when the rendered email approaches Gmail's clip limit", () => {
    const warning = checkRenderedSize(`<p>${"a".repeat(95_000)}</p>`);
    expect(warning).not.toBeNull();
    expect(warning).toContain("Gmail clips");
  });
});

describe("joinAppUrl", () => {
  it("joins a base URL without a trailing slash", () => {
    expect(joinAppUrl("https://fractal.boston", "/unsubscribe?token=x")).toBe(
      "https://fractal.boston/unsubscribe?token=x"
    );
  });

  it("strips the trailing slash env-var adds to APP_URL", () => {
    expect(joinAppUrl("https://fractal.boston/", "/unsubscribe?token=x")).toBe(
      "https://fractal.boston/unsubscribe?token=x"
    );
  });

  it("strips repeated trailing slashes", () => {
    expect(joinAppUrl("https://fractal.boston//", "/verify?token=x")).toBe(
      "https://fractal.boston/verify?token=x"
    );
  });
});

describe("buildBroadcastHtml", () => {
  const html = buildBroadcastHtml({
    content: "<p>Party on the roof deck.</p>",
    unsubscribeUrl: "https://fractal.boston/unsubscribe?token=x",
  });

  it("includes the body content", () => {
    expect(html).toContain("<p>Party on the roof deck.</p>");
  });

  it("includes the unsubscribe link", () => {
    expect(html).toContain('href="https://fractal.boston/unsubscribe?token=x"');
  });

  it("includes the brand header link", () => {
    expect(html).toContain('href="https://fractal.boston"');
    expect(html).toContain("Fractal Boston");
  });

  it("uses a fixed-width table attribute for Outlook with a fluid max-width", () => {
    expect(html).toContain('width="600"');
    expect(html).toContain("max-width: 600px");
  });

  it("applies brand-green bold underlined defaults to content links", () => {
    expect(html).toMatch(
      /a\s*\{\s*color:\s*#059669;\s*font-weight:\s*bold;\s*text-decoration:\s*underline;/
    );
  });

  it("provides a site-style button class", () => {
    expect(html).toContain(".button");
    expect(html).toContain("background-color: #059669");
  });
});

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

  it("allows retrying a partial broadcast", () => {
    expect(
      canSendBroadcast({ status: "partial", test_sent_at: testSentAt })
    ).toEqual({ ok: true });
  });

  it("allows resuming a sending broadcast (the claim arbitrates staleness)", () => {
    expect(
      canSendBroadcast({ status: "sending", test_sent_at: testSentAt })
    ).toEqual({ ok: true });
  });
});

describe("resolveBroadcastFinalStatus", () => {
  it("returns sent when everything succeeded", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 10,
        failedCount: 0,
        totalCount: 10,
      })
    ).toBe("sent");
  });

  it("returns partial when delivered with failures remaining", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 8,
        failedCount: 2,
        totalCount: 10,
      })
    ).toBe("partial");
  });

  it("returns failed when sends remain pending (quota abort)", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 5,
        sentCount: 3,
        failedCount: 2,
        totalCount: 10,
      })
    ).toBe("failed");
  });

  it("returns failed when nothing was sent", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 0,
        failedCount: 10,
        totalCount: 10,
      })
    ).toBe("failed");
  });

  it("returns sent when every recipient was skipped", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 0,
        failedCount: 0,
        totalCount: 10,
      })
    ).toBe("sent");
  });

  it("returns sent for an empty audience", () => {
    expect(
      resolveBroadcastFinalStatus({
        pendingCount: 0,
        sentCount: 0,
        failedCount: 0,
        totalCount: 0,
      })
    ).toBe("sent");
  });
});

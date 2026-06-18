import { describe, expect, it } from "vitest";
import {
  isSubscriberId,
  isSubscriberToken,
  normalizeSubscriberIdInput,
  normalizeSubscriberTokenInput,
} from "@/lib/subscriberToken";

describe("normalizeSubscriberTokenInput", () => {
  it("strips trailing dashes pasted after a UUID", () => {
    expect(
      normalizeSubscriberTokenInput("aa5e9dc5-fafc-7164-1cbc-1afb1b5d115c---")
    ).toBe("aa5e9dc5-fafc-7164-1cbc-1afb1b5d115c");
  });

  it("trims whitespace", () => {
    expect(normalizeSubscriberTokenInput("  abc123  ")).toBe("abc123");
  });

  it("lowercases a UUID-shaped token", () => {
    expect(
      normalizeSubscriberTokenInput("F1B11CF6-4956-4A33-93E2-6FC6CB32C824")
    ).toBe("f1b11cf6-4956-4a33-93e2-6fc6cb32c824");
  });

  it("rejects undashed tokens that are not UUID-shaped", () => {
    const undashed = "a1b2c3d4e5f6789012345678901234ab";
    expect(normalizeSubscriberTokenInput(undashed)).toBe(undashed);
    expect(isSubscriberToken(undashed)).toBe(false);
  });
});

describe("normalizeSubscriberIdInput", () => {
  it("lowercases admin ids", () => {
    expect(
      normalizeSubscriberIdInput("F1B11CF6-4956-4A33-93E2-6FC6CB32C824")
    ).toBe("f1b11cf6-4956-4a33-93e2-6fc6cb32c824");
  });
});

describe("isSubscriberToken", () => {
  it("accepts UUID-shaped tokens only", () => {
    expect(isSubscriberToken("f1b11cf6-4956-4a33-93e2-6fc6cb32c824")).toBe(
      true
    );
    expect(isSubscriberToken("a1b2c3d4e5f6789012345678901234ab")).toBe(false);
    expect(isSubscriberToken("not-a-token")).toBe(false);
  });
});

describe("isSubscriberId", () => {
  it("accepts UUID-shaped ids", () => {
    expect(isSubscriberId("aa5e9dc5-fafc-7164-1cbc-1afb1b5d115c")).toBe(true);
  });
});

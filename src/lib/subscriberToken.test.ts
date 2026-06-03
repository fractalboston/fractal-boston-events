import { describe, expect, it } from "vitest";
import {
  isValidSubscriberTokenOrId,
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

  it("leaves a 32-char hex token unchanged", () => {
    const token = "a1b2c3d4e5f6789012345678901234ab";
    expect(normalizeSubscriberTokenInput(token)).toBe(token);
  });
});

describe("isValidSubscriberTokenOrId", () => {
  it("accepts hex tokens and UUIDs", () => {
    expect(isValidSubscriberTokenOrId("a1b2c3d4e5f6789012345678901234ab")).toBe(
      true
    );
    expect(
      isValidSubscriberTokenOrId("aa5e9dc5-fafc-7164-1cbc-1afb1b5d115c")
    ).toBe(true);
  });

  it("rejects values with invalid trailing characters", () => {
    expect(isValidSubscriberTokenOrId("not-a-token")).toBe(false);
  });
});

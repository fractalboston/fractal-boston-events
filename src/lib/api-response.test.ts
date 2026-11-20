import { describe, expect, it } from "vitest";
import {
  isSubscribeHoneypotFilled,
  subscribeBodySchema,
} from "@/lib/api-response";

describe("isSubscribeHoneypotFilled", () => {
  it("is empty for a missing or blank website field", () => {
    expect(isSubscribeHoneypotFilled(undefined)).toBe(false);
    expect(isSubscribeHoneypotFilled("")).toBe(false);
    expect(isSubscribeHoneypotFilled("   ")).toBe(false);
  });

  it("is filled when a bot types into the honeypot", () => {
    expect(isSubscribeHoneypotFilled("https://spam.example")).toBe(true);
  });
});

describe("subscribeBodySchema", () => {
  it("accepts an email signup with an optional website field", () => {
    expect(
      subscribeBodySchema.safeParse({ email: "pat@example.com" }).success
    ).toBe(true);
    const parsed = subscribeBodySchema.safeParse({
      email: "pat@example.com",
      website: "https://spam.example",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && "email" in parsed.data) {
      expect(parsed.data.website).toBe("https://spam.example");
    }
  });
});

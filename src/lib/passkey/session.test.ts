import { describe, expect, it } from "vitest";
import { getPublicOrigin, getWebAuthnConfig } from "@/lib/passkey/config";
import {
  createSessionCookieValue,
  parseSessionIdFromCookieHeader,
} from "@/lib/passkey/session";

describe("session cookie HMAC", () => {
  it("round-trips a signed session id", () => {
    const sessionId = "01234567-89ab-cdef-0123-456789abcdef";
    const value = createSessionCookieValue(sessionId);
    const cookieHeader = `session=${value}; other=1`;
    expect(parseSessionIdFromCookieHeader(cookieHeader)).toBe(sessionId);
  });

  it("rejects a tampered signature", () => {
    const sessionId = "01234567-89ab-cdef-0123-456789abcdef";
    const value = createSessionCookieValue(sessionId);
    const parts = value.split(".");
    const id = parts[0];
    if (id === undefined) {
      throw new Error("expected session id");
    }
    const cookieHeader = `session=${id}.tampered-signature`;
    expect(parseSessionIdFromCookieHeader(cookieHeader)).toBeNull();
  });

  it("returns null when cookie is missing", () => {
    expect(parseSessionIdFromCookieHeader(null)).toBeNull();
    expect(parseSessionIdFromCookieHeader("foo=bar")).toBeNull();
  });
});

describe("getPublicOrigin", () => {
  it("uses http for localhost", () => {
    const request = new Request("http://localhost:3002/api/auth/status", {
      headers: { host: "localhost:3002" },
    });
    expect(getPublicOrigin(request)).toBe("http://localhost:3002");
  });

  it("forces https off localhost even if request url is http", () => {
    const request = new Request("http://fb-events.vercel.app/api/auth/status", {
      headers: {
        host: "fb-events.vercel.app",
        "x-forwarded-host": "fb-events.vercel.app",
      },
    });
    expect(getPublicOrigin(request)).toBe("https://fb-events.vercel.app");
  });

  it("prefers x-forwarded-host", () => {
    const request = new Request("http://localhost/api/auth/status", {
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "events.fractal.boston",
      },
    });
    expect(getPublicOrigin(request)).toBe("https://events.fractal.boston");
  });
});

describe("getWebAuthnConfig", () => {
  it("derives rpID from origin hostname", () => {
    const request = new Request("http://localhost:3002/", {
      headers: { host: "localhost:3002" },
    });
    const config = getWebAuthnConfig(request);
    expect(config.rpID).toBe("localhost");
    expect(config.origin).toBe("http://localhost:3002");
    expect(config.rpName.length).toBeGreaterThan(0);
  });
});

describe("isInviteValid", () => {
  it("accepts pending unexpired invites only", async () => {
    const { isInviteValid } = await import("@/lib/passkey/db");
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(isInviteValid("pending", future)).toBe(true);
    expect(isInviteValid("accepted", future)).toBe(false);
    expect(isInviteValid("pending", past)).toBe(false);
  });
});

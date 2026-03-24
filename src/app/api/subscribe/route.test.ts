import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/subscribe/route";
import { sendUnauthorized } from "@/lib/api-response";
import { validateApiKey } from "@/lib/auth";

// Mock validateApiKey so we don't need next/headers in tests
vi.mock("@/lib/auth", () => ({
  validateApiKey: vi.fn(),
}));

// Prevent any actual DB / email / discord calls if auth passes
vi.mock("@/db/db", () => ({ db: {} }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/discord", () => ({
  sendDiscordError: vi.fn(),
  sendDiscordInfo: vi.fn(),
}));
vi.mock("@/lib/subscribers", () => ({
  getSubscriberByEmail: vi.fn(),
  getSubscriberByToken: vi.fn(),
  verifySubscriber: vi.fn(),
  createSubscriber: vi.fn(),
}));

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscribe - API key validation", () => {
  beforeEach(() => {
    vi.mocked(validateApiKey).mockReset();
  });

  it("returns 401 when API key is missing", async () => {
    vi.mocked(validateApiKey).mockResolvedValue(
      sendUnauthorized("Invalid or missing API key")
    );
    const res = await POST(makePostRequest({ email: "user@example.com" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("returns 401 when API key is wrong", async () => {
    vi.mocked(validateApiKey).mockResolvedValue(
      sendUnauthorized("Invalid or missing API key")
    );
    const res = await POST(makePostRequest({ email: "user@example.com" }));
    expect(res.status).toBe(401);
  });

  it("proceeds past auth when API key is valid", async () => {
    vi.mocked(validateApiKey).mockResolvedValue(null);
    // With auth passing, it hits the body — no email here should give 400
    const res = await POST(makePostRequest({ not: "email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body when auth passes", async () => {
    vi.mocked(validateApiKey).mockResolvedValue(null);
    const req = new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid JSON body",
    });
  });
});

describe("GET /api/subscribe (notAllowed)", () => {
  it("returns JSON 405", async () => {
    const res = await GET(new Request("http://localhost/api/subscribe"));
    expect(res.status).toBe(405);
  });
});

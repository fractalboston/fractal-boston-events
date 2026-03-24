import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/health/route";

const req = new Request("http://localhost/api/health");

describe("GET /api/health", () => {
  it("returns 200 with status ok and a timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { status: string; timestamp: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(typeof body.data.timestamp).toBe("string");
  });
});

describe("unsupported methods on /api/health", () => {
  it("POST returns JSON 405", async () => {
    const res = await POST(req);
    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: "Method not allowed",
    });
  });

  it("PUT returns JSON 405", async () => {
    expect((await PUT(req)).status).toBe(405);
  });

  it("PATCH returns JSON 405", async () => {
    expect((await PATCH(req)).status).toBe(405);
  });

  it("DELETE returns JSON 405", async () => {
    expect((await DELETE(req)).status).toBe(405);
  });
});

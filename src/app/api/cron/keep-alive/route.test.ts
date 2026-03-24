import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cron/keep-alive/route";
import { db } from "@/db/db";
import { sendUnauthorized } from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  validateCronSecret: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: { selectFrom: vi.fn() },
}));

function mockDbCount(count: number): void {
  const executeTakeFirstOrThrow = vi
    .fn()
    .mockResolvedValue({ count: String(count) });
  const where = vi.fn(() => ({ executeTakeFirstOrThrow }));
  const select = vi.fn(() => ({ where }));
  vi.mocked(db).selectFrom.mockReturnValue({ select } as unknown as ReturnType<
    typeof db.selectFrom
  >);
}

function mockDbError(message: string): void {
  const executeTakeFirstOrThrow = vi.fn().mockRejectedValue(new Error(message));
  const where = vi.fn(() => ({ executeTakeFirstOrThrow }));
  const select = vi.fn(() => ({ where }));
  vi.mocked(db).selectFrom.mockReturnValue({ select } as unknown as ReturnType<
    typeof db.selectFrom
  >);
}

describe("GET /api/cron/keep-alive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateCronSecret).mockResolvedValue(
      sendUnauthorized("Invalid cron secret")
    );
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("returns subscriber count from the database when auth passes", async () => {
    vi.mocked(validateCronSecret).mockResolvedValue(null);
    mockDbCount(7);

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { newSubscribersLastWeek: 7 },
    });
  });

  it("returns 500 JSON when the DB query throws", async () => {
    vi.mocked(validateCronSecret).mockResolvedValue(null);
    mockDbError("db down");

    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });
});

describe("POST /api/cron/keep-alive (notAllowed)", () => {
  it("returns JSON 405", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/keep-alive", { method: "POST" })
    );
    expect(res.status).toBe(405);
  });
});

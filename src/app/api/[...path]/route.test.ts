import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/[...path]/route";

describe("catch-all /api/[...path]", () => {
  const methods = [
    ["GET", GET],
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ] as const;

  for (const [method, handler] of methods) {
    it(`${method} returns JSON 404 with 'API route not found'`, async () => {
      const res = await handler();
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({
        success: false,
        error: "API route not found",
      });
    });
  }
});

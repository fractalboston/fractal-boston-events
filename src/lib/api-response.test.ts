import { describe, expect, it } from "vitest";
import {
  notAllowed,
  sendBadRequest,
  sendCreated,
  sendError,
  sendInternalError,
  sendMethodNotAllowed,
  sendNotFound,
  sendSuccess,
  sendUnauthorized,
  withHandler,
} from "@/lib/api-response";

describe("withHandler", () => {
  it("passes through a normal response", async () => {
    const handler = withHandler(() => sendSuccess({ ok: true }));
    const res = await handler();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { ok: true },
    });
  });

  it("catches a synchronous throw and returns JSON 500", async () => {
    const handler = withHandler(() => {
      throw new Error("boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "An unexpected error occurred",
    });
  });

  it("catches an async throw and returns JSON 500", async () => {
    const handler = withHandler(async () => {
      await Promise.resolve();
      throw new Error("async boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("forwards request arguments to the handler", async () => {
    const handler = withHandler(async (req: Request) => {
      const body = (await req.json()) as { value: number };
      return sendSuccess({ received: body.value });
    });
    const req = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ value: 42 }),
    });
    const res = await handler(req);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { received: 42 },
    });
  });
});

describe("notAllowed", () => {
  it("returns JSON 405 Method Not Allowed", async () => {
    const res = await notAllowed();
    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "Method not allowed",
    });
  });
});

describe("response helpers", () => {
  it("sendSuccess returns 200 with success: true and data", async () => {
    const res = sendSuccess({ name: "test" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { name: "test" },
    });
  });

  it("sendCreated returns 201", () => {
    expect(sendCreated({}).status).toBe(201);
  });

  it("sendError returns the given status with success: false", async () => {
    const res = sendError(409, "conflict");
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "conflict",
    });
  });

  it("sendBadRequest returns 400", async () => {
    const res = sendBadRequest("bad input");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: "bad input",
    });
  });

  it("sendUnauthorized returns 401", () => {
    expect(sendUnauthorized("no").status).toBe(401);
  });

  it("sendNotFound returns 404", async () => {
    const res = sendNotFound("missing");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("sendMethodNotAllowed returns 405", () => {
    expect(sendMethodNotAllowed().status).toBe(405);
  });

  it("sendInternalError returns 500", async () => {
    const res = sendInternalError("oops");
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "oops",
    });
  });
});

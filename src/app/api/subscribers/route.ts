import { z } from "zod";
import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import { isDevelopment } from "@/lib/env";
import {
  createSubscriber,
  deleteSubscriber,
  searchSubscribersByEmail,
  updateSubscriber,
} from "@/lib/subscribers";

const createBodySchema = z.object({
  email: z.email(),
  source: z.enum(["form", "luma", "substack", "manual"]).optional(),
  status: z.enum(["pending", "verified", "unsubscribed"]).optional(),
});

type CreateBody = z.infer<typeof createBodySchema>;

const updateBodySchema = z.object({
  id: z.string().min(1),
  source: z.enum(["form", "luma", "substack", "manual"]).optional(),
  status: z.enum(["pending", "verified", "unsubscribed"]).optional(),
});

type UpdateBody = z.infer<typeof updateBodySchema>;

const listQuerySchema = z.object({
  email: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["newest", "alphabetical"]).optional(),
  status: z.enum(["pending", "verified", "unsubscribed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      email: searchParams.get("email") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }

    const query = parsed.data.email ?? parsed.data.q ?? "";
    const sort = parsed.data.sort ?? "newest";
    const status = parsed.data.status;
    const limit = parsed.data.limit ?? 50;
    const offset = parsed.data.offset ?? 0;
    const { subscribers, hasMore, totalCount } = await searchSubscribersByEmail(
      {
        query,
        sort,
        status,
        limit,
        offset,
      }
    );
    return sendSuccess({
      subscribers,
      hasMore,
      nextOffset: offset + subscribers.length,
      totalCount,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber search error:", err);
    return sendInternalError(`Search failed: ${err.message}`);
  }
}

const deleteBodySchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }
    const { email, source, status }: CreateBody = parsed.data;
    const subscriber = await createSubscriber({
      email,
      source: source ?? "manual",
      status,
    });
    if (subscriber === undefined) {
      return sendError(409, "A subscriber with this email already exists.");
    }
    return sendSuccess({ subscriber });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber create error:", err);
    return sendInternalError(`Create failed: ${err.message}`);
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }
    const { id, source, status }: UpdateBody = parsed.data;
    const updated = await updateSubscriber({ id, source, status });
    if (updated === undefined) {
      return sendNotFound("Subscriber not found");
    }
    return sendSuccess({ subscriber: updated });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber update error:", err);
    return sendInternalError(`Update failed: ${err.message}`);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }
    const parsed = deleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }
    const deleted = await deleteSubscriber(parsed.data.id);
    if (!deleted) {
      return sendNotFound("Subscriber not found");
    }
    return sendSuccess({ deleted: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber delete error:", err);
    return sendInternalError(`Delete failed: ${err.message}`);
  }
}

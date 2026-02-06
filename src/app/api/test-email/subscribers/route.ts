import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import { isDevelopment } from "@/lib/env";
import { searchSubscribersByEmail, updateSubscriber } from "@/lib/subscribers";

const updateBodySchema = z.object({
  id: z.string().min(1),
  source: z.enum(["form", "luma", "substack", "manual"]).optional(),
  status: z.enum(["pending", "verified", "unsubscribed"]).optional(),
});

type UpdateBody = z.infer<typeof updateBodySchema>;

export async function GET(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("email") ?? searchParams.get("q") ?? "";
    const subscribers = await searchSubscribersByEmail(query);
    return sendSuccess({ subscribers });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber search error:", err);
    return sendInternalError(`Search failed: ${err.message}`);
  }
}

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

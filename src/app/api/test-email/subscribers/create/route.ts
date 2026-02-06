import { z } from "zod";
import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { isDevelopment } from "@/lib/env";
import { createSubscriber } from "@/lib/subscribers";

const createBodySchema = z.object({
  email: z.email(),
  source: z.enum(["form", "luma", "substack", "manual"]).optional(),
  status: z.enum(["pending", "verified", "unsubscribed"]).optional(),
});

type CreateBody = z.infer<typeof createBodySchema>;

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

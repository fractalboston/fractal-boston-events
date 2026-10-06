import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import {
  countVerifiedSubscribers,
  createBroadcast,
  getBroadcastWarnings,
  getSenderIdentityById,
  listBroadcasts,
} from "@/lib/broadcasts";
import { env } from "@/lib/env";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";
import { subscriberTagSchema } from "@/lib/subscribers";

const createBodySchema = z.object({
  subject: z.string().trim().min(1).max(255),
  content: z.string().min(1),
  senderIdentityId: z.guid("Invalid sender identity id"),
  audienceTag: subscriberTagSchema.nullable().optional(),
  audienceScope: z.enum(["verified", "all", "pending"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }
  try {
    const [broadcasts, verifiedCount] = await Promise.all([
      listBroadcasts(),
      countVerifiedSubscribers(),
    ]);
    return sendSuccess({
      broadcasts,
      verifiedCount,
      emailEnabled: env.EMAIL_ENABLED,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast list error:", err);
    return sendInternalError(`List failed: ${err.message}`);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
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
    if (
      (parsed.data.audienceTag === undefined ||
        parsed.data.audienceTag === null) &&
      parsed.data.audienceScope !== undefined &&
      parsed.data.audienceScope !== "verified"
    ) {
      return sendBadRequest("An audience scope requires an audience tag");
    }
    const identity = await getSenderIdentityById(parsed.data.senderIdentityId);
    if (identity === undefined) {
      return sendBadRequest("Sender identity not found");
    }
    const broadcast = await createBroadcast(parsed.data);
    return sendSuccess({
      broadcast,
      warnings: getBroadcastWarnings(broadcast),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast create error:", err);
    return sendInternalError(`Create failed: ${err.message}`);
  }
}

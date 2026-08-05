import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import {
  countVerifiedSubscribers,
  createBroadcast,
  getSenderIdentityById,
  listBroadcasts,
} from "@/lib/broadcasts";
import { env } from "@/lib/env";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";

const createBodySchema = z.object({
  subject: z.string().trim().min(1).max(255),
  content: z.string().min(1),
  senderIdentityId: z.guid("Invalid sender identity id"),
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
    const identity = await getSenderIdentityById(parsed.data.senderIdentityId);
    if (identity === undefined) {
      return sendBadRequest("Sender identity not found");
    }
    const broadcast = await createBroadcast(parsed.data);
    return sendSuccess({ broadcast });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast create error:", err);
    return sendInternalError(`Create failed: ${err.message}`);
  }
}

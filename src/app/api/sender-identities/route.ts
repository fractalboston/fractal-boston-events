import { z } from "zod";
import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import {
  createSenderIdentity,
  isAllowedSenderEmail,
  listSenderIdentities,
  updateSenderIdentity,
} from "@/lib/broadcasts";
import { SENDER_EMAIL_DOMAIN } from "@/lib/constants";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .refine(
      isAllowedSenderEmail,
      `Sender email must be @${SENDER_EMAIL_DOMAIN}`
    ),
  replyTo: z.email().optional(),
});

const updateBodySchema = z.object({
  id: z.guid("Invalid sender identity id"),
  name: z.string().trim().min(1).max(100).optional(),
  replyTo: z.email().nullable().optional(),
});

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }
  try {
    const identities = await listSenderIdentities();
    return sendSuccess({ identities });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Sender identity list error:", err);
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
    const identity = await createSenderIdentity(parsed.data);
    if (identity === undefined) {
      return sendError(
        409,
        "A sender identity with this email already exists."
      );
    }
    return sendSuccess({ identity });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Sender identity create error:", err);
    return sendInternalError(`Create failed: ${err.message}`);
  }
}

export async function PUT(request: Request): Promise<Response> {
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
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }
    const identity = await updateSenderIdentity(parsed.data);
    if (identity === undefined) {
      return sendNotFound("Sender identity not found");
    }
    return sendSuccess({ identity });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Sender identity update error:", err);
    return sendInternalError(`Update failed: ${err.message}`);
  }
}

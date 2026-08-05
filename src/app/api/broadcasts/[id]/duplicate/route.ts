import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import { duplicateBroadcast } from "@/lib/broadcasts";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";

const idSchema = z.guid("Invalid broadcast id");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }
  try {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return sendBadRequest(parsedId.error.message);
    }
    const broadcast = await duplicateBroadcast(parsedId.data);
    if (broadcast === undefined) {
      return sendNotFound("Broadcast not found");
    }
    return sendSuccess({ broadcast });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast duplicate error:", err);
    return sendInternalError(`Duplicate failed: ${err.message}`);
  }
}

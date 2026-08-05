import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import {
  buildBroadcastHtml,
  deleteBroadcastDraft,
  getBroadcastById,
  getRecipientCounts,
  listBroadcastRecipients,
  updateBroadcastDraft,
} from "@/lib/broadcasts";
import { env } from "@/lib/env";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";
import { joinAppUrl } from "@/lib/urls";

const idSchema = z.guid("Invalid broadcast id");

const updateBodySchema = z.object({
  subject: z.string().trim().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  senderIdentityId: z.guid("Invalid sender identity id").optional(),
});

export async function GET(
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
    const broadcast = await getBroadcastById(parsedId.data);
    if (broadcast === undefined) {
      return sendNotFound("Broadcast not found");
    }
    const [counts, failedRecipients, skippedRecipients] = await Promise.all([
      getRecipientCounts(broadcast.id),
      listBroadcastRecipients({ broadcastId: broadcast.id, status: "failed" }),
      listBroadcastRecipients({ broadcastId: broadcast.id, status: "skipped" }),
    ]);
    const previewHtml = buildBroadcastHtml({
      content: broadcast.content,
      unsubscribeUrl: joinAppUrl(env.APP_URL, "/unsubscribe?token=preview"),
    });
    return sendSuccess({
      broadcast,
      counts,
      previewHtml,
      failedRecipients,
      skippedRecipients,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast detail error:", err);
    return sendInternalError(`Fetch failed: ${err.message}`);
  }
}

export async function PUT(
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
    const broadcast = await updateBroadcastDraft({
      id: parsedId.data,
      ...parsed.data,
    });
    if (broadcast === undefined) {
      return sendNotFound("Draft broadcast not found");
    }
    return sendSuccess({ broadcast });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast update error:", err);
    return sendInternalError(`Update failed: ${err.message}`);
  }
}

export async function DELETE(
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
    const deleted = await deleteBroadcastDraft(parsedId.data);
    if (!deleted) {
      return sendNotFound("Draft broadcast not found");
    }
    return sendSuccess({ deleted: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast delete error:", err);
    return sendInternalError(`Delete failed: ${err.message}`);
  }
}

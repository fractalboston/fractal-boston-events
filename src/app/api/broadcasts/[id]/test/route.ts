import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import {
  buildBroadcastHtml,
  formatSenderFrom,
  formatTestSubject,
  getBroadcastById,
  getSenderIdentityById,
  markBroadcastTestSent,
} from "@/lib/broadcasts";
import { sendDiscordInfo } from "@/lib/discord";
import { sendBroadcastTestEmail } from "@/lib/email";
import { env, isDevelopment } from "@/lib/env";
import { joinAppUrl } from "@/lib/urls";

const idSchema = z.guid("Invalid broadcast id");

const bodySchema = z.object({
  email: z.email(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
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
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest("Invalid email address");
    }

    const broadcast = await getBroadcastById(parsedId.data);
    if (broadcast === undefined) {
      return sendNotFound("Broadcast not found");
    }
    if (broadcast.status !== "draft") {
      return sendBadRequest("Only draft broadcasts can be test sent");
    }
    const identity = await getSenderIdentityById(broadcast.sender_identity_id);
    if (identity === undefined) {
      return sendInternalError("Sender identity not found");
    }

    const html = buildBroadcastHtml({
      content: broadcast.content,
      unsubscribeUrl: joinAppUrl(env.APP_URL, "/unsubscribe?token=test"),
    });
    const subject = formatTestSubject(broadcast.subject);

    await sendBroadcastTestEmail({
      to: parsed.data.email,
      subject,
      html,
      from: formatSenderFrom(identity),
      replyTo: identity.reply_to ?? undefined,
    });

    const updated = await markBroadcastTestSent({
      id: broadcast.id,
      email: parsed.data.email,
    });

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: `Broadcast test email sent to **${parsed.data.email}** (subject: ${subject})`,
      color: 0x3b82f6,
    });

    return sendSuccess({ broadcast: updated ?? broadcast });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast test send error:", err);
    return sendInternalError(`Test send failed: ${err.message}`);
  }
}

import { z } from "zod";
import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import {
  buildBroadcastHtml,
  canSendBroadcast,
  claimBroadcastForSending,
  countVerifiedSubscribers,
  finalizeBroadcast,
  formatSenderFrom,
  getBroadcastById,
  getPendingRecipients,
  getRecipientCounts,
  getSenderIdentityById,
  markRecipientFailed,
  markRecipientSent,
  markRecipientSkipped,
  resetFailedRecipients,
  snapshotBroadcastRecipients,
  stampBroadcastSender,
  updateLastBroadcastAt,
} from "@/lib/broadcasts";
import { sendDiscordInfo } from "@/lib/discord";
import { SESQuotaError, sendBroadcastEmail } from "@/lib/email";
import { env, isDevelopment } from "@/lib/env";

const idSchema = z.guid("Invalid broadcast id");

const bodySchema = z.object({
  retryFailed: z.boolean().optional(),
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

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine - retryFailed defaults to false
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }
    const retryFailed = parsed.data.retryFailed ?? false;

    const broadcast = await getBroadcastById(parsedId.data);
    if (broadcast === undefined) {
      return sendNotFound("Broadcast not found");
    }

    const check = canSendBroadcast(broadcast);
    if (!check.ok) {
      return sendBadRequest(check.reason);
    }

    if (!env.EMAIL_ENABLED) {
      const recipientCount = await countVerifiedSubscribers();
      return sendSuccess({
        dryRun: true,
        recipientCount,
        message: `Dry run - EMAIL_ENABLED is false. Would send to ${String(recipientCount)} verified subscribers. Nothing was sent and no state was changed.`,
      });
    }

    if (retryFailed && broadcast.status === "failed") {
      await resetFailedRecipients(broadcast.id);
    }

    const claimed = await claimBroadcastForSending(broadcast.id);
    if (claimed === undefined) {
      return sendError(409, "Broadcast is already being sent");
    }

    const identity = await getSenderIdentityById(claimed.sender_identity_id);
    if (identity === undefined) {
      return sendInternalError("Sender identity not found");
    }

    // Resumed sends keep the sender details from the original run
    const from = claimed.sent_from ?? formatSenderFrom(identity);
    const replyTo = claimed.sent_reply_to ?? identity.reply_to;
    await stampBroadcastSender({ id: claimed.id, from, replyTo });

    await snapshotBroadcastRecipients(claimed.id);
    const pending = await getPendingRecipients(claimed.id);

    const successEmails: string[] = [];
    let quotaAborted = false;

    for (const recipient of pending) {
      // Re-check eligibility at send time - a subscriber may have unsubscribed
      // or bounced between snapshot and a resumed send
      if (
        recipient.subscriberToken === null ||
        recipient.subscriberStatus !== "verified"
      ) {
        await markRecipientSkipped({
          id: recipient.id,
          reason: "No longer a verified subscriber",
        });
        continue;
      }

      try {
        const unsubscribeUrl = `${env.APP_URL}/unsubscribe?token=${recipient.subscriberToken}`;
        const html = buildBroadcastHtml({
          content: claimed.content,
          unsubscribeUrl,
        });
        await sendBroadcastEmail({
          to: recipient.email,
          subject: claimed.subject,
          html,
          from,
          replyTo: replyTo ?? undefined,
        });
        await markRecipientSent(recipient.id);
        successEmails.push(recipient.email);
        // Small delay to stay within SES rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to send broadcast to ${recipient.email}:`, err);
        await markRecipientFailed({ id: recipient.id, error: err.message });
        if (error instanceof SESQuotaError) {
          quotaAborted = true;
          break;
        }
      }
    }

    try {
      await updateLastBroadcastAt(successEmails);
    } catch (updateError) {
      console.error("Failed to update last_broadcast_at:", updateError);
    }

    const finalized = await finalizeBroadcast(claimed.id);
    const counts = await getRecipientCounts(claimed.id);

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: `📣 Broadcast "${claimed.subject}" finished: ${String(counts.sentCount)} sent, ${String(counts.failedCount)} failed, ${String(counts.skippedCount)} skipped of ${String(counts.totalCount)} recipients${quotaAborted ? " (aborted: SES quota exceeded)" : ""}`,
    });

    return sendSuccess({
      broadcast: finalized ?? claimed,
      counts,
      quotaAborted,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Broadcast send error:", err);
    return sendInternalError(`Send failed: ${err.message}`);
  }
}

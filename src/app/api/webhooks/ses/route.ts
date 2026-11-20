import {
  sendBadRequest,
  sendError,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { sendDiscordError, sendDiscordInfo } from "@/lib/discord";
import { env } from "@/lib/env";
import { parseSesEventMessage } from "@/lib/sesEvents";
import {
  isAllowedSnsUrl,
  parseSnsEnvelope,
  verifySnsSignature,
} from "@/lib/sns";
import { applySuppressionStatus } from "@/lib/subscribers";

/**
 * SNS often posts `text/plain` JSON, so parse the raw body instead of
 * request.json().
 */
async function readJsonBody(
  request: Request
): Promise<{ body: unknown } | undefined> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return undefined;
  }
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<Response> {
  const expectedTopicArn = env.SES_SNS_TOPIC_ARN;
  if (expectedTopicArn === undefined || expectedTopicArn === "") {
    return sendError(403, "SES SNS webhook is not configured");
  }

  const parsedBody = await readJsonBody(request);
  if (parsedBody === undefined) {
    return sendBadRequest("Invalid JSON body");
  }

  const envelope = parseSnsEnvelope(parsedBody.body);
  if (envelope === undefined) {
    return sendBadRequest("Invalid SNS message");
  }

  let verified: boolean;
  try {
    verified = await verifySnsSignature({ envelope, expectedTopicArn });
  } catch (error) {
    console.error("SES SNS signature verification failed:", error);
    return sendInternalError("Failed to verify SNS signature");
  }
  if (!verified) {
    return sendError(403, "Invalid SNS signature");
  }

  if (envelope.Type === "SubscriptionConfirmation") {
    const subscribeUrl = envelope.SubscribeURL;
    if (
      subscribeUrl === undefined ||
      !isAllowedSnsUrl({ value: subscribeUrl, kind: "subscribe" })
    ) {
      return sendBadRequest("Invalid SubscribeURL");
    }

    try {
      const confirm = await fetch(subscribeUrl, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (!confirm.ok) {
        console.error(
          "SES SNS subscription confirmation failed:",
          confirm.status
        );
        return sendInternalError("Failed to confirm SNS subscription");
      }
    } catch (error) {
      console.error("SES SNS subscription confirmation failed:", error);
      return sendInternalError("Failed to confirm SNS subscription");
    }

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      title: "SES SNS subscription confirmed",
      message: "The bounce and complaint topic is now active.",
    });
    return sendSuccess({ message: "Subscription confirmed" });
  }

  if (envelope.Type === "UnsubscribeConfirmation") {
    return sendSuccess({ message: "Unsubscribe confirmation ignored" });
  }

  const parsed = parseSesEventMessage(envelope.Message);
  if (parsed === undefined) {
    return sendBadRequest("Invalid SES event");
  }

  for (const ignored of parsed.ignored) {
    console.log(
      `SES webhook ignored ${ignored.reason}` +
        (ignored.email !== undefined ? ` for ${ignored.email}` : "")
    );
  }

  try {
    for (const action of parsed.actions) {
      const updated = await applySuppressionStatus(action);
      if (updated === undefined) {
        console.log(
          `SES ${action.status} for unknown subscriber ${action.email}`
        );
        continue;
      }
      await sendDiscordInfo({
        webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
        title: `SES ${action.status}`,
        message: `${action.email} is now ${updated.status}`,
      });
    }
  } catch (error) {
    console.error("SES webhook failed to apply suppression:", error);
    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "SES webhook suppression error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }
    return sendInternalError("Failed to apply SES suppression");
  }

  return sendSuccess({
    message: "Notification processed",
    eventKind: parsed.eventKind,
    updated: parsed.actions.length,
    ignored: parsed.ignored.length,
  });
}

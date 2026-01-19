import { ZodError } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { validateLumaWebhook } from "@/lib/auth";
import { sendDiscordError, sendDiscordNewEventAlert } from "@/lib/discord";
import { sendBatchEmails } from "@/lib/email";
import { env } from "@/lib/env";
import {
  isEventWithinNextWeek,
  parseLumaEventCreatedWebhook,
} from "@/lib/luma";
import { getAllVerifiedSubscribers } from "@/lib/subscribers";

type WebhookResponse = {
  message: string;
  emailsSent?: number;
};

export async function POST(request: Request): Promise<Response> {
  const authError = await validateLumaWebhook();
  if (authError !== null) {
    return authError;
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }

    const payload = parseLumaEventCreatedWebhook(body);
    const event = payload.data.event;

    if (!isEventWithinNextWeek(event)) {
      return sendSuccess<WebhookResponse>({
        message: "Event is not within the next week, skipping notification",
      });
    }

    try {
      await sendDiscordNewEventAlert(env.DISCORD_EVENTS_WEBHOOK_URL, event);
    } catch (discordError) {
      console.error("Failed to post to Discord:", discordError);
    }

    const subscribers = await getAllVerifiedSubscribers();

    const { success } = await sendBatchEmails(
      subscribers,
      [],
      env.APP_URL,
      "new-event",
      event,
      env.DISCORD_LOGGING_WEBHOOK_URL
    );

    return sendSuccess<WebhookResponse>({
      message: `New event notification sent`,
      emailsSent: success,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendBadRequest("Invalid webhook payload");
    }
    console.error("Luma event webhook error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Luma event webhook error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to process webhook");
  }
}

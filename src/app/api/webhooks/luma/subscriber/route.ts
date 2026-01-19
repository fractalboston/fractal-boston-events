import { ZodError } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { validateLumaWebhook } from "@/lib/auth";
import { sendDiscordError } from "@/lib/discord";
import { sendWelcomeEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { fetchUpcomingEvents, parseLumaSubscriberWebhook } from "@/lib/luma";
import { createSubscriber, getSubscriberByEmail } from "@/lib/subscribers";

type WebhookResponse = {
  message: string;
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

    const payload = parseLumaSubscriberWebhook(body);
    const email = payload.data.user.email;

    const existing = await getSubscriberByEmail(email);

    if (existing !== undefined) {
      return sendSuccess<WebhookResponse>({
        message: "Subscriber already exists",
      });
    }

    const subscriber = await createSubscriber({
      email,
      source: "luma",
      status: "verified",
    });

    try {
      const events = await fetchUpcomingEvents(
        env.LUMA_API_KEY,
        env.LUMA_CALENDAR_ID
      );
      await sendWelcomeEmail(
        subscriber.email,
        subscriber.token,
        events,
        env.APP_URL
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return sendSuccess<WebhookResponse>({
      message: "Subscriber added from Luma",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendBadRequest("Invalid webhook payload");
    }
    console.error("Luma subscriber webhook error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Luma subscriber webhook error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to process webhook");
  }
}

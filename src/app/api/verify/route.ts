import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import { sendDiscordError } from "@/lib/discord";
import { sendWelcomeEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import { getSubscriberByToken, verifySubscriber } from "@/lib/subscribers";

const verifySchema = z.object({
  token: z.uuid(),
});

type VerifyResponse = {
  message: string;
  email: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendBadRequest("Invalid JSON body");
  }

  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Invalid token");
  }

  const { token } = parsed.data;

  try {
    const existing = await getSubscriberByToken(token);

    if (existing === undefined) {
      return sendNotFound("Token not found");
    }

    if (existing.status === "verified") {
      return sendSuccess<VerifyResponse>({
        message: "Already verified",
        email: existing.email,
      });
    }

    if (existing.status === "unsubscribed") {
      return sendBadRequest("This email has been unsubscribed");
    }

    const subscriber = await verifySubscriber(token);

    if (subscriber === undefined) {
      return sendNotFound("Token not found or already verified");
    }

    try {
      const events = await getReportableEvents(env.LUMA_CALENDAR_ID);
      await sendWelcomeEmail(
        subscriber.email,
        subscriber.token,
        events,
        env.APP_URL
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return sendSuccess<VerifyResponse>({
      message: "Email verified successfully",
      email: subscriber.email,
    });
  } catch (error) {
    console.error("Verify error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Verify endpoint error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to verify email");
  }
}

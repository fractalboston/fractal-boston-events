import { z } from "zod";
import {
  sendBadRequest,
  sendCreated,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { validateApiKey } from "@/lib/auth";
import { sendDiscordError } from "@/lib/discord";
import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import {
  createSubscriber,
  getSubscriberByEmail,
  resubscribe,
} from "@/lib/subscribers";

const subscribeSchema = z.object({
  email: z.email(),
});

type SubscribeResponse = {
  message: string;
  email: string;
};

export async function POST(request: Request): Promise<Response> {
  const authError = await validateApiKey();
  if (authError !== null) {
    return authError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendBadRequest("Invalid JSON body");
  }

  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Invalid email address");
  }

  const { email } = parsed.data;
  const appUrl = env.APP_URL;

  try {
    // Check if already subscribed
    const existing = await getSubscriberByEmail(email);

    if (existing !== undefined) {
      if (existing.status === "verified") {
        return sendSuccess<SubscribeResponse>({
          message: "Already subscribed",
          email: existing.email,
        });
      }

      if (existing.status === "unsubscribed") {
        const resubscribed = await resubscribe(email);
        if (resubscribed !== undefined) {
          return sendSuccess<SubscribeResponse>({
            message: "Resubscribed successfully",
            email: resubscribed.email,
          });
        }
      }

      if (existing.status === "pending") {
        await sendVerificationEmail(email, existing.token, appUrl);
        return sendSuccess<SubscribeResponse>({
          message: "Verification email resent",
          email: existing.email,
        });
      }
    }

    const subscriber = await createSubscriber({
      email,
      source: "form",
      status: "pending",
    });

    await sendVerificationEmail(email, subscriber.token, appUrl);

    return sendCreated<SubscribeResponse>({
      message: "Verification email sent",
      email: subscriber.email,
    });
  } catch (error) {
    console.error("Subscribe error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Subscribe endpoint error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to process subscription");
  }
}

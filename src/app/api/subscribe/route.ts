import { db } from "@/db/db";
import {
  type SubscribeResponse,
  handleOptionsRequest,
  sendBadRequest,
  sendCreated,
  sendInternalError,
  sendNotFound,
  sendSuccess,
  subscribeBodySchema,
} from "@/lib/api-response";
import { sendDiscordError, sendDiscordInfo } from "@/lib/discord";
import { sendAlreadySubscribedEmail, sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import {
  createSubscriber,
  getSubscriberByEmail,
  resolveSubscriberByTokenOrId,
  verifySubscriber,
} from "@/lib/subscribers";

export function OPTIONS(): Response {
  return handleOptionsRequest();
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendBadRequest("Invalid JSON body");
  }

  const parsed = subscribeBodySchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Provide either a valid email or a token");
  }

  const appUrl = env.APP_URL;

  try {
    if ("token" in parsed.data) {
      const { token } = parsed.data;
      const existing = await resolveSubscriberByTokenOrId(token);
      if (existing === undefined) {
        return sendNotFound("Token not found");
      }
      if (existing.status === "verified") {
        await sendAlreadySubscribedEmail(
          existing.email,
          existing.token,
          appUrl
        );
        await sendDiscordInfo({
          webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
          message: "Subscription attempt for already verified email",
          title: "Subscribe - Already Verified",
        });
        return sendSuccess<SubscribeResponse>({
          message: "Already subscribed",
        });
      }
      if (existing.status === "unsubscribed") {
        // Set status back to pending and resend verification email
        const updated = await db
          .updateTable("subscribers")
          .set({ status: "pending" })
          .where("email", "=", existing.email.toLowerCase())
          .where("status", "=", "unsubscribed")
          .returningAll()
          .executeTakeFirst();

        if (updated !== undefined) {
          await sendVerificationEmail(existing.email, existing.token, appUrl);
          await sendDiscordInfo({
            webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
            message: "Verification email resent to unsubscribed address",
            title: "Subscribe - Verification Resent",
          });
          return sendSuccess<SubscribeResponse>({
            message: "Verification email sent",
          });
        }
      }
      if (existing.status === "pending") {
        const verified = await verifySubscriber(existing.token);
        if (verified !== undefined) {
          await sendDiscordInfo({
            webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
            message: "Subscriber verified via token",
            title: "Subscribe - Verified via Token",
          });
          return sendSuccess<SubscribeResponse>({
            message: "Subscription confirmed",
          });
        }
      }
      return sendInternalError("Failed to process subscription");
    }

    const { email } = parsed.data;

    // Check if already subscribed
    const existing = await getSubscriberByEmail(email);

    if (existing !== undefined) {
      if (existing.status === "verified") {
        await sendAlreadySubscribedEmail(
          existing.email,
          existing.token,
          appUrl
        );
        await sendDiscordInfo({
          webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
          message: "Subscription attempt for already verified email",
          title: "Subscribe - Already Verified",
        });
        return sendSuccess<SubscribeResponse>({
          message: "Already subscribed",
        });
      }

      if (existing.status === "unsubscribed") {
        // Set status back to pending and resend verification email
        const updated = await db
          .updateTable("subscribers")
          .set({ status: "pending" })
          .where("email", "=", existing.email.toLowerCase())
          .where("status", "=", "unsubscribed")
          .returningAll()
          .executeTakeFirst();

        if (updated !== undefined) {
          await sendVerificationEmail(existing.email, existing.token, appUrl);
          await sendDiscordInfo({
            webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
            message: "Verification email resent to unsubscribed address",
            title: "Subscribe - Verification Resent",
          });
          return sendSuccess<SubscribeResponse>({
            message: "Verification email sent",
          });
        }
      }

      if (existing.status === "pending") {
        await sendVerificationEmail(email, existing.token, appUrl);
        await sendDiscordInfo({
          webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
          message: "Verification email resent",
          title: "Subscribe - Verification Resent",
        });
        return sendSuccess<SubscribeResponse>({
          message: "Verification email resent",
        });
      }
    }

    const subscriber = await createSubscriber({
      email,
      source: "form",
      status: "pending",
    });

    if (subscriber === undefined) {
      const existing = await getSubscriberByEmail(email);
      if (existing?.status === "pending") {
        await sendVerificationEmail(email, existing.token, appUrl);
        return sendSuccess<SubscribeResponse>({
          message: "Verification email resent",
        });
      }
      if (existing?.status === "verified") {
        await sendAlreadySubscribedEmail(email, existing.token, appUrl);
      }
      return sendSuccess<SubscribeResponse>({
        message: "Already subscribed",
      });
    }

    await sendVerificationEmail(email, subscriber.token, appUrl);

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: `${subscriber.email} subscribed`,
      title: "Subscribe - New Subscriber",
    });

    return sendCreated<SubscribeResponse>({
      message: "Verification email sent",
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

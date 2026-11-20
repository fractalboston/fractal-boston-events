import {
  type VerifyResponse,
  handleOptionsRequest,
  sendBadRequest,
  sendInternalError,
  sendNeedsConfirmation,
  sendNotFound,
  sendSuccess,
  verifyBodySchema,
} from "@/lib/api-response";
import { sendDiscordError, sendDiscordInfo } from "@/lib/discord";
import { sendWelcomeEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import { processVerificationRequest } from "@/lib/verification";

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

  const parsed = verifyBodySchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Invalid token");
  }

  const { token, confirmed } = parsed.data;

  try {
    const result = await processVerificationRequest({
      token,
      confirmed: confirmed === true,
    });

    if (result.kind === "not_found") {
      return sendNotFound("Token not found");
    }

    if (result.kind === "needs_confirmation") {
      return sendNeedsConfirmation();
    }

    if (result.kind === "not_pending") {
      if (result.status === "unsubscribed") {
        return sendBadRequest("This email has been unsubscribed");
      }
      return sendNotFound("Token not found or already verified");
    }

    if (result.kind === "already_verified") {
      await sendDiscordInfo({
        webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
        message: result.subscriber.email,
        title: "Already Verified",
      });
      return sendSuccess<VerifyResponse>({
        message: "Already verified",
        email: result.subscriber.email,
      });
    }

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: result.subscriber.email,
      title: "Verified",
    });

    try {
      const events = await getReportableEvents();
      await sendWelcomeEmail(
        result.subscriber.email,
        result.subscriber.token,
        events,
        env.APP_URL
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return sendSuccess<VerifyResponse>({
      message: "Email verified successfully",
      email: result.subscriber.email,
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

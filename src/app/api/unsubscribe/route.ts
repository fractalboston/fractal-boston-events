import {
  type UnsubscribeResponse,
  handleOptionsRequest,
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
  unsubscribeBodySchema,
} from "@/lib/api-response";
import { sendDiscordError, sendDiscordInfo } from "@/lib/discord";
import { env } from "@/lib/env";
import { getSubscriberByToken, unsubscribe } from "@/lib/subscribers";

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

  const parsed = unsubscribeBodySchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Invalid token");
  }

  const { token } = parsed.data;

  try {
    const existing = await getSubscriberByToken(token);

    if (!existing) {
      return sendNotFound("Token not found");
    }

    if (existing.status === "unsubscribed") {
      await sendDiscordInfo({
        webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
        message: existing.email,
        title: "Already Unsubscribed",
      });
      return sendSuccess<UnsubscribeResponse>({
        message: "Already unsubscribed",
      });
    }

    const subscriber = await unsubscribe(existing.token);

    if (subscriber === undefined) {
      return sendNotFound("Token not found");
    }

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: existing.email,
      title: "Unsubscribed",
    });

    return sendSuccess<UnsubscribeResponse>({
      message: "We're sorry to see you go.",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Unsubscribe endpoint error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to unsubscribe");
  }
}

import { z } from "zod";
import {
  handleOptionsRequest,
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
} from "@/lib/api-response";
import { sendDiscordError, sendDiscordInfo } from "@/lib/discord";
import { env } from "@/lib/env";
import { getSubscriberByToken, unsubscribe } from "@/lib/subscribers";

const unsubscribeSchema = z.object({
  token: z.uuid(),
});

type UnsubscribeResponse = {
  message: string;
  email: string;
};

export async function OPTIONS(): Promise<Response> {
  return handleOptionsRequest();
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendBadRequest("Invalid JSON body");
  }

  const parsed = unsubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return sendBadRequest("Invalid token");
  }

  const { token } = parsed.data;

  try {
    const existing = await getSubscriberByToken(token);

    if (existing === undefined) {
      return sendNotFound("Token not found");
    }

    if (existing.status === "unsubscribed") {
      await sendDiscordInfo(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        "Unsubscribe attempt for already unsubscribed email",
        "Unsubscribe - Already Unsubscribed"
      );
      return sendSuccess<UnsubscribeResponse>({
        message: "Already unsubscribed",
        email: existing.email,
      });
    }

    const subscriber = await unsubscribe(token);

    if (subscriber === undefined) {
      return sendNotFound("Token not found");
    }

    await sendDiscordInfo(
      env.DISCORD_LOGGING_WEBHOOK_URL,
      "Successfully unsubscribed",
      "Unsubscribe - Success"
    );

    return sendSuccess<UnsubscribeResponse>({
      message: "Successfully unsubscribed",
      email: subscriber.email,
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

import {
  notAllowed,
  sendInternalError,
  sendSuccess,
  withHandler,
} from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";
import { sendDiscordError, sendDiscordWeeklySummary } from "@/lib/discord";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";

type CronResponse = {
  message: string;
  eventsCount: number;
};

export const GET = withHandler(async (): Promise<Response> => {
  const authError = await validateCronSecret();
  if (authError !== null) {
    return authError;
  }

  try {
    const events = await getReportableEvents(env.LUMA_CALENDAR_ID);

    await sendDiscordWeeklySummary(
      env.DISCORD_EVENTS_WEBHOOK_URL,
      events,
      env.DISCORD_MOD_ROLE_ID
    );

    return sendSuccess<CronResponse>({
      message: "Upcoming events sent to Discord",
      eventsCount: events.length,
    });
  } catch (error) {
    console.error("Discord weekly cron error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Discord weekly cron (Monday 8am) error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to send events to Discord");
  }
});

export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;

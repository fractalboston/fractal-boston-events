import { sendInternalError, sendSuccess } from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";
import { sendDiscordEmailJobStats, sendDiscordError } from "@/lib/discord";
import { sendBatchEmails } from "@/lib/email";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import { getAllVerifiedSubscribers } from "@/lib/subscribers";

type CronResponse = {
  message: string;
  eventsCount: number;
  emailsSent: number;
  emailsFailed: number;
};

export async function GET(): Promise<Response> {
  const authError = await validateCronSecret();
  if (authError !== null) {
    return authError;
  }

  try {
    const { LUMA_CALENDAR_ID, DISCORD_LOGGING_WEBHOOK_URL, APP_URL } = env;

    const events = await getReportableEvents(LUMA_CALENDAR_ID);
    const subscribers = await getAllVerifiedSubscribers();

    const { success, failed } = await sendBatchEmails(
      subscribers,
      events,
      APP_URL,
      "weekly",
      undefined,
      DISCORD_LOGGING_WEBHOOK_URL
    );

    try {
      const estimatedMonthlyUsage = subscribers.length * 4;
      await sendDiscordEmailJobStats(DISCORD_LOGGING_WEBHOOK_URL, {
        emailsSent: success,
        emailsFailed: failed,
        eventsCount: events.length,
        subscribersCount: subscribers.length,
        resendMonthlyLimit: 3000,
        resendMonthlyUsed: estimatedMonthlyUsage,
      });
    } catch (discordError) {
      console.error("Failed to send stats to Discord:", discordError);
    }

    return sendSuccess<CronResponse>({
      message: "Email weekly digest sent",
      eventsCount: events.length,
      emailsSent: success,
      emailsFailed: failed,
    });
  } catch (error) {
    console.error("Email weekly cron error:", error);

    try {
      await sendDiscordError(
        env.DISCORD_LOGGING_WEBHOOK_URL,
        error instanceof Error ? error : new Error(String(error)),
        "Email weekly cron job error"
      );
    } catch (discordError) {
      console.error("Failed to log error to Discord:", discordError);
    }

    return sendInternalError("Failed to run email weekly digest");
  }
}

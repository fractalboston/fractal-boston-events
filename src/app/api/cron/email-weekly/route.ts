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
    console.log(`Found ${String(events.length)} events`);

    const verifiedSubscribers = await getAllVerifiedSubscribers();

    // Filter out subscribers who were emailed within the last 5 days
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const subscribers = verifiedSubscribers
      .filter((subscriber) => {
        return (
          subscriber.last_emailed_at === null ||
          subscriber.last_emailed_at < fiveDaysAgo
        );
      })
      .map((subscriber) => ({
        email: subscriber.email,
        token: subscriber.token,
      }));

    const skippedCount = verifiedSubscribers.length - subscribers.length;
    if (skippedCount > 0) {
      console.log(
        `Skipped ${String(skippedCount)} subscribers who were emailed within the last 5 days`
      );
    }

    // Skip sending emails if there are no events
    if (events.length === 0) {
      console.warn("No events found, skipping email send");

      try {
        await sendDiscordEmailJobStats(DISCORD_LOGGING_WEBHOOK_URL, {
          emailsSent: 0,
          emailsFailed: 0,
          eventsCount: 0,
          subscribersCount: subscribers.length,
        });
      } catch (discordError) {
        console.error("Failed to send stats to Discord:", discordError);
      }

      return sendSuccess<CronResponse>({
        message: "Email weekly digest skipped - no events found",
        eventsCount: 0,
        emailsSent: 0,
        emailsFailed: 0,
      });
    }

    console.log(`Found ${String(subscribers.length)} subscribers`);

    const { success, failed } = await sendBatchEmails({
      emails: subscribers,
      events,
      appUrl: APP_URL,
      type: "weekly",
      singleEvent: undefined,
      discordWebhookUrl: DISCORD_LOGGING_WEBHOOK_URL,
      updateLastEmailedAt: true,
    });

    console.log(`Sent ${String(success)} emails`);
    if (failed > 0) {
      console.error(`Failed to send ${String(failed)} emails`);
    }

    try {
      await sendDiscordEmailJobStats(DISCORD_LOGGING_WEBHOOK_URL, {
        emailsSent: success,
        emailsFailed: failed,
        eventsCount: events.length,
        subscribersCount: subscribers.length,
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

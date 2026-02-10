import { sendInternalError, sendSuccess } from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";
import { sendDiscordEmailJobStats, sendDiscordError } from "@/lib/discord";
import { sendBatchEmails } from "@/lib/email";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import { getVerifiedSubscribersByIds } from "@/lib/subscribers";

const testingSubscribers = [
  "019c30e3-8436-1d4d-f354-0aeb1d1e9bf3",
  "019c30e1-25ce-bc93-cc63-857e0919edf7",
  "019c30e1-434c-3a90-fe46-5eea2af2d482",
];

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

    // Fetch all verified subscribers from testingSubscribers array
    const verifiedSubscribers =
      await getVerifiedSubscribersByIds(testingSubscribers);
    const subscribers = verifiedSubscribers.map((subscriber) => ({
      email: subscriber.email,
      token: subscriber.token,
    }));

    // Skip sending emails if there are no events
    if (events.length === 0) {
      console.warn("No events found, skipping email send");

      try {
        await sendDiscordEmailJobStats(DISCORD_LOGGING_WEBHOOK_URL, {
          emailsSent: 0,
          emailsFailed: 0,
          eventsCount: 0,
          subscribersCount: subscribers.length,
          resendMonthlyLimit: 3000,
          resendMonthlyUsed: subscribers.length * 4,
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

    const { success, failed } = await sendBatchEmails(
      subscribers,
      events,
      APP_URL,
      "weekly",
      undefined,
      DISCORD_LOGGING_WEBHOOK_URL
    );

    console.log(`Sent ${String(success)} emails`);
    console.log(`Failed to send ${String(failed)} emails`);

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

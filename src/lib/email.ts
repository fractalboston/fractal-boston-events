import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/constants";
import { sendDiscordEmailLog, sendDiscordInfo } from "@/lib/discord";
import {
  buildEmailBody,
  formatEventsSimpleHtml,
  generateEventsHtml,
  wrapInEmailTemplate,
} from "@/lib/emailTemplates";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import type { LumaEvent } from "@/lib/luma";
import { getLumaEventUrl } from "@/lib/urls";

let resendClient: Resend | null = null;

function getResend(): Resend {
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

async function sendEmailIfEnabled({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.EMAIL_ENABLED) {
    return;
  }

  const resend = getResend();
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  appUrl: string
): Promise<void> {
  const verifyUrl = `${appUrl}/verify?token=${token}`;

  const content = `
    <h1 style="font-size: 24px; margin-bottom: 16px;">Verify your subscription</h1>
    <p>Thanks for subscribing to Fractal Events! Please click the button below to confirm your email address.</p>
    <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
      Verify Email
    </a>
    <p style="margin-top: 24px; font-size: 14px; color: #666;">
      Or copy this link: ${verifyUrl}
    </p>
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: "Verify your Fractal Events subscription",
    html: wrapInEmailTemplate(buildEmailBody(content, "#")),
  });

  await sendDiscordEmailLog({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    emailType: "verification",
    recipientCount: 1,
    enabled: env.EMAIL_ENABLED,
  });
}

export async function sendWelcomeEmail(
  email: string,
  token: string,
  events: LumaEvent[],
  appUrl: string
): Promise<void> {
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;

  const content = `
    <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to Fractal Events! 🎉</h1>
    <p>You're now subscribed to weekly event updates from Fractal Boston.</p>
    <h2 style="font-size: 18px; margin-top: 24px;">Upcoming Events This Week</h2>
    ${generateEventsHtml(events)}
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: "Welcome to Fractal Events - Here's what's coming up!",
    html: wrapInEmailTemplate(buildEmailBody(content, unsubscribeUrl)),
  });

  await sendDiscordEmailLog({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    emailType: "welcome",
    recipientCount: 1,
    enabled: env.EMAIL_ENABLED,
  });
}

export async function sendWeeklyDigest(
  email: string,
  token: string,
  events: LumaEvent[],
  appUrl: string,
  skipLogging = false
): Promise<void> {
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;

  const content = `
    <h1 style="font-size: 24px; margin-bottom: 16px;">This Week at Fractal 📅</h1>
    ${generateEventsHtml(events)}
    <p style="margin-top: 24px;">
      <a href="https://lu.ma/fractalboston" style="color: #2563eb;">View all events on Luma →</a>
    </p>
  `;

  const eventCount = String(events.length);
  await sendEmailIfEnabled({
    to: email,
    subject: `This Week at Fractal (${eventCount} event${events.length === 1 ? "" : "s"})`,
    html: wrapInEmailTemplate(buildEmailBody(content, unsubscribeUrl)),
  });

  if (!skipLogging) {
    await sendDiscordEmailLog({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      emailType: "weekly",
      recipientCount: 1,
      enabled: env.EMAIL_ENABLED,
    });
  }
}

export async function sendNewEventAlert(
  email: string,
  token: string,
  event: LumaEvent,
  appUrl: string,
  skipLogging = false
): Promise<void> {
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;

  const content = `
    <h1 style="font-size: 24px; margin-bottom: 16px;">New Event Alert! 🚀</h1>
    <p>A new event was just added:</p>
    ${generateEventsHtml([event])}
    <p>
      <a href="${getLumaEventUrl(event.event.url)}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        RSVP Now
      </a>
    </p>
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: `New Event: ${event.event.name}`,
    html: wrapInEmailTemplate(buildEmailBody(content, unsubscribeUrl)),
  });

  if (!skipLogging) {
    await sendDiscordEmailLog({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      emailType: "new-event",
      recipientCount: 1,
      enabled: env.EMAIL_ENABLED,
    });
  }
}

export async function sendBatchEmails(
  emails: { email: string; token: string }[],
  events: LumaEvent[],
  appUrl: string,
  type: "weekly" | "new-event",
  singleEvent?: LumaEvent,
  discordWebhookUrl?: string
): Promise<{ success: number; failed: number; errors: Error[] }> {
  if (type === "new-event" && singleEvent === undefined) {
    throw new Error("singleEvent is required for new-event batch emails.");
  }

  let success = 0;
  let failed = 0;
  const errors: Error[] = [];

  // Resend has a batch API, but for simplicity we'll send individually
  // with a small delay to avoid rate limits (100/sec on free tier)
  for (const { email, token } of emails) {
    try {
      if (type === "weekly") {
        await sendWeeklyDigest(email, token, events, appUrl, true);
      } else if (singleEvent !== undefined) {
        await sendNewEventAlert(email, token, singleEvent, appUrl, true);
      }
      success++;
      // Small delay to stay within rate limits (only if emailing is enabled)
      if (env.EMAIL_ENABLED) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Failed to send email to ${email}:`, err);
      errors.push(err);
      failed++;

      // Log to Discord if webhook URL is provided
      if (discordWebhookUrl !== undefined) {
        try {
          const { sendDiscordError } = await import("./discord");
          await sendDiscordError(
            discordWebhookUrl,
            err,
            `Failed to send email to ${email}`
          );
        } catch (discordError) {
          console.error("Failed to log error to Discord:", discordError);
        }
      }
    }
  }

  // Log batch email operation to Discord (log once for the entire batch)
  const emailType = type === "weekly" ? "weekly" : "new-event";
  const webhookUrl: string =
    discordWebhookUrl ?? env.DISCORD_LOGGING_WEBHOOK_URL;
  const emailEnabled: boolean = env.EMAIL_ENABLED;
  await sendDiscordEmailLog({
    webhookUrl,
    emailType,
    recipientCount: success,
    enabled: emailEnabled,
  });

  return { success, failed, errors };
}

export type EmailContent = {
  from: string;
  subject: string;
  html: string;
};

export function getEmailContent(
  events: LumaEvent[],
  isTest: boolean
): EmailContent {
  const eventsText = formatEventsSimpleHtml(events);
  const content = `
    <p>Here's what's coming up this week:</p>
    ${eventsText}
  `;
  const body = buildEmailBody(content, "#");
  return {
    from: EMAIL_FROM,
    subject: `${isTest ? "[TEST] " : ""} Upcoming Fractal Events`,
    html: wrapInEmailTemplate(body),
  };
}

export async function sendTestEmail(
  email: string,
  asOfDate?: Date
): Promise<void> {
  const events = await getReportableEvents(
    env.LUMA_CALENDAR_ID,
    asOfDate ?? new Date()
  );
  const { from, subject, html } = getEmailContent(events, true);

  const resend = getResend();
  await resend.emails.send({
    from,
    to: email,
    subject,
    html,
  });

  await sendDiscordInfo({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    message: `Test email sent to **${email}** (subject: ${subject})`,
    color: 0x3b82f6,
  });
}

import { Resend } from "resend";
import {
  sendDiscordEmailLog as sendDiscordEmailLogImpl,
  sendDiscordInfo as sendDiscordInfoImpl,
} from "@/lib/discord";
import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import type { LumaEvent } from "@/lib/luma";

type SendDiscordEmailLogFn = ({
  webhookUrl,
  emailType,
  recipientCount,
  enabled,
}: {
  webhookUrl: string;
  emailType: "verification" | "welcome" | "weekly" | "new-event";
  recipientCount: number;
  enabled: boolean;
}) => Promise<void>;

type SendDiscordInfoFn = ({
  webhookUrl,
  message,
  title,
  color,
}: {
  webhookUrl: string;
  message: string;
  title?: string;
  color?: number;
}) => Promise<void>;

const sendDiscordEmailLog: SendDiscordEmailLogFn =
  sendDiscordEmailLogImpl as SendDiscordEmailLogFn;

const sendDiscordInfo: SendDiscordInfoFn =
  sendDiscordInfoImpl as SendDiscordInfoFn;

let resendClient: Resend | null = null;

function getResend(): Resend {
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function formatEventsPlainText(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map(
      (event) =>
        `<p><a href="https://lu.ma/${event.event.url}">${event.event.name}</a><br>${formatEventDate(event.start_at)}</p>`
    )
    .join("");

  return eventItems;
}

function generateEventsHtml(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map(
      (event) => `
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
          <a href="${event.event.url}" style="color: #2563eb; text-decoration: none;">${event.event.name}</a>
        </h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          📅 ${formatEventDate(event.start_at)}
        </p>
      </div>
    `
    )
    .join("");

  return `
    <div style="margin-top: 16px;">
      ${eventItems}
    </div>
  `;
}

function wrapInEmailTemplate(content: string, unsubscribeUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        ${content}
        <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e5e5;">
        <div style="margin-top: 16px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
          <p style="font-size: 14px; color: #666; margin: 0 0 12px 0; font-weight: 600;">
            Fractal Boston
          </p>
          <p style="font-size: 12px; color: #999; margin: 0 0 8px 0;">
            <a href="https://fractal.boston" style="color: #2563eb; text-decoration: none;">fractal.boston</a>
            • <a href="https://lu.ma/fractalboston" style="color: #2563eb; text-decoration: none;">Calendar</a>
            • <a href="https://discord.gg/fractalboston" style="color: #2563eb; text-decoration: none;">Discord</a>
          </p>
          <p style="font-size: 12px; color: #999; margin: 0;">
            <a href="${unsubscribeUrl}" style="color: #999; text-decoration: none;">Unsubscribe</a> from these emails.
          </p>
        </div>
      </body>
    </html>
  `;
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

  if (env.EMAIL_ENABLED) {
    const resend = getResend();
    await resend.emails.send({
      from: "Fractal Events <events@fractal.boston>",
      to: email,
      subject: "Verify your Fractal Events subscription",
      html: wrapInEmailTemplate(content, "#"),
    });
  }

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

  if (env.EMAIL_ENABLED) {
    const resend = getResend();
    await resend.emails.send({
      from: "Fractal Events <events@fractal.boston>",
      to: email,
      subject: "Welcome to Fractal Events - Here's what's coming up!",
      html: wrapInEmailTemplate(content, unsubscribeUrl),
    });
  }

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
  if (env.EMAIL_ENABLED) {
    const resend = getResend();
    await resend.emails.send({
      from: "Fractal Events <events@fractal.boston>",
      to: email,
      subject: `This Week at Fractal (${eventCount} event${events.length === 1 ? "" : "s"})`,
      html: wrapInEmailTemplate(content, unsubscribeUrl),
    });
  }

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
      <a href="${event.event.url}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        RSVP Now
      </a>
    </p>
  `;

  if (env.EMAIL_ENABLED) {
    const resend = getResend();
    await resend.emails.send({
      from: "Fractal Events <events@fractal.boston>",
      to: email,
      subject: `New Event: ${event.event.name}`,
      html: wrapInEmailTemplate(content, unsubscribeUrl),
    });
  }

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
  const eventsText = formatEventsPlainText(events);
  const footer = `
  ---<br>
  links: <a href="https://fractal.boston">fractal.boston</a> | <a href="https://fractal.boston/calendar">/calendar</a> | <a href="https://fractal.boston/discord">/discord</a>
  `.trim();
  const html = `
    <p>Here's what's coming up this week:</p>
    ${eventsText}
    <p>
    ${footer}
    </p>
  `;
  return {
    from: "Fractal Events <events@fractal.boston>",
    subject: `${isTest ? "[TEST] " : ""} Upcoming Fractal Events`,
    html,
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

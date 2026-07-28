import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { BRAND_COLOR, EMAIL_FROM } from "@/lib/constants";
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
import { updateLastEmailedAt } from "@/lib/subscribers";
import { getLumaEventUrl } from "@/lib/urls";

let sesClient: SESClient | null = null;

function getSES(): SESClient {
  sesClient ??= new SESClient({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return sesClient;
}

export class SESQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SESQuotaError";
  }
}

function isQuotaError(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  const errorObj = error as Record<string, unknown>;
  const messageValue = errorObj.message;
  const nameValue = errorObj.name;
  const codeValue = errorObj.Code ?? errorObj.code;

  const errorMessage =
    typeof messageValue === "string" ? messageValue.toLowerCase() : "";
  const errorName =
    typeof nameValue === "string" ? nameValue.toLowerCase() : "";
  const errorCode =
    typeof codeValue === "string" ? codeValue.toLowerCase() : "";

  // SES quota errors typically have codes like "Throttling", "MessageRejected", or "MailFromDomainNotVerified"
  // Rate limiting errors are usually "Throttling"
  return (
    errorCode === "throttling" ||
    errorMessage.includes("throttl") ||
    errorMessage.includes("quota") ||
    errorMessage.includes("rate limit") ||
    errorName === "throttlingexception"
  );
}

async function sendViaSes({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from: string;
  replyTo?: string;
}): Promise<void> {
  const ses = getSES();
  try {
    const params: SendEmailCommandInput = {
      Source: from,
      Destination: {
        ToAddresses: [to],
      },
      ReplyToAddresses: replyTo !== undefined ? [replyTo] : undefined,
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    const result = await ses.send(command);

    if (result.MessageId === undefined || result.MessageId === "") {
      throw new Error(
        "SES API returned invalid response - email may not have been sent"
      );
    }
  } catch (error) {
    if (error instanceof SESQuotaError) {
      throw error;
    }
    if (isQuotaError(error)) {
      throw new SESQuotaError(
        `SES quota exceeded: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    throw error;
  }
}

async function sendEmailIfEnabled({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  if (!env.EMAIL_ENABLED) {
    console.warn(`Trying to email ${to} but EMAIL_ENABLED is false`);
    return;
  }

  await sendViaSes({ to, subject, html, from: from ?? EMAIL_FROM, replyTo });
}

export async function sendBroadcastEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from: string;
  replyTo?: string;
}): Promise<void> {
  await sendEmailIfEnabled({ to, subject, html, from, replyTo });
}

/** Test sends bypass EMAIL_ENABLED, mirroring sendTestEmail. */
export async function sendBroadcastTestEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from: string;
  replyTo?: string;
}): Promise<void> {
  await sendViaSes({ to, subject, html, from, replyTo });
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
    <a href="${verifyUrl}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
      Verify Email
    </a>
    <p style="margin-top: 24px; font-size: 14px; color: #666;">
      Or copy this link: <a href="${verifyUrl}" style="color: ${BRAND_COLOR};">${verifyUrl}</a>
    </p>
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: "Verify your Fractal Events subscription",
    html: wrapInEmailTemplate(buildEmailBody(content)),
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
    <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to Fractal! 🎉</h1>
    <p>You're now subscribed to weekly event updates from Fractal Boston.</p>
    <h2 style="font-size: 18px; margin-top: 24px;">Upcoming Events This Week</h2>
    ${generateEventsHtml(events)}
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: "Welcome to Fractal, here's what's coming up",
    html: wrapInEmailTemplate(buildEmailBody(content, unsubscribeUrl)),
  });

  await sendDiscordEmailLog({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    emailType: "welcome",
    recipients: [email],
    enabled: env.EMAIL_ENABLED,
  });
}

export async function sendAlreadySubscribedEmail(
  email: string,
  token: string,
  appUrl: string
): Promise<void> {
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;

  const content = `
    <h1 style="font-size: 24px; margin-bottom: 16px;">You're Subscribed</h1>
    <p>You're already subscribed to Fractal Events.</p>
    <p>Look for an events email on Monday.</p>
  `;

  await sendEmailIfEnabled({
    to: email,
    subject: "You're Subscribed",
    html: wrapInEmailTemplate(buildEmailBody(content, unsubscribeUrl)),
  });

  await sendDiscordEmailLog({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    emailType: "already-subscribed",
    recipients: [email],
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
    <h1 style="font-size: 24px; margin-bottom: 16px;">This Week at Fractal</h1>
    ${generateEventsHtml(events)}
    <p style="margin-top: 24px;">
      <a href="https://lu.ma/fractalboston" style="color: ${BRAND_COLOR};">View all events on Luma →</a>
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
      recipients: [email],
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
      <a href="${getLumaEventUrl(event.event.url)}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
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
      recipients: [email],
      enabled: env.EMAIL_ENABLED,
    });
  }
}

export async function sendBatchEmails({
  emails,
  events,
  appUrl,
  type,
  singleEvent,
  discordWebhookUrl,
  updateLastEmailedAt: shouldUpdateLastEmailedAt = false,
}: {
  emails: { email: string; token: string }[];
  events: LumaEvent[];
  appUrl: string;
  type: "weekly" | "new-event";
  singleEvent?: LumaEvent;
  discordWebhookUrl?: string;
  updateLastEmailedAt?: boolean;
}): Promise<{ success: number; failed: number; errors: Error[] }> {
  if (type === "new-event" && singleEvent === undefined) {
    throw new Error("singleEvent is required for new-event batch emails.");
  }

  let success = 0;
  let failed = 0;
  const errors: Error[] = [];
  const successfulEmails: string[] = [];

  // SES sends emails individually
  // with a small delay to avoid rate limits (SES has rate limits based on account)
  for (const { email, token } of emails) {
    try {
      if (type === "weekly") {
        await sendWeeklyDigest(email, token, events, appUrl, true);
      } else if (singleEvent !== undefined) {
        await sendNewEventAlert(email, token, singleEvent, appUrl, true);
      }

      successfulEmails.push(email);
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

      // IMPORTANT: Do not mark email as sent if quota error occurred
      // The email was not actually sent, so we should not update last_emailed_at
      if (error instanceof SESQuotaError) {
        console.warn(
          `SES quota exceeded - email to ${email} was NOT sent and will NOT be marked as sent`
        );
      }

      // Log to Discord if webhook URL is provided
      if (discordWebhookUrl !== undefined) {
        try {
          const { sendDiscordError } = await import("./discord");
          await sendDiscordError(
            discordWebhookUrl,
            err,
            `Failed to send email to ${email}${error instanceof SESQuotaError ? " (QUOTA EXCEEDED)" : ""}`
          );
        } catch (discordError) {
          console.error("Failed to log error to Discord:", discordError);
        }
      }
    }
  }

  // Batch update last_emailed_at for all successfully sent emails
  // Important: Update even if there are errors - we need accurate tracking to avoid re-emailing
  if (shouldUpdateLastEmailedAt && successfulEmails.length > 0) {
    try {
      await updateLastEmailedAt(successfulEmails);
    } catch (updateError) {
      // Log error but don't fail the entire batch - tracking is important but shouldn't block
      // Include comma-separated list of emails for manual fix
      const emailsList = successfulEmails.join(", ");
      console.error(
        `Failed to update last_emailed_at for ${String(successfulEmails.length)} successfully sent emails:`,
        updateError
      );
      console.error(`Emails that need a last_emailed_at update: ${emailsList}`);
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
    recipients: successfulEmails,
    enabled: emailEnabled,
  });

  return { success, failed, errors };
}

export type EmailContent = {
  from: string;
  subject: string;
  html: string;
};

export function getBasicEmailContent(
  events: LumaEvent[],
  isTest: boolean
): EmailContent {
  const eventsText = formatEventsSimpleHtml(events);
  const content = `
    <p>Here's what's coming up this week:</p>
    ${eventsText}
  `;
  const body = buildEmailBody(content);
  return {
    from: EMAIL_FROM,
    subject: `${isTest ? "[TEST] " : ""} Upcoming Fractal Events`,
    html: wrapInEmailTemplate(body),
  };
}

export function getDetailedEmailContent(
  events: LumaEvent[],
  isTest: boolean
): EmailContent {
  const detailedEventsHtml = generateEventsHtml(events);
  const content = `
    <p>Here's what's coming up this week:</p>
    ${detailedEventsHtml}
  `;
  const body = buildEmailBody(content);
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
  const { from, subject, html } = getBasicEmailContent(events, true);

  await sendViaSes({ to: email, subject, html, from });

  await sendDiscordInfo({
    webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
    message: `Test email sent to **${email}** (subject: ${subject})`,
    color: 0x3b82f6,
  });
}

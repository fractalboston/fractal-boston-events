import { type LumaEvent, getEventStartAt } from "@/lib/luma";
import { getLumaEventUrl } from "@/lib/urls";

/** Discord message flag: do not include any embeds (including link previews). */
const SUPPRESS_EMBEDS = 1 << 2;
const TIME_ZONE = "America/New_York";

type DiscordWebhookPayload = {
  content?: string;
  embeds?: never[];
  flags?: number;
};

/** Same format as email: "Monday, January 29, 2025 at 3:00 PM" */
function formatEventDateLong(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

/** Flat event list formatted like the email (no categories). */
function formatEventsLikeEmail(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "No events scheduled for this week.";
  }
  const sorted = [...events].sort(
    (a, b) =>
      new Date(getEventStartAt(a)).getTime() -
      new Date(getEventStartAt(b)).getTime()
  );
  return sorted
    .map(
      (event) =>
        `**[${event.event.name}](${getLumaEventUrl(event.event.url)})**\n${formatEventDateLong(getEventStartAt(event))}`
    )
    .join("\n\n");
}

async function postDiscordWebhook({
  webhookUrl,
  payload,
  throwOnError,
  errorLabel,
}: {
  webhookUrl: string;
  payload: DiscordWebhookPayload;
  throwOnError: boolean;
  errorLabel: string;
}): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    const message = `${errorLabel}: ${String(response.status)} - ${text}`;
    if (throwOnError) {
      throw new Error(message);
    }
    console.error(message);
  }
}

export async function sendDiscordWeeklySummary(
  webhookUrl: string,
  events: LumaEvent[],
  modRoleId?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility (callers pass asOfDate)
  asOfDate?: Date
): Promise<void> {
  let payload: DiscordWebhookPayload;

  if (events.length === 0) {
    const modPing =
      modRoleId !== undefined
        ? `<@&${modRoleId}> ⚠️ No events scheduled for this week! Time to add some events.`
        : "⚠️ No events scheduled for this week!";
    payload = { content: modPing, embeds: [], flags: SUPPRESS_EMBEDS };
  } else {
    // Match email: "This Week at Fractal" + flat event list + "View all events →"
    const eventsText = formatEventsLikeEmail(events);
    const viewAllUrl = "https://lu.ma/fractalboston";
    const content = `# This Week at Fractal\n\n${eventsText}\n\n[View all events →](${viewAllUrl})`;

    payload = {
      content,
      embeds: [],
      flags: SUPPRESS_EMBEDS,
    };
  }

  await postDiscordWebhook({
    webhookUrl,
    payload,
    throwOnError: true,
    errorLabel: "Discord webhook error",
  });
}

export async function sendDiscordNewEventAlert(
  webhookUrl: string,
  event: LumaEvent
): Promise<void> {
  // Match email: "New Event Alert! 🚀" + "A new event was just added:" + event block + "RSVP Now" link
  const eventUrl = getLumaEventUrl(event.event.url);
  const eventBlock = `**[${event.event.name}](${eventUrl})**\n${formatEventDateLong(getEventStartAt(event))}`;
  const payload: DiscordWebhookPayload = {
    content: `# New Event Alert! 🚀\n\nA new event was just added:\n\n${eventBlock}\n\n[RSVP Now](${eventUrl})`,
    embeds: [],
    flags: SUPPRESS_EMBEDS,
  };

  await postDiscordWebhook({
    webhookUrl,
    payload,
    throwOnError: true,
    errorLabel: "Discord webhook error",
  });
}

export async function sendDiscordError(
  webhookUrl: string,
  error: Error,
  context: string
): Promise<void> {
  const stack =
    error.stack !== undefined
      ? `\n**Stack:**\n\`\`\`\n${error.stack.slice(0, 1000)}\n\`\`\``
      : "";
  const payload: DiscordWebhookPayload = {
    content: `❌ **Error occurred**\n\n**${context}**\n\`\`\`\n${error.message}\n\`\`\`${stack}`,
    embeds: [],
    flags: SUPPRESS_EMBEDS,
  };

  try {
    await postDiscordWebhook({
      webhookUrl,
      payload,
      throwOnError: false,
      errorLabel: "Failed to send error to Discord",
    });
  } catch (discordError) {
    console.error("Failed to send error to Discord:", discordError);
  }
}

export async function sendDiscordEmailJobStats(
  webhookUrl: string,
  stats: {
    emailsSent: number;
    emailsFailed: number;
    eventsCount: number;
    subscribersCount: number;
  }
): Promise<void> {
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TIME_ZONE,
  });

  let content = `📧 **Weekly Email Job Complete** - ${currentDate}`;
  content += `\n\n**Email Job Stats**\n`;
  content += `📨 Emails Sent: ${String(stats.emailsSent)}\n`;
  content += `❌ Emails Failed: ${String(stats.emailsFailed)}\n`;
  content += `Events Included: ${String(stats.eventsCount)}\n`;
  content += `👥 Total Subscribers: ${String(stats.subscribersCount)}`;

  const payload: DiscordWebhookPayload = {
    content,
    embeds: [],
    flags: SUPPRESS_EMBEDS,
  };

  await postDiscordWebhook({
    webhookUrl,
    payload,
    throwOnError: true,
    errorLabel: "Discord webhook error",
  });
}

export type SendDiscordEmailLogParams = {
  webhookUrl: string;
  emailType: "verification" | "welcome" | "weekly" | "new-event";
  recipientCount: number;
  enabled: boolean;
};

export async function sendDiscordEmailLog(
  params: SendDiscordEmailLogParams
): Promise<void> {
  const { webhookUrl, emailType, recipientCount, enabled } = params;
  const emailTypeLabels: Record<
    "verification" | "welcome" | "weekly" | "new-event",
    string
  > = {
    verification: "Verification Email",
    welcome: "Welcome Email",
    weekly: "Weekly Digest",
    "new-event": "New Event Alert",
  };

  const statusText = enabled
    ? `Sent to ${String(recipientCount)} recipient${recipientCount === 1 ? "" : "s"}`
    : `Would send to ${String(recipientCount)} recipient${recipientCount === 1 ? "" : "s"} (emailing disabled)`;

  const payload: DiscordWebhookPayload = {
    content: `📧 **${emailTypeLabels[emailType]}**: ${statusText}`,
    embeds: [],
    flags: SUPPRESS_EMBEDS,
  };

  try {
    await postDiscordWebhook({
      webhookUrl,
      payload,
      throwOnError: false,
      errorLabel: "Failed to send email log to Discord",
    });
  } catch (discordError) {
    console.error("Failed to send email log to Discord:", discordError);
  }
}

export type SendDiscordInfoParams = {
  webhookUrl: string;
  message: string;
  title?: string;
  color?: number;
};

export async function sendDiscordInfo(
  params: SendDiscordInfoParams
): Promise<void> {
  const { webhookUrl, message, title } = params;
  const payload: DiscordWebhookPayload = {
    content: `ℹ️ **${title ?? "Info"}**\n\n${message}`,
    embeds: [],
    flags: SUPPRESS_EMBEDS,
  };

  try {
    await postDiscordWebhook({
      webhookUrl,
      payload,
      throwOnError: false,
      errorLabel: "Failed to send info to Discord",
    });
  } catch (discordError) {
    console.error("Failed to send info to Discord:", discordError);
  }
}

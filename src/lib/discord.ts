import type { LumaEvent } from "@/lib/luma";

type DiscordEmbed = {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
  timestamp?: string;
};

type DiscordWebhookPayload = {
  content?: string;
  embeds?: DiscordEmbed[];
};

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export async function sendDiscordWeeklySummary(
  webhookUrl: string,
  events: LumaEvent[],
  modRoleId?: string
): Promise<void> {
  let payload: DiscordWebhookPayload;

  if (events.length === 0) {
    const modPing =
      modRoleId !== undefined
        ? `<@&${modRoleId}> ⚠️ No events scheduled for this week! Time to add some events.`
        : "⚠️ No events scheduled for this week!";
    payload = { content: modPing };
  } else {
    const eventCount = String(events.length);
    const embeds: DiscordEmbed[] = [
      ...events.map((event) => ({
        title: event.name,
        url: event.url,
        description: `${formatEventDate(event.start_at)}\n${event.description}`,
        color: 0x10b981,
      })),
    ];

    payload = {
      content: `# This Week at Fractal: ${eventCount} event${events.length === 1 ? "" : "s"} coming up`,
      embeds,
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Discord webhook error: ${String(response.status)} - ${text}`
    );
  }
}

export async function sendDiscordNewEventAlert(
  webhookUrl: string,
  event: LumaEvent
): Promise<void> {
  const payload: DiscordWebhookPayload = {
    content: "🚀 New event just added!",
    embeds: [
      {
        title: event.name,
        url: event.url,
        description: `📆 ${formatEventDate(event.start_at)}`,
        color: 0xf59e0b,
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Discord webhook error: ${String(response.status)} - ${text}`
    );
  }
}

export async function sendDiscordError(
  webhookUrl: string,
  error: Error,
  context: string
): Promise<void> {
  const payload: DiscordWebhookPayload = {
    content: "❌ **Error occurred**",
    embeds: [
      {
        title: context,
        description: `\`\`\`\n${error.message}\n\`\`\``,
        color: 0xef4444,
        fields: [
          {
            name: "Stack",
            value:
              error.stack !== undefined
                ? `\`\`\`\n${error.stack.slice(0, 1000)}\n\`\`\``
                : "No stack trace",
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `Failed to send error to Discord: ${String(response.status)} - ${text}`
      );
    }
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
    resendMonthlyLimit: number;
    resendMonthlyUsed: number;
  }
): Promise<void> {
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const percentUsed =
    (stats.resendMonthlyUsed / stats.resendMonthlyLimit) * 100;
  const warningThreshold = 75;

  let content = `📧 **Weekly Email Job Complete** - ${currentDate}`;
  if (percentUsed >= warningThreshold) {
    content = `⚠️ ${content}\n**WARNING: Approaching Resend monthly limit!**`;
  }

  const payload: DiscordWebhookPayload = {
    content,
    embeds: [
      {
        title: "Email Job Stats",
        color: percentUsed >= warningThreshold ? 0xf59e0b : 0x10b981,
        fields: [
          {
            name: "📨 Emails Sent",
            value: String(stats.emailsSent),
            inline: true,
          },
          {
            name: "❌ Emails Failed",
            value: String(stats.emailsFailed),
            inline: true,
          },
          {
            name: "📅 Events Included",
            value: String(stats.eventsCount),
            inline: true,
          },
          {
            name: "👥 Total Subscribers",
            value: String(stats.subscribersCount),
            inline: true,
          },
          {
            name: "📊 Resend Usage",
            value: `${String(stats.resendMonthlyUsed)} / ${String(stats.resendMonthlyLimit)} (${percentUsed.toFixed(1)}%)`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Discord webhook error: ${String(response.status)} - ${text}`
    );
  }
}

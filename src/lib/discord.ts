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

function getCategoryForEvent(eventStart: Date, now: Date): string {
  const tz = "America/New_York";

  // Convert to EST and get the 4am boundary for the event
  const eventEST = new Date(
    eventStart.toLocaleString("en-US", { timeZone: tz })
  );
  const event4amBoundary = new Date(eventEST);
  event4amBoundary.setHours(4, 0, 0, 0);

  // If event is before 4am, it belongs to the previous day's category
  if (eventEST < event4amBoundary) {
    event4amBoundary.setDate(event4amBoundary.getDate() - 1);
  }

  // Get current time in EST and find today's 4am boundary
  const nowEST = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const today4am = new Date(nowEST);
  today4am.setHours(4, 0, 0, 0);
  if (nowEST < today4am) {
    today4am.setDate(today4am.getDate() - 1);
  }

  const todayDay = today4am.getDay(); // 0 = Sunday, 6 = Saturday
  const eventDay = event4amBoundary.getDay();
  const daysDiff = Math.floor(
    (event4amBoundary.getTime() - today4am.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Today: events starting between 4am today and 4am tomorrow
  if (daysDiff === 0) {
    return "today";
  }

  // Calculate this weekend (upcoming Saturday-Sunday)
  const thisSaturday = new Date(today4am);
  if (todayDay < 6) {
    // Before Saturday, this weekend is the upcoming Saturday-Sunday
    thisSaturday.setDate(today4am.getDate() + (6 - todayDay));
  } else if (todayDay === 6) {
    // Today is Saturday, this weekend includes today
    // (already set correctly)
  } else {
    // Today is Sunday, this weekend was yesterday
    thisSaturday.setDate(today4am.getDate() - 1);
  }

  const thisSunday = new Date(thisSaturday);
  thisSunday.setDate(thisSaturday.getDate() + 1);
  const nextMonday = new Date(thisSunday);
  nextMonday.setDate(thisSunday.getDate() + 1);

  // This weekend: Saturday 4am - Monday 4am
  if (
    event4amBoundary.getTime() >= thisSaturday.getTime() &&
    event4amBoundary.getTime() < nextMonday.getTime()
  ) {
    return "this weekend";
  }

  // Next weekend: the Saturday-Sunday after this weekend
  const nextSaturday = new Date(thisSaturday);
  nextSaturday.setDate(thisSaturday.getDate() + 7);
  const nextSunday = new Date(nextSaturday);
  nextSunday.setDate(nextSaturday.getDate() + 1);
  const nextWeekMonday = new Date(nextSunday);
  nextWeekMonday.setDate(nextSunday.getDate() + 1);

  if (
    event4amBoundary.getTime() >= nextSaturday.getTime() &&
    event4amBoundary.getTime() < nextWeekMonday.getTime()
  ) {
    return "next weekend";
  }

  // Weekday categories
  if (eventDay === 1) return "monday";
  if (eventDay === 2) return "tuesday";
  if (eventDay === 3) return "wednesday";
  if (eventDay === 4) return "thursday";
  if (eventDay === 5) return "next friday";

  // Fallback (shouldn't happen for events in our time range)
  return "other";
}

function formatEventsByCategory(events: LumaEvent[]): string {
  const now = new Date();
  const categories: Record<string, LumaEvent[]> = {
    today: [],
    "this weekend": [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    "next friday": [],
    "next weekend": [],
  };

  // Group events by category
  for (const event of events) {
    const eventStart = new Date(event.start_at);
    const category = getCategoryForEvent(eventStart, now);
    const categoryList = categories[category];
    if (categoryList !== undefined) {
      categoryList.push(event);
    }
  }

  // Build text string
  const parts: string[] = [];

  const categoryOrder = [
    "today",
    "this weekend",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "next friday",
    "next weekend",
  ];

  for (const category of categoryOrder) {
    const categoryEvents = categories[category];
    if (categoryEvents !== undefined && categoryEvents.length > 0) {
      const categoryTitle =
        category.charAt(0).toUpperCase() + category.slice(1);
      parts.push(`### ${categoryTitle}`);

      for (const event of categoryEvents) {
        const dateStr = formatEventDate(event.start_at);
        parts.push(
          `• [${event.event.name}](https://luma.com/${event.event.url}) - ${dateStr}`
        );
      }

      parts.push(""); // Empty line between categories
    }
  }

  return parts.join("\n").trim();
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
    const eventsText = formatEventsByCategory(events);
    const header = `# This Week at Fractal: ${eventCount} event${events.length === 1 ? "" : "s"} coming up\n\n`;

    payload = {
      content: header + eventsText,
      embeds: [],
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
        title: event.event.name,
        url: event.event.url,
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

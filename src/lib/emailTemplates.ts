import { CALENDAR_URL, DISCORD_URL, HOMEPAGE_URL } from "@/lib/constants";
import type { LumaEvent } from "@/lib/luma";
import { getLumaEventUrl } from "@/lib/urls";

const TIME_ZONE = "America/New_York";

export function formatEventDate(dateString: string): string {
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

export function formatEventsSimpleHtml(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map(
      (event) =>
        `<p><a href="${getLumaEventUrl(event.event.url)}">${event.event.name}</a><br>${formatEventDate(event.start_at)}</p>`
    )
    .join("");

  return eventItems;
}

export function generateEventsHtml(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map(
      (event) => `
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
          <a href="${getLumaEventUrl(event.event.url)}" style="color: #2563eb; text-decoration: none;">${event.event.name}</a>
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

export function buildEmailBody(
  content: string,
  unsubscribeUrl?: string
): string {
  const footer = `
  ---<br>
  links: <a href="${HOMEPAGE_URL}">fractal.boston</a> | <a href="${CALENDAR_URL}">/calendar</a> | <a href="${DISCORD_URL}">/discord</a>
  `.trim();
  const href = unsubscribeUrl ?? "#";
  const unsubscribeLine = `<p style="font-size: 12px;"><a href="${href}" style="font-size: 12px;">Unsubscribe</a> from these emails.</p>`;
  return `
    ${content}
    <p>
    ${footer}
    </p>
    ${unsubscribeLine}
  `;
}

export function wrapInEmailTemplate(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; font-size: 18px; line-height: 1.5;">
        ${body}
      </body>
    </html>
  `;
}

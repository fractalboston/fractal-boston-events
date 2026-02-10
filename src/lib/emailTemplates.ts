import {
  BRAND_COLOR,
  CALENDAR_URL,
  DISCORD_URL,
  HOMEPAGE_URL,
} from "@/lib/constants";
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
    .map((event) => {
      const eventUrl = getLumaEventUrl(event.event.url);
      return `
      <a href="${eventUrl}" style="display: block; text-decoration: none; color: inherit;">
        <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 64px; padding-right: 16px; vertical-align: top;">
                ${event.event.cover_url ? `<div style="width: 64px; height: 64px; background-color: #f0f0f0; border-radius: 4px; overflow: hidden; position: relative;"><img src="${event.event.cover_url}" alt="${event.event.name}" width="64" height="64" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px; display: block; max-width: 100%;" /></div>` : '<div style="width: 64px; height: 64px; background-color: #f0f0f0; border-radius: 4px;"></div>'}
              </td>
              <td style="vertical-align: top;">
                <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
                  <span style="color: ${BRAND_COLOR};">${event.event.name}</span>
                </h3>
                <p style="margin: 0; color: #666; font-size: 14px;">
                  📅 ${formatEventDate(event.start_at)}
                </p>
              </td>
            </tr>
          </table>
        </div>
      </a>
    `;
    })
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
  <p style="font-size: 15px;">
    ---<br/>
    <a href="${HOMEPAGE_URL}" style="color: ${BRAND_COLOR};">fractal.boston</a> | <a href="${CALENDAR_URL}" style="color: ${BRAND_COLOR};">/calendar</a> | <a href="${DISCORD_URL}" style="color: ${BRAND_COLOR};">/discord</a>
  </p>
  `.trim();
  const href = unsubscribeUrl ?? "#";
  const unsubscribeLine = `<p style="font-size: 12px;"><a href="${href}" style="font-size: 12px; color: ${BRAND_COLOR};">Unsubscribe</a> from these emails.</p>`;
  return `
    ${content}
    ${footer}
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
